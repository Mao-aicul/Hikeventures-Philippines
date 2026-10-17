# Hikeventures backend

The backend uses Node.js' built-in HTTP server and SQLite support. Server code and the SQLite database are outside `public/`; the database is created at `backend/data/hikeventures.sqlite` on first startup.

## Requirements and startup

- Node.js 22.5 or newer (`node:sqlite` is built in).
- From the project root, run `npm start`, then open `http://127.0.0.1:3000`.
- Do not open `public/index.html` directly or use a separate static-only web server; browser API requests must use this same-origin server.

The first startup creates five demo Crater Tourist accounts and their sample hikes. It prints each account's email and a random initial password once in the server terminal. Save those credentials; passwords are stored only as salted hashes and are not printed on later starts.

## API overview

- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/state` returns the current account, crater profiles, hikes, and the signed-in customer's bookings, including any hike ratings.
- `POST /api/craters` applies the signed-in customer account as a Crater Tourist.
- `POST /api/hikes`, `DELETE /api/hikes/:id`
- `POST /api/bookings`, `DELETE /api/bookings/:id`
- `POST /api/bookings/:id/rating` lets the customer who made a booking rate or update their rating after the hike has ended.
- `POST /api/messages`, `GET /api/messages`, `POST /api/messages/:id/reply`

Sessions are opaque, HTTP-only cookies. Passwords are stored as salted scrypt hashes. Customers can message the Crater Tourist responsible for a hike, and both participants can continue the conversation from their account inboxes.

Customers can rate only hikes that they booked and that have already ended. Each booking can have one editable rating from 1 to 5 stars. Ratings are included in the responsible Crater Tourist's overall rating.

Set `PORT` to choose another port, or `HV_DB_PATH` to select a different SQLite database file.

## Hosting

The repository includes a Render Blueprint in `render.yaml`. Push the project to GitHub, then in Render choose **New > Blueprint** and connect the repository. Render will create a Free web service using the configuration in that file.

The service uses `HOST=0.0.0.0`, Render's assigned `PORT`, and `TRUST_PROXY=true` for HTTPS behind Render's reverse proxy.

**Free-tier limitation:** Render Free web services have an ephemeral filesystem and spin down after inactivity. The SQLite database, accounts, bookings, messages, and other changes can be lost when the service spins down, restarts, or redeploys. Treat the free deployment as a demo only; do not use it for important or production data. A fresh database creates the five demo accounts with new random passwords, printed once in the service logs. Local demo credentials do not carry over.
