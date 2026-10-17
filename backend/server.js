const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { craterAccounts, hikes: seedHikes } = require("./seed");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.HV_DB_PATH || path.join(DATA_DIR, "hikeventures.sqlite");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const SESSION_DAYS = 7;
const MAX_BODY_BYTES = 64 * 1024;
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createDatabase(filePath = DB_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'creator')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS craters (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      tel TEXT NOT NULL DEFAULT '',
      rating_points INTEGER NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      is_sample INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS hikes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      start_date TEXT NOT NULL,
      days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 10),
      price INTEGER NOT NULL CHECK (price > 0),
      difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 9),
      slots INTEGER NOT NULL CHECK (slots > 0),
      crater_id INTEGER REFERENCES craters(id) ON DELETE CASCADE,
      trail TEXT NOT NULL DEFAULT '',
      included_json TEXT NOT NULL DEFAULT '[]',
      excluded_json TEXT NOT NULL DEFAULT '[]',
      image TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hike_id INTEGER NOT NULL REFERENCES hikes(id) ON DELETE CASCADE,
      hikers INTEGER NOT NULL CHECK (hikers > 0),
      drone INTEGER NOT NULL DEFAULT 0 CHECK (drone IN (0, 1)),
      extras_json TEXT NOT NULL DEFAULT '[]',
      tel TEXT NOT NULL,
      total INTEGER NOT NULL CHECK (total > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ratings (
      crater_id INTEGER NOT NULL REFERENCES craters(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
      PRIMARY KEY (crater_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS hike_ratings (
      id INTEGER PRIMARY KEY,
      booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hike_id INTEGER NOT NULL REFERENCES hikes(id) ON DELETE CASCADE,
      value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hike_id INTEGER NOT NULL REFERENCES hikes(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_hike_idx ON bookings(hike_id);
    CREATE INDEX IF NOT EXISTS messages_creator_idx ON messages(creator_id, created_at);
    CREATE INDEX IF NOT EXISTS messages_customer_idx ON messages(customer_id, created_at);
  `);
  const bookingColumns = db.prepare("PRAGMA table_info(bookings)").all();
  if (!bookingColumns.some(column => column.name === "extras_json")) {
    db.exec("ALTER TABLE bookings ADD COLUMN extras_json TEXT NOT NULL DEFAULT '[]'");
  }
  db.prepare(`
    UPDATE hikes
    SET excluded_json = replace(excluded_json, ?, ?)
    WHERE name = 'Mt. Pinatubo'
      AND crater_id IN (SELECT id FROM craters WHERE is_sample = 1)
      AND excluded_json LIKE ?
  `).run(
    "Solo drone shots/videos (optional ₱300)",
    "Solo drone shots/videos (optional ₱150)",
    "%Solo drone shots/videos (optional ₱300)%"
  );
  try {
    seedDatabase(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBytes = Buffer.from(expected, "hex");
  return actual.length === expectedBytes.length && crypto.timingSafeEqual(actual, expectedBytes);
}

function seedDatabase(db) {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM craters WHERE is_sample = 1").get().count;
  if (existing) return;

  const insertUser = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'creator')");
  const insertCrater = db.prepare("INSERT INTO craters (id, owner_id, name, rating_points, rating_count, is_sample) VALUES (?, ?, ?, ?, ?, 1)");
  const insertHike = db.prepare(`
    INSERT INTO hikes (id, name, tagline, start_date, days, price, difficulty, slots, crater_id, trail, included_json, excluded_json, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const credentials = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    craterAccounts.forEach((account, index) => {
      const password = crypto.randomBytes(18).toString("base64url");
      const userResult = insertUser.run(account.name, account.email, passwordHash(password));
      const ownerId = Number(userResult.lastInsertRowid);
      const craterId = index + 1;
      insertCrater.run(craterId, ownerId, account.name, account.ratingPoints, account.ratingCount);
      credentials.push({ name: account.name, email: account.email, password });
    });
    seedHikes.forEach((hike, index) => {
      const id = index + 1;
      const imageName = ({
        "Mt. Apo": "mt_apo.png",
        "Mt. Pulag": "mt_pulag.png",
        "Mt. Guiting Guiting": "mt_g2.png",
        "Mt. Sembrano": "mt_sembrano.png",
        "Mt. Batulao": "mt_batulao.png",
        "Mt. Pico De Loro": "mt_picoDeLoro.png",
        "Mt. Pinatubo": "mt_pinatubo.png"
      })[hike.name];
      insertHike.run(id, hike.name, hike.tagline, hike.startDate, hike.days, hike.price, hike.difficulty, hike.slots, hike.craterId, hike.trail, JSON.stringify(hike.included), JSON.stringify(hike.excluded), imageName ? `asset/${imageName}` : "");
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  if (credentials.length) {
    console.log("\nCreated demo Crater Tourist accounts (save these credentials):");
    credentials.forEach(account => console.log(`${account.name} | ${account.email} | ${account.password}`));
    console.log("Passwords are stored as hashes and will not be shown again.\n");
  }
}

function parseCookies(req) {
  const result = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) result[part.slice(0, separator).trim()] = decodeURIComponent(part.slice(separator + 1).trim());
  }
  return result;
}

function requestIsSecure(req) {
  if (req.socket.encrypted) return true;
  return TRUST_PROXY && req.headers["x-forwarded-proto"]?.split(",")[0].trim().toLowerCase() === "https";
}

function sendJson(res, status, value, headers = {}) {
  const payload = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let oversized = false;
    req.on("data", chunk => {
      if (oversized) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (oversized) return reject(new HttpError(413, "Request body is too large."));
      if (!chunks.length) return resolve({});
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object.");
        resolve(value);
      } catch {
        reject(new HttpError(400, "Request body must be a valid JSON object."));
      }
    });
    req.on("error", reject);
  });
}

function validText(value, label, maxLength, { minLength = 1 } = {}) {
  if (typeof value !== "string") throw new HttpError(400, `${label} is required.`);
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new HttpError(400, `${label} must be between ${minLength} and ${maxLength} characters.`);
  }
  return normalized;
}

function validList(value, label) {
  if (!Array.isArray(value) || value.length > 50) throw new HttpError(400, `${label} must be a list of up to 50 items.`);
  return value.map(item => validText(item, `${label} item`, 160));
}

function optionalExtras(excluded) {
  return excluded.flatMap(item => {
    const match = item.match(/^(.*?)\s*\(optional\s*₱\s*([\d,]+)\s*\)$/i);
    if (!match) return [];
    const name = match[1].trim();
    const price = Number(match[2].replaceAll(",", ""));
    return name && Number.isSafeInteger(price) && price > 0 ? [{ name, price }] : [];
  });
}

function publicUser(row) {
  return row ? { id: row.id, name: row.name, email: row.email, role: row.role } : null;
}

function runTransaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function createApp({ db = createDatabase(), publicDir = PUBLIC_DIR } = {}) {
  const statements = {
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    userBySession: db.prepare(`
      SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `)
  };
  const api = async (req, res, url) => {
    const method = req.method;
    const endpoint = url.pathname;
    const body = method === "GET" || method === "HEAD" ? {} : await readJson(req);
    const cookies = parseCookies(req);
    const sessionToken = cookies.hv_session;
    const user = sessionToken ? statements.userBySession.get(crypto.createHash("sha256").update(sessionToken).digest("hex"), Date.now()) : null;
    const requireUser = () => {
      if (!user) throw new HttpError(401, "Sign in to continue.");
      return user;
    };
    const requireCreator = () => {
      const current = requireUser();
      if (current.role !== "creator") throw new HttpError(403, "Only a Crater Tourist can do that.");
      return current;
    };
    if (method !== "GET" && method !== "HEAD") {
      const origin = req.headers.origin;
      if (origin) {
        let originHost;
        try {
          const parsedOrigin = new URL(origin);
          if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.username || parsedOrigin.password) {
            throw new Error("Invalid origin.");
          }
          originHost = parsedOrigin.host;
        } catch {
          throw new HttpError(403, "Cross-origin requests are not allowed.");
        }
        const requestHost = (TRUST_PROXY && req.headers["x-forwarded-host"]
          ? req.headers["x-forwarded-host"].split(",")[0].trim()
          : req.headers.host).toLowerCase();
        if (originHost.toLowerCase() !== requestHost) throw new HttpError(403, "Cross-origin requests are not allowed.");
      }
    }

    if (endpoint === "/api/auth/signup" && method === "POST") {
      const name = validText(body.name, "Name", 80, { minLength: 2 });
      const email = validText(body.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
      if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) throw new HttpError(400, "Password must be 8 to 128 characters.");
      try {
        const result = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run(name, email, passwordHash(body.password));
        const created = statements.userById.get(Number(result.lastInsertRowid));
        return createSession(res, created);
      } catch (error) {
        if (String(error.message).includes("UNIQUE")) throw new HttpError(409, "An account with that email already exists.");
        throw error;
      }
    }
    if (endpoint === "/api/auth/login" && method === "POST") {
      const email = validText(body.email, "Email", 254).toLowerCase();
      const row = statements.userByEmail.get(email);
      if (!row || !verifyPassword(String(body.password || ""), row.password_hash)) throw new HttpError(401, "Email or password is incorrect.");
      return createSession(res, row);
    }
    if (endpoint === "/api/auth/logout" && method === "POST") {
      if (sessionToken) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(crypto.createHash("sha256").update(sessionToken).digest("hex"));
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    }
    if (endpoint === "/api/auth/me" && method === "GET") return sendJson(res, 200, { user: publicUser(user) });
    if (endpoint === "/api/state" && method === "GET") return sendJson(res, 200, loadState(db, user));
    if (endpoint === "/api/account/name" && method === "PATCH") {
      const current = requireUser(), name = validText(body.name, "Name", 80, { minLength: 2 });
      db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, current.id);
      return sendJson(res, 200, { user: publicUser(statements.userById.get(current.id)) });
    }
    if (endpoint === "/api/account/password" && method === "PATCH") {
      const current = requireUser();
      if (!verifyPassword(String(body.currentPassword || ""), current.password_hash)) throw new HttpError(400, "Current password is incorrect.");
      if (typeof body.newPassword !== "string" || body.newPassword.length < 8 || body.newPassword.length > 128) throw new HttpError(400, "New password must be 8 to 128 characters.");
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash(body.newPassword), current.id);
      if (sessionToken) db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(current.id, crypto.createHash("sha256").update(sessionToken).digest("hex"));
      return sendJson(res, 200, { ok: true });
    }
    if (endpoint === "/api/craters" && method === "POST") {
      const current = requireUser();
      if (current.role === "creator") throw new HttpError(409, "This account is already a Crater Tourist.");
      const name = validText(body.name, "Crater name", 80, { minLength: 3 });
      const tel = validText(body.tel, "Contact number", 20);
      if (!/^09\d{9}$/.test(tel)) throw new HttpError(400, "Enter a valid mobile number (09XXXXXXXXX).");
      try {
        const created = runTransaction(db, () => {
          const result = db.prepare("INSERT INTO craters (owner_id, name, tel) VALUES (?, ?, ?)").run(current.id, name, tel);
          db.prepare("UPDATE users SET role = 'creator' WHERE id = ?").run(current.id);
          return Number(result.lastInsertRowid);
        });
        return sendJson(res, 201, { crater: db.prepare("SELECT * FROM craters WHERE id = ?").get(created) });
      } catch (error) {
        if (String(error.message).includes("UNIQUE")) throw new HttpError(409, "That crater name is already taken.");
        throw error;
      }
    }
    if (endpoint === "/api/craters/me" && method === "DELETE") {
      const current = requireCreator();
      const profile = db.prepare("SELECT is_sample FROM craters WHERE owner_id = ?").get(current.id);
      if (!profile) throw new HttpError(404, "Crater Tourist profile not found.");
      if (profile.is_sample) throw new HttpError(403, "The five demo Crater Tourist profiles cannot be removed.");
      db.prepare("DELETE FROM craters WHERE owner_id = ?").run(current.id);
      db.prepare("UPDATE users SET role = 'customer' WHERE id = ?").run(current.id);
      return sendJson(res, 200, { ok: true });
    }
    if (endpoint === "/api/hikes" && method === "POST") {
      const current = requireCreator();
      const name = validText(body.name, "Mountain", 100);
      const tagline = validText(body.tagline, "Description", 240);
      const startDate = validText(body.startDate, "Start date", 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`))) throw new HttpError(400, "Enter a valid start date.");
      const days = integer(body.days, "Number of days", 1, 10);
      const price = integer(body.price, "Price", 1, 10000000);
      const difficulty = integer(body.difficulty, "Difficulty", 1, 9);
      const slots = integer(body.slots, "Slots", 1, 1000);
      const trail = typeof body.trail === "string" ? body.trail.trim().slice(0, 160) : "";
      const included = validList(body.included, "Included items");
      const excluded = validList(body.excluded, "Excluded items");
      const result = db.prepare(`
        INSERT INTO hikes (name, tagline, start_date, days, price, difficulty, slots, crater_id, trail, included_json, excluded_json, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM craters WHERE owner_id = ?), ?, ?, ?, ?)
      `).run(name, tagline, startDate, days, price, difficulty, slots, current.id, trail, JSON.stringify(included), JSON.stringify(excluded), imageFor(name));
      return sendJson(res, 201, { hike: hikeById(db, Number(result.lastInsertRowid)) });
    }
    const hikeDelete = endpoint.match(/^\/api\/hikes\/(\d+)$/);
    if (hikeDelete && method === "DELETE") {
      const current = requireCreator();
      const result = db.prepare("DELETE FROM hikes WHERE id = ? AND crater_id = (SELECT id FROM craters WHERE owner_id = ?)").run(Number(hikeDelete[1]), current.id);
      if (!result.changes) throw new HttpError(404, "Hike not found.");
      return sendJson(res, 200, { ok: true });
    }
    if (endpoint === "/api/bookings" && method === "POST") {
      const current = requireUser();
      const hikeId = integer(body.hikeId, "Hike", 1, Number.MAX_SAFE_INTEGER);
      const hikers = integer(body.hikers, "Number of hikers", 1, 100);
      const tel = validText(body.tel, "Contact number", 20);
      if (!/^09\d{9}$/.test(tel)) throw new HttpError(400, "Enter a valid mobile number (09XXXXXXXXX).");
      const hikeRow = db.prepare("SELECT * FROM hikes WHERE id = ?").get(hikeId);
      if (!hikeRow) throw new HttpError(404, "Hike not found.");
      if (body.drone === true) throw new HttpError(400, "Choose from the optional paid add-ons available for this hike.");
      if (hikeRow.start_date < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "This hike has already started.");
      const booked = db.prepare("SELECT COALESCE(SUM(hikers), 0) AS count FROM bookings WHERE hike_id = ?").get(hikeId).count;
      if (hikers > hikeRow.slots - booked) throw new HttpError(409, "There are not enough slots remaining.");
      const included = JSON.parse(hikeRow.included_json);
      const excluded = JSON.parse(hikeRow.excluded_json);
      const availableExtras = optionalExtras(excluded);
      if (body.extras !== undefined && (!Array.isArray(body.extras) || body.extras.some(name => typeof name !== "string"))) {
        throw new HttpError(400, "Choose valid optional add-ons.");
      }
      const requestedExtras = body.extras || [];
      if (new Set(requestedExtras).size !== requestedExtras.length) throw new HttpError(400, "An add-on can only be selected once.");
      const extras = requestedExtras.map(name => {
        const extra = availableExtras.find(item => item.name === name);
        if (!extra) throw new HttpError(400, "That paid add-on is not available for this hike.");
        if (/drone/i.test(name) && included.some(item => /drone/i.test(item))) {
          throw new HttpError(400, "Drone shots are already included in this hike.");
        }
        return extra;
      });
      const drone = extras.some(extra => /drone/i.test(extra.name));
      const total = (hikeRow.price + extras.reduce((sum, extra) => sum + extra.price, 0)) * hikers;
      const result = db.prepare("INSERT INTO bookings (user_id, hike_id, hikers, drone, extras_json, tel, total) VALUES (?, ?, ?, ?, ?, ?, ?)").run(current.id, hikeId, hikers, Number(drone), JSON.stringify(extras), tel, total);
      return sendJson(res, 201, { booking: { id: Number(result.lastInsertRowid), hike: hikeId, n: hikers, drone, extras, tel, total } });
    }
    const bookingDelete = endpoint.match(/^\/api\/bookings\/(\d+)$/);
    if (bookingDelete && method === "DELETE") {
      const current = requireUser(), bookingId = Number(bookingDelete[1]);
      const result = db.prepare(`
        DELETE FROM bookings WHERE id = ? AND user_id = ?
        AND hike_id IN (SELECT id FROM hikes WHERE start_date >= date('now', 'localtime'))
      `).run(bookingId, current.id);
      if (!result.changes) throw new HttpError(404, "Current booking not found.");
      return sendJson(res, 200, { ok: true });
    }
    const bookingRating = endpoint.match(/^\/api\/bookings\/(\d+)\/rating$/);
    if (bookingRating && method === "POST") {
      const current = requireUser(), value = integer(body.value, "Rating", 1, 5), bookingId = Number(bookingRating[1]);
      const booking = db.prepare(`
        SELECT bookings.id, hikes.id AS hike_id, hikes.start_date, hikes.days
        FROM bookings JOIN hikes ON hikes.id = bookings.hike_id
        WHERE bookings.id = ? AND bookings.user_id = ?
      `).get(bookingId, current.id);
      if (!booking) throw new HttpError(404, "Booking not found.");
      const lastHikeDay = new Date(`${booking.start_date}T00:00:00Z`);
      lastHikeDay.setUTCDate(lastHikeDay.getUTCDate() + booking.days - 1);
      if (lastHikeDay.toISOString().slice(0, 10) >= new Date().toISOString().slice(0, 10)) {
        throw new HttpError(400, "You can rate this hike after it has ended.");
      }
      db.prepare(`
        INSERT INTO hike_ratings (booking_id, user_id, hike_id, value) VALUES (?, ?, ?, ?)
        ON CONFLICT(booking_id) DO UPDATE SET value = excluded.value, created_at = CURRENT_TIMESTAMP
      `).run(booking.id, current.id, booking.hike_id, value);
      return sendJson(res, 200, { ok: true, value });
    }
    if (endpoint === "/api/messages" && method === "POST") {
      const current = requireUser();
      const craterId = integer(body.craterId, "Crater Tourist", 1, Number.MAX_SAFE_INTEGER);
      const hikeId = integer(body.hikeId, "Hike", 1, Number.MAX_SAFE_INTEGER);
      const text = validText(body.message, "Message", 2000);
      const craterRow = db.prepare("SELECT * FROM craters WHERE id = ?").get(craterId);
      if (!craterRow || !craterRow.owner_id) throw new HttpError(404, "This Crater Tourist does not have a messaging account.");
      const hikeRow = db.prepare("SELECT * FROM hikes WHERE id = ? AND crater_id = ?").get(hikeId, craterId);
      if (!hikeRow) throw new HttpError(400, "Choose a hike belonging to this Crater Tourist.");
      if (craterRow.owner_id === current.id) throw new HttpError(400, "You cannot message your own crater account.");
      const result = db.prepare("INSERT INTO messages (creator_id, customer_id, hike_id, sender_id, body) VALUES (?, ?, ?, ?, ?)").run(craterRow.owner_id, current.id, hikeId, current.id, text);
      return sendJson(res, 201, { id: Number(result.lastInsertRowid) });
    }
    if (endpoint === "/api/messages" && method === "GET") {
      const current = requireUser();
      const messages = current.role === "creator"
        ? db.prepare(messageQuery("creator_id")).all(current.id)
        : db.prepare(messageQuery("customer_id")).all(current.id);
      return sendJson(res, 200, { messages });
    }
    const reply = endpoint.match(/^\/api\/messages\/(\d+)\/reply$/);
    if (reply && method === "POST") {
      const current = requireUser(), text = validText(body.message, "Message", 2000);
      const original = db.prepare("SELECT creator_id, customer_id, hike_id FROM messages WHERE id = ?").get(Number(reply[1]));
      if (!original || (original.creator_id !== current.id && original.customer_id !== current.id)) throw new HttpError(404, "Message not found.");
      const result = db.prepare("INSERT INTO messages (creator_id, customer_id, hike_id, sender_id, body) VALUES (?, ?, ?, ?, ?)").run(original.creator_id, original.customer_id, original.hike_id, current.id, text);
      return sendJson(res, 201, { id: Number(result.lastInsertRowid) });
    }
    throw new HttpError(404, "API endpoint not found.");

    function createSession(response, account) {
      const token = crypto.randomBytes(32).toString("base64url");
      const expiry = Date.now() + SESSION_DAYS * 86400000;
      db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(crypto.createHash("sha256").update(token).digest("hex"), account.id, expiry);
      const secure = requestIsSecure(req) ? "; Secure" : "";
      return sendJson(response, 200, { user: publicUser(account) }, {
        "Set-Cookie": `hv_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`
      });
    }
  };

  async function handle(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (!["GET", "HEAD"].includes(req.method)) throw new HttpError(405, "Method not allowed.");
      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const file = path.resolve(publicDir, `.${requested}`);
      if (!file.startsWith(`${path.resolve(publicDir)}${path.sep}`)) throw new HttpError(403, "Forbidden.");
      let stat;
      try { stat = fs.statSync(file); } catch { throw new HttpError(404, "File not found."); }
      if (!stat.isFile()) throw new HttpError(404, "File not found.");
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Content-Length": stat.size,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache"
      });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error("Backend request failed:", error);
      if (!res.headersSent) sendJson(res, status, { error: status === 500 ? "An internal server error occurred." : error.message });
      else res.destroy(error);
    }
  }

  return http.createServer(handle);
}

function integer(value, label, min, max) {
  if (!Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new HttpError(400, `${label} must be a whole number from ${min} to ${max}.`);
  return Number(value);
}

function imageFor(name) {
  const files = {
    "Mt. Apo": "mt_apo.png", "Mt. Pulag": "mt_pulag.png",
    "Mt. Guiting Guiting": "mt_g2.png", "Mt. Sembrano": "mt_sembrano.png",
    "Mt. Batulao": "mt_batulao.png", "Mt. Pico De Loro": "mt_picoDeLoro.png",
    "Mt. Pinatubo": "mt_pinatubo.png"
  };
  return files[name] ? `asset/${files[name]}` : "";
}

function hikeById(db, id) {
  const row = db.prepare("SELECT * FROM hikes WHERE id = ?").get(id);
  return row && mapHike(db, row);
}

function mapHike(db, row) {
  const booked = db.prepare("SELECT COALESCE(SUM(hikers), 0) AS count FROM bookings WHERE hike_id = ?").get(row.id).count;
  return {
    id: row.id, n: row.name, t: row.tagline, d: row.start_date, days: row.days, p: row.price,
    lv: row.difficulty, slots: row.slots, c: row.crater_id, tr: row.trail,
    included: JSON.parse(row.included_json), excluded: JSON.parse(row.excluded_json),
    img: row.image, booked
  };
}

function messageQuery(field) {
  return `
    SELECT messages.id, messages.creator_id AS creatorId, messages.customer_id AS customerId,
      messages.hike_id AS hikeId, messages.sender_id AS senderId, messages.body,
      messages.created_at AS createdAt, sender.name AS senderName, sender.role AS senderRole,
      customers.name AS customerName, customers.email AS customerEmail,
      craters.name AS craterName, hikes.name AS hikeName
    FROM messages
    JOIN users AS customers ON customers.id = messages.customer_id
    JOIN users AS sender ON sender.id = messages.sender_id
    JOIN craters ON craters.owner_id = messages.creator_id
    JOIN hikes ON hikes.id = messages.hike_id
    WHERE messages.${field} = ?
    ORDER BY messages.created_at ASC, messages.id ASC
  `;
}

function loadState(db, user) {
  const craters = db.prepare(`
    SELECT craters.id, craters.name, craters.owner_id, craters.rating_points, craters.rating_count,
      users.email AS owner_email,
      COALESCE((SELECT SUM(ratings.value) FROM ratings WHERE ratings.crater_id = craters.id), 0) AS user_points,
      (SELECT COUNT(*) FROM ratings WHERE ratings.crater_id = craters.id) AS user_count,
      COALESCE((
        SELECT SUM(hike_ratings.value) FROM hike_ratings
        JOIN hikes ON hikes.id = hike_ratings.hike_id
        WHERE hikes.crater_id = craters.id
      ), 0) AS hike_points,
      (
        SELECT COUNT(*) FROM hike_ratings
        JOIN hikes ON hikes.id = hike_ratings.hike_id
        WHERE hikes.crater_id = craters.id
      ) AS hike_count
    FROM craters LEFT JOIN users ON users.id = craters.owner_id
    ORDER BY craters.id
  `).all().map(row => ({
    id: row.id, name: row.name, owner: row.owner_email,
    r: [row.rating_points + row.user_points + row.hike_points, row.rating_count + row.user_count + row.hike_count]
  }));
  const hikes = db.prepare("SELECT * FROM hikes ORDER BY start_date, id").all().map(row => mapHike(db, row));
  const bookings = user ? db.prepare(`
    SELECT bookings.id, bookings.hike_id AS hike, bookings.hikers AS n, bookings.drone, bookings.extras_json AS extrasJson,
      bookings.tel, bookings.total, hike_ratings.value AS rating
    FROM bookings LEFT JOIN hike_ratings ON hike_ratings.booking_id = bookings.id
    WHERE bookings.user_id = ? ORDER BY bookings.id DESC
  `).all(user.id).map(row => {
    const { extrasJson, ...booking } = row;
    return { ...booking, drone: !!row.drone, extras: JSON.parse(extrasJson) };
  }) : [];
  return { user: publicUser(user), craters, hikes, bookings };
}

function clearSessionCookie() {
  return "hv_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

if (require.main === module) {
  const db = createDatabase();
  const server = createApp({ db });
  server.listen(PORT, HOST, () => console.log(`Hikeventures backend listening at http://${HOST}:${PORT}`));
}

module.exports = { createApp, createDatabase, HttpError, loadState, passwordHash, verifyPassword };
