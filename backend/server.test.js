const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createApp, createDatabase } = require("./server");

let directory;
let database;
let server;
let baseUrl;
let demoAccounts;

before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "hikeventures-test-"));
  const startupOutput = [];
  const originalLog = console.log;
  console.log = (...parts) => startupOutput.push(parts.join(" "));
  try {
    database = createDatabase(path.join(directory, "test.sqlite"));
  } finally {
    console.log = originalLog;
  }
  demoAccounts = startupOutput.map(line => {
    const parts = line.split(" | ");
    return parts.length === 3 ? { email: parts[1], password: parts[2] } : null;
  }).filter(Boolean);
  server = createApp({ db: database, publicDir: path.resolve(__dirname, "..", "public") });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) database.close();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

async function request(endpoint, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json();
  const cookieHeader = response.headers.get("set-cookie");
  return {
    status: response.status,
    body: result,
    cookie: cookieHeader ? cookieHeader.split(";")[0] : cookie
  };
}

test("serves the website and seeds five crater accounts and hikes", async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Hikeventures Philippines/);

  const state = await request("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.body.craters.length, 5);
  assert.equal(state.body.hikes.length, 13);
  assert.equal(demoAccounts.length, 5);
  assert.equal(state.body.user, null);
});

test("customers can book and message a creator, who can reply", async () => {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Test Hiker", email: "hiker@example.test", password: "TestPassword-123" }
  });
  assert.equal(signup.status, 200);
  const customerCookie = signup.cookie;

  const booking = await request("/api/bookings", {
    method: "POST", cookie: customerCookie,
    body: { hikeId: 1, hikers: 2, drone: false, tel: "09123456789" }
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.body.booking.total, 10998);

  const sent = await request("/api/messages", {
    method: "POST", cookie: customerCookie,
    body: { craterId: 1, hikeId: 1, message: "Could you share the meeting point?" }
  });
  assert.equal(sent.status, 201);

  const outsider = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Other Hiker", email: "other@example.test", password: "OtherPassword-123" }
  });
  const forbiddenReply = await request(`/api/messages/${sent.body.id}/reply`, {
    method: "POST", cookie: outsider.cookie, body: { message: "Unauthorized reply" }
  });
  assert.equal(forbiddenReply.status, 404);

  const creatorLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: demoAccounts[0].email, password: demoAccounts[0].password }
  });
  assert.equal(creatorLogin.status, 200);
  const creatorMessages = await request("/api/messages", { cookie: creatorLogin.cookie });
  assert.equal(creatorMessages.body.messages.length, 1);
  assert.equal(creatorMessages.body.messages[0].customerName, "Test Hiker");
  const removeSample = await request("/api/craters/me", { method: "DELETE", cookie: creatorLogin.cookie });
  assert.equal(removeSample.status, 403);

  const reply = await request(`/api/messages/${sent.body.id}/reply`, {
    method: "POST", cookie: creatorLogin.cookie, body: { message: "Meet at the Davao terminal at 5 AM." }
  });
  assert.equal(reply.status, 201);
  const inbox = await request("/api/messages", { cookie: customerCookie });
  assert.equal(inbox.body.messages.length, 2);
  assert.equal(inbox.body.messages[1].body, "Meet at the Davao terminal at 5 AM.");
  const followup = await request(`/api/messages/${inbox.body.messages[1].id}/reply`, {
    method: "POST", cookie: customerCookie, body: { message: "Thank you, I will be there." }
  });
  assert.equal(followup.status, 201);
  const creatorInbox = await request("/api/messages", { cookie: creatorLogin.cookie });
  assert.equal(creatorInbox.body.messages.length, 3);
  assert.equal(creatorInbox.body.messages[2].body, "Thank you, I will be there.");

  const state = await request("/api/state", { cookie: customerCookie });
  assert.equal(state.body.bookings.length, 1);
  assert.equal(state.body.hikes.find(hike => hike.id === 1).booked, 2);
});

test("validates signup, booking capacity, and hides data from public accounts", async () => {
  const weakPassword = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Weak Password", email: "weak@example.test", password: "short" }
  });
  assert.equal(weakPassword.status, 400);

  const user = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Capacity Tester", email: "capacity@example.test", password: "ValidPassword-123" }
  });
  const full = await request("/api/bookings", {
    method: "POST", cookie: user.cookie,
    body: { hikeId: 1, hikers: 100, drone: false, tel: "09123456789" }
  });
  assert.equal(full.status, 409);
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "capacity@example.test", password: "wrong-password" }
  });
  assert.equal(login.status, 401);
  assert.equal("password_hash" in user.body, false);
});

test("customers can apply as creators and publish hike-specific details", async () => {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "New Creator", email: "creator@example.test", password: "CreatorPassword-123" }
  });
  const application = await request("/api/craters", {
    method: "POST", cookie: signup.cookie,
    body: { name: "North Ridge Tours", tel: "09123456789" }
  });
  assert.equal(application.status, 201);

  const hike = await request("/api/hikes", {
    method: "POST", cookie: signup.cookie,
    body: {
      name: "Mt. Pulag", tagline: "Sunrise trek", startDate: "2026-12-15",
      days: 2, price: 3600, difficulty: 4, slots: 12, trail: "Ambangeg",
      included: ["Van transport", "Hosted meals"], excluded: ["Personal gear"]
    }
  });
  assert.equal(hike.status, 201);
  assert.deepEqual(hike.body.hike.included, ["Van transport", "Hosted meals"]);
  assert.deepEqual(hike.body.hike.excluded, ["Personal gear"]);

  const state = await request("/api/state", { cookie: signup.cookie });
  assert.equal(state.body.user.role, "creator");
  assert.equal(state.body.craters.find(crater => crater.id === application.body.crater.id).name, "North Ridge Tours");
  assert.equal(state.body.hikes.find(item => item.id === hike.body.hike.id).c, application.body.crater.id);
});

test("customers can rate only completed hikes they booked and update the crater overall rating", async () => {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Hike Reviewer", email: "reviewer@example.test", password: "ReviewerPassword-123" }
  });
  const startDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const hikeResult = database.prepare(`
    INSERT INTO hikes (name, tagline, start_date, days, price, difficulty, slots, crater_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Mt. Apo", "Review test hike", startDate, 1, 1200, 3, 4, 1);
  const hikeId = Number(hikeResult.lastInsertRowid);
  const booking = await request("/api/bookings", {
    method: "POST", cookie: signup.cookie,
    body: { hikeId, hikers: 1, drone: false, tel: "09123456789" }
  });
  assert.equal(booking.status, 201);

  const tooEarly = await request(`/api/bookings/${booking.body.booking.id}/rating`, {
    method: "POST", cookie: signup.cookie, body: { value: 5 }
  });
  assert.equal(tooEarly.status, 400);

  const outsider = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Not Booked", email: "not-booked@example.test", password: "NotBookedPassword-123" }
  });
  const notTheirBooking = await request(`/api/bookings/${booking.body.booking.id}/rating`, {
    method: "POST", cookie: outsider.cookie, body: { value: 5 }
  });
  assert.equal(notTheirBooking.status, 404);

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  database.prepare("UPDATE hikes SET start_date = ? WHERE id = ?").run(yesterday, hikeId);
  const initialCrater = (await request("/api/state")).body.craters.find(crater => crater.id === 1);
  const rating = await request(`/api/bookings/${booking.body.booking.id}/rating`, {
    method: "POST", cookie: signup.cookie, body: { value: 5 }
  });
  assert.equal(rating.status, 200);

  let state = await request("/api/state", { cookie: signup.cookie });
  assert.equal(state.body.bookings.find(item => item.id === booking.body.booking.id).rating, 5);
  let crater = state.body.craters.find(item => item.id === 1);
  assert.deepEqual(crater.r, [initialCrater.r[0] + 5, initialCrater.r[1] + 1]);

  const updatedRating = await request(`/api/bookings/${booking.body.booking.id}/rating`, {
    method: "POST", cookie: signup.cookie, body: { value: 2 }
  });
  assert.equal(updatedRating.status, 200);
  state = await request("/api/state", { cookie: signup.cookie });
  crater = state.body.craters.find(item => item.id === 1);
  assert.equal(state.body.bookings.find(item => item.id === booking.body.booking.id).rating, 2);
  assert.deepEqual(crater.r, [initialCrater.r[0] + 2, initialCrater.r[1] + 1]);
});

test("only priced optional hike extras are charged and included drone shots are not sold again", async () => {
  const signup = await request("/api/auth/signup", {
    method: "POST",
    body: { name: "Add-on Customer", email: "addons@example.test", password: "AddonsPassword-123" }
  });
  const includedDrone = await request("/api/bookings", {
    method: "POST", cookie: signup.cookie,
    body: { hikeId: 5, hikers: 1, extras: ["Drone shot"], tel: "09123456789" }
  });
  assert.equal(includedDrone.status, 400);

  const unavailableDrone = await request("/api/bookings", {
    method: "POST", cookie: signup.cookie,
    body: { hikeId: 1, hikers: 1, extras: ["Solo drone shots/videos"], tel: "09123456789" }
  });
  assert.equal(unavailableDrone.status, 400);

  const booking = await request("/api/bookings", {
    method: "POST", cookie: signup.cookie,
    body: {
      hikeId: 9, hikers: 2,
      extras: ["Solo drone shots/videos", "Lunch"],
      tel: "09123456789"
    }
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.body.booking.total, (2499 + 150 + 250) * 2);
  assert.deepEqual(booking.body.booking.extras, [
    { name: "Solo drone shots/videos", price: 150 },
    { name: "Lunch", price: 250 }
  ]);
  assert.equal(booking.body.booking.drone, true);

  const state = await request("/api/state", { cookie: signup.cookie });
  assert.deepEqual(state.body.bookings[0].extras, booking.body.booking.extras);
  assert.equal(state.body.bookings[0].total, 5798);
});
