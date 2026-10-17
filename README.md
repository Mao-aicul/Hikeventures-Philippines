# Hikeventures Philippines

Student Name: Maureen Lucia P. Quizon
Project Category: Tourism and Hiking Trip Booking Website

## Description

Hikeventures Philippines is a hiking and tourism website for discovering mountain trips and Crater Tourist organizers in the Philippines. Visitors can browse hikes, compare trip details, and explore organizer profiles. Registered customers can book hikes and communicate with the Crater Tourist responsible for a trip. Crater Tourists can manage their hikes and respond to customer messages.

## Features

- Browse featured hikes and mountain destinations.
- Filter hikes by difficulty and view trip dates, prices, available slots, and package inclusions and exclusions.
- Explore Crater Tourist profiles, ratings, and hosted hikes.
- Create an account, sign in, and manage account details.
- Book hikes and view bookings.
- Rate a booked hike after it ends; each review contributes to its Crater Tourist's overall rating.
- Apply to become a Crater Tourist and publish hikes.
- Send and receive messages with Crater Tourists through account inboxes.
- Persist accounts, hikes, bookings, ratings, and messages in a SQLite database.

## Technologies

- HTML
- CSS
- JavaScript
- Node.js built-in HTTP server and SQLite support (`node:sqlite`)
- SQLite

## Run the project

Requirements: Node.js 22.5 or newer.

From the project root, run:

```sh
npm start
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000) in a browser. Use the server rather than opening `public/index.html` directly so the website can access the backend.

On first startup, the server creates five demo Crater Tourist accounts and prints their initial passwords in the terminal. Save those credentials; passwords are stored as hashes and are not printed again.

## Run tests

```sh
npm test
```

For backend setup details and the API overview, see [backend/README.md](backend/README.md).

For a free online demo, this project includes a Render Blueprint in [render.yaml](render.yaml). Connect the GitHub repository in Render and create a Blueprint deployment. The free service uses an ephemeral filesystem, so the SQLite database and its data can be reset after spin-downs, restarts, or redeployments. See [backend/README.md](backend/README.md#hosting) before deploying.
