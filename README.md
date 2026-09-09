# Quad

Quad is a campus marketplace I'm building for students to run their small businesses. Students post the services they offer (tutoring, hair, photography, baked goods, repairs, and so on), other students browse and book them, and both sides build a reputation through ratings.

Everything is scoped to one university. The idea is proximity: because the person you're booking is on your own campus, they're closer, cheaper to reach, and easier to trust. Quad is opening at the University of Illinois Chicago first, so that is the only campus available for now.

## What it does

- Everything is scoped to one campus. Quad is open to UIC first, so there is no university to pick at sign-up, and you only see listings from your own campus.
- Create an account with a username (email optional) and log in with either. Browsing is open to guests; posting, booking, and reviewing need an account.
- Post listings with a title, description, price, category, and a photo. You can upload a file, drag one in, or paste an image straight from your clipboard.
- Browse and search listings on your campus.
- Pin where you'll meet when you post a listing: search for the address, then drag the pin if it isn't quite right. Browsers see how far each listing is from where they are. Same campus doesn't mean same walk: this is the difference between five minutes and thirty. You can pin a rough area instead of an exact spot, which is what I'd suggest if the pin is where you live.
- Open the times you're free on your calendar. Students booking any of your listings pick from those times, and a time closes across all of your listings once it's taken, since you can only be in one place at once.
- Request a booking by picking one of those open times. The provider can accept, decline, or mark it complete, and either side can cancel while it's still open. Declining or cancelling puts the time back on the calendar.
- Message any student on your campus. Threads are two-way and live next to your bookings, so you can sort out the details before or after you book.
- Leave a star rating and review for other students. Reviews work both ways, whether the person was the provider or the customer, and an overall rating shows on their profile.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | FastAPI (Python) |
| Frontend | React with Vite |
| Database | PostgreSQL (run in Docker for local dev) |
| ORM and migrations | SQLAlchemy and Alembic |
| Auth | JWT tokens, passwords hashed with bcrypt |
| Validation | Pydantic |
| Maps | Leaflet with OpenStreetMap tiles, Nominatim for address search (no API key needed) |

## Project structure

```
quaddle2026/
├── backend/                FastAPI application
│   ├── app/
│   │   ├── main.py         app entry point
│   │   ├── models/         SQLAlchemy database models
│   │   ├── schemas/        Pydantic request and response schemas
│   │   ├── routers/        API routes (auth, listings, bookings, reviews, ...)
│   │   ├── core/           config, security, shared dependencies
│   │   └── db/             database session and base
│   ├── alembic/            database migrations
│   ├── seed.py             loads the list of US universities
│   └── requirements.txt
├── frontend/               React application (Vite)
│   └── src/
│       ├── components/     reusable UI pieces
│       ├── pages/          one file per screen
│       ├── api/            API client
│       ├── context/        auth state
│       └── lib/            geo maths, the location hook, Leaflet setup
└── docker-compose.yml      PostgreSQL for local dev
```

## Getting started

You'll need Python 3.11+, Node.js 18+, and Docker.

### 1. Start the database

From the repo root:

```bash
docker compose up -d
```

This runs PostgreSQL in a container (on port 5433 so it won't clash with anything else you have).

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then fill in the values
alembic upgrade head              # create the tables
python seed.py                    # load the universities
uvicorn app.main:app --reload     # runs on http://localhost:8000
```

The interactive API docs are at http://localhost:8000/docs.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                       # runs on http://localhost:5173
```

## API overview

| Method | Endpoint | What it does |
|---|---|---|
| GET | /api/universities | The campus the app is open to |
| POST | /api/auth/register | Create an account |
| POST | /api/auth/login | Log in and get a token |
| GET | /api/users/me | The logged-in user's profile |
| GET | /api/users/{id} | A public profile with their rating |
| GET | /api/listings | Browse and search listings, defaulting to the active campus |
| POST | /api/listings | Post a listing |
| GET | /api/listings/{id} | View one listing |
| PATCH | /api/listings/{id} | Edit your listing |
| DELETE | /api/listings/{id} | Delete your listing |
| GET | /api/geocode?q={text} | Look up coordinates for a typed address |
| POST | /api/uploads/image | Upload a photo |
| GET | /api/availability?provider_id={id} | A provider's open, upcoming times |
| GET | /api/availability/mine | My own times, including the booked ones |
| POST | /api/availability | Open a time on my calendar |
| DELETE | /api/availability/{id} | Take an unbooked time off my calendar |
| POST | /api/bookings | Request a booking against an open time |
| GET | /api/bookings/mine | Bookings I requested |
| GET | /api/bookings/incoming | Bookings on my listings |
| PATCH | /api/bookings/{id} | Accept, decline, complete, or cancel |
| GET | /api/conversations | My inbox, with previews and unread counts |
| POST | /api/conversations | Open a thread with someone, or reopen it |
| GET | /api/conversations/unread-count | Unread total, for the nav badge |
| GET | /api/conversations/{id} | One thread |
| GET | /api/conversations/{id}/messages | The messages in a thread |
| POST | /api/conversations/{id}/messages | Send a message |
| POST | /api/conversations/{id}/read | Mark the other side's messages read |
| POST | /api/reviews | Leave a review |
| GET | /api/reviews?subject_id={id} | Reviews about a user |
| GET | /api/health | Confirm the API is up |

Everything the API serves sits under `/api`, which keeps it clear of the
frontend's own paths (`/listings/:id` and `/users/:id` exist on both sides).
Uploaded photos are the one exception: they stay on `/media/<filename>` because
listings already store that path in `image_url`.

A listing body carries an optional `latitude` and `longitude` pair plus a
`location_is_approximate` flag. The two coordinates have to be sent together,
and when the flag is set the API rounds them to three decimal places (roughly
100 m) before serving them. The precise pin stays in the database and never
goes out over the wire, which matters because guests can browse.

A note on the two map pieces, since they are easy to conflate. Leaflet is the
JavaScript that draws the map and handles pan, zoom, and markers. It carries no
map imagery of its own: the tiles come from OpenStreetMap, whose public tile
server needs no key but does require the attribution shown on the map. Swapping
to a different tile style is a two-constant change in `src/lib/leaflet.js`.

Address search runs through `GET /api/geocode` rather than straight from the
browser, for three reasons: Nominatim sends no CORS headers on a successful
reply, it rejects unidentified browser clients outright, and proxying keeps
students' IP addresses off a third party. The endpoint needs an account, since
only signed-in students post listings. It caches repeats in memory and spaces
calls a second apart to stay inside Nominatim's usage policy, so set
`GEOCODER_USER_AGENT` in `.env` to something with a real contact address.

The campus is configuration, not a user choice. `ACTIVE_CAMPUS_NAME` in
`backend/app/core/config.py` names the one university the app is open to, and it
has to match a row in the `universities` table exactly. `GET /api/universities`
returns only that row, registration on any other campus is rejected, and a guest
browsing without a `university_id` falls back to it. The full US catalog stays
seeded, so opening a second campus is a settings change rather than a migration.

Availability lives on the provider, not on the listing. A student can only be
in one place at a time, so taking Saturday at 2 pm for a haircut has to close
that window on their tutoring listing too. A booking holds its slot through a
unique constraint on `slot_id`, which is also what stops two customers taking
the same time in the same second. Declining or cancelling clears that column
instead of deleting the row, and because both PostgreSQL and SQLite allow
repeated nulls in a unique constraint, the time reopens on its own. The start
and end are copied onto the booking as well, so a declined booking can still
say which time was asked for after the slot has gone back on the calendar.

Times cross the wire as UTC with an offset and are rendered in the student's own
timezone. The API refuses a datetime without an offset rather than guessing
whose clock it came from, since a wrong guess is a no-show. There is one wart
worth knowing: SQLite has no timezone type, so it hands values back naive where
PostgreSQL returns them aware. `app/core/time.py` stamps UTC back on when that
happens, because a naive value serializes without an offset and the browser then
reads it as local time.

Messages poll rather than stream. The backend is deliberately synchronous, so
there is no websocket to hang a live thread off, and an open thread asking every
five seconds for anything newer than the last id it holds is cheap: an idle
thread answers with an empty list.

## Progress

- [x] Project setup: backend and frontend scaffolding, database, dev environment
- [x] Auth and universities: sign-up scoped to the active campus, login by username or email, JWT, profiles
- [x] Listings: post, edit, delete, browse, and search, scoped to campus, with photo upload
- [x] Ratings and reviews: two-way reviews between students on the same campus, overall rating on profiles
- [x] Locations and distance: pin a meeting spot on a map, walking distance from where you are, rough-area option
- [x] Bookings: providers open times, customers pick one, then accept, decline, complete, cancel
- [x] Messaging: two-way threads between students on the same campus
- [ ] Polish and deploy: cleanup, error handling, and getting it live

## A note on conventions


A few things I try to keep consistent across the codebase:

- Small, focused commits, one change at a time. No bundling unrelated work.
- No dead code. I don't leave commented-out blocks lying around "just in case."
- Comments explain why, not what. If the reason is obvious from the code, there's no comment.
- No emojis anywhere, and no em dashes in the docs. Just a plain, human voice.
- Config and secrets live in `.env`, never in the code.

## Author

Deborah Folorunsho
ffolo@uic.edu