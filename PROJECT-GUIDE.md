# Hikeventures Philippines — Website and Project Guide

## Project overview

**Hikeventures Philippines** is a tourism and hiking-trip booking website focused on Philippine mountain destinations. Visitors can browse upcoming hikes, compare trip details, explore the organizers (called **Crater Tourists** in the project), and contact an organizer. Registered customers can reserve places on hikes, manage their account and bookings, and review a hike after it has ended. A customer can also apply to become a Crater Tourist and publish hikes.

The website is a student project by **Maureen Lucia P. Quizon**, in the **Tourism and Hiking Trip Booking Website** category.

## Goals

- Make hiking destinations and scheduled trips easy to discover.
- Show useful details before a customer reserves: dates, duration, difficulty, price, available slots, trail, and package inclusions and exclusions.
- Give each organizer a profile and a place to publish and manage hikes.
- Let customers reserve a trip and communicate with its organizer through the website.
- Collect post-trip ratings that help visitors compare organizers.

## Who uses the website?

### Visitor

Visitors do not need an account to browse the home page, filter destinations, inspect hike details, or view Crater Tourist profiles and ratings. They must sign in or create an account before booking, messaging, or applying to become a Crater Tourist.

### Customer

A customer can:

- Create an account and sign in.
- Reserve an upcoming hike for one or more hikers, subject to available capacity.
- Select any paid add-ons offered for that hike.
- View upcoming and past bookings and cancel an eligible upcoming booking.
- Message the Crater Tourist responsible for a hike and reply to messages from the account inbox.
- Rate a hike they booked after the trip has ended; they can update that rating later.
- Change their account name or password.
- Apply to become a Crater Tourist.

### Crater Tourist

A Crater Tourist is a customer account that has applied to publish and manage hikes. In the current implementation, applications are **automatically approved** after the user supplies a unique group name and valid Philippine mobile number. A Crater Tourist can:

- Add hikes from the supported mountain list.
- Set a hike's description, date, duration, price, difficulty, capacity, trail, inclusions, and exclusions.
- Remove hikes they own.
- Read and reply to customer conversations in the account inbox.
- Change their account name or password.
- Remove their Crater Tourist profile and return to the customer role. Removing the profile also removes its hikes.

## Main pages and navigation

The single-page website uses hash navigation:

- **Home** — a featured hero, a selection of upcoming hikes ordered by date, and featured organizers.
- **Mountain** — upcoming hikes with difficulty filters and additional filters for minimum/maximum budget, month, and trip duration.
- **Crater Tourist** — organizer cards with average ratings and hosted hikes; selecting a card opens its profile.
- **Sign-in/Login** — login and account registration forms.
- **My Booking** — signed-in customer's upcoming and past reservations.
- **My Account** — account settings, messages, and, for Crater Tourists, hike management.

Hike cards include the mountain, date, price per hiker, duration and trail (when provided), difficulty, remaining slots, and buttons for more information or booking. Hike detail views show package inclusions and exclusions and the responsible organizer when available.

## How a booking works

1. A visitor selects a hike and chooses **Book Now**. If they are not signed in, they are directed to login.
2. The customer chooses the number of hikers, provides a mobile number in `09XXXXXXXXX` format, and selects any available paid add-ons.
3. The website calculates the total as **(price per hiker + selected add-on prices) × number of hikers**.
4. The server checks that the hike exists, has not started, has enough remaining slots, and that each requested add-on is allowed for that hike.
5. If valid, the reservation is saved and appears in **My Booking**.
6. There is **no online payment processing**. The customer and Crater Tourist arrange payment outside the booking flow; the booking form tells the customer that the organizer will contact them to settle payment before the hike.
7. A customer can cancel a reservation for a hike that has not started. Completed trips appear under past bookings.
8. After the last day of the trip, the customer who made the booking can submit a 1–5 star rating for that booking and update it later. A booking can have one rating; organizer averages include seeded sample ratings and customer ratings for completed hikes.

Paid add-ons are derived from hike exclusion entries specifically written in the form `Name (optional ₱150)`. The server checks add-on names and prices against the hike's saved data rather than trusting the price sent by the browser. An included drone package cannot be sold again as a paid drone add-on.

## How messaging works

Signed-in customers can start a conversation from a hike's detail view with that hike's Crater Tourist. Messages are associated with the customer, organizer, and hike. Both participants can read and reply to the thread in **My Account**. Messages stay inside the website; the project does not send email or SMS notifications.

## Sample content

On first database initialization, the backend creates five sample Crater Tourist profiles and thirteen sample hikes. The sample destinations are:

- Mt. Apo
- Mt. Pulag
- Mt. Guiting Guiting
- Mt. Sembrano
- Mt. Batulao
- Mt. Pico De Loro
- Mt. Pinatubo

Sample dates, prices, trip lengths, difficulty scores, capacities, package details, and organizer ratings are provided in the seed data. Sample account passwords are generated randomly and printed to the server log **only when the sample accounts are first created**. They are stored as password hashes, so the original password cannot be recovered from the database. A fresh hosted database generates new passwords.

## How the application works

The browser loads HTML, CSS, JavaScript, and image assets from the Node.js web server. The frontend requests application data and performs account, booking, rating, and messaging actions through same-origin `/api/...` endpoints. The backend validates requests, applies business rules, and reads or writes SQLite data. The frontend refreshes state from the backend to display updated bookings, hike availability, profile ratings, and inbox threads.

### Technology

- **Frontend:** HTML, CSS, and browser JavaScript; no frontend framework.
- **Backend:** Node.js built-in HTTP server.
- **Database:** SQLite through Node's built-in `node:sqlite` API.
- **Password hashing:** Node's built-in `crypto.scrypt` with a random salt.
- **Deployment:** Render web service configured with a Blueprint.
- **Runtime requirement:** Node.js 22.5 or newer locally; the Blueprint selects Node.js 24.21.0.

### Repository layout

```text
public/                 Website HTML, CSS, browser JavaScript, and images
backend/server.js       HTTP server, API routes, validation, and database setup
backend/seed.js         Sample organizers and hike data
backend/server.test.js  Automated backend tests
backend/data/           Local SQLite database files (ignored by Git)
package.json            Run, development, and test scripts
render.yaml             Render deployment configuration
README.md               Short project introduction and setup instructions
```

### Data stored

The SQLite database stores:

- User accounts, roles, and password hashes.
- Crater Tourist profiles and their sample or user-created hikes.
- Hike dates, package details, prices, difficulty, and available capacity.
- Customer bookings, selected add-ons, contact numbers, and totals.
- Ratings associated with completed bookings, plus sample/legacy organizer rating totals.
- Customer–organizer messages and replies.
- Hashed session tokens and their expiration times.

The server creates the database and required tables when it starts. On local development it uses `backend/data/hikeventures.sqlite` by default. `HV_DB_PATH` can select another location.

## API overview

The frontend communicates with the backend using JSON:

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create a customer account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out and clear the session cookie |
| `GET` | `/api/auth/me` | Get the current signed-in account |
| `GET` | `/api/state` | Load public hikes and organizer profiles, plus the current user's bookings |
| `PATCH` | `/api/account/name` | Change the signed-in user's name |
| `PATCH` | `/api/account/password` | Change password after verifying the current password |
| `POST` | `/api/craters` | Apply to become a Crater Tourist |
| `DELETE` | `/api/craters/me` | Remove the signed-in user's Crater Tourist profile |
| `POST` | `/api/hikes` | Create a hike as the signed-in Crater Tourist |
| `DELETE` | `/api/hikes/:id` | Remove a hike owned by the signed-in Crater Tourist |
| `POST` | `/api/bookings` | Reserve hike places |
| `DELETE` | `/api/bookings/:id` | Cancel an eligible booking belonging to the signed-in customer |
| `POST` | `/api/bookings/:id/rating` | Submit or update a rating for an ended, booked hike |
| `POST` | `/api/messages` | Start a message thread about a hike |
| `GET` | `/api/messages` | List the signed-in user's message threads |
| `POST` | `/api/messages/:id/reply` | Reply to a thread in which the user participates |

## Security and validation

- Passwords are stored as salted scrypt hashes, not plaintext.
- Sessions use random tokens; only token hashes are stored in SQLite. The browser cookie is HTTP-only, SameSite=Lax, and Secure when the request is HTTPS.
- Account-only actions require a valid session, and ownership is checked before changing or deleting hikes, bookings, and messages.
- The server validates account fields, contact number format, date ranges, price, difficulty, slots, booking capacity, add-on availability, and rating values.
- Write requests with an `Origin` header are checked against the request host. When `TRUST_PROXY=true`, the server uses the forwarded host provided by the trusted hosting proxy. This supports same-host HTTPS traffic behind Render while rejecting a different origin host.
- User-provided text is escaped by the frontend before it is inserted into generated page markup.

## Run locally

Install Node.js 22.5 or newer, open PowerShell in the project root, and run:

```powershell
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Do not open `public/index.html` directly: the browser needs the same-origin backend API.

For automatic restarts while developing:

```powershell
npm run dev
```

To run the backend test suite:

```powershell
npm test
```

The server accepts `PORT` to change its listening port and `HV_DB_PATH` to choose a database path. It binds to `0.0.0.0` by default so it can receive traffic on a hosted web service.

## Deploy on Render

The `render.yaml` Blueprint configures a free Node web service with:

- Build command: `npm install`
- Start command: `npm start`
- Node.js: `24.21.0`
- `HOST=0.0.0.0`
- `TRUST_PROXY=true`

To deploy, connect the GitHub repository `Mao-aicul/Hikeventures-Philippines` in Render using **New → Blueprint**, then create the service. Render supplies the `PORT` variable; the server listens on that assigned port. After a successful deploy, use the public URL Render gives the service.

**Important hosting limitation:** the free service's filesystem is ephemeral and the service may spin down. SQLite data—including new accounts, reservations, messages, and ratings—can be lost when the service restarts, spins down, or redeploys. Treat this deployment as a demo, not storage for important or production data. A new database seeds the sample hikes and creates new random sample-account passwords, which are printed once in the service logs.

## Current limitations and future opportunities

- No online payment gateway, refunds, or payment-status tracking.
- Crater Tourist applications are auto-approved; there is no administrative approval dashboard.
- Messages are in-app only; no email, SMS, or push notifications.
- Render's free ephemeral disk is not suitable for durable user data.
- Future improvements could include persistent managed storage, administrator moderation, payment integration, notifications, richer organizer contact details, and additional automated browser/accessibility testing.

