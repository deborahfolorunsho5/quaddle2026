# Quaddle

Quaddle is a campus marketplace I'm building for students to run their small businesses. Students post the services they offer (tutoring, hair, photography, baked goods, repairs, and so on), other students browse and book them, and both sides build a reputation through ratings.

Everything is scoped to your university. The idea is proximity: because the person you're booking is on your own campus, they're closer, cheaper to reach, and easier to trust.

## What it does

- Pick your university when you sign up, and you only see listings from your own campus.
- Create an account with a username (email optional) and log in with either. Browsing is open to guests; posting, booking, and reviewing need an account.
- Post listings with a title, description, price, category, and a photo. You can upload a file, drag one in, or paste an image straight from your clipboard.
- Browse and search listings on your campus.
- Request a booking on a listing. The provider can accept, decline, or mark it complete, and either side can cancel while it's still open.
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
│       └── context/        auth state
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
| GET | /universities | List universities for the sign-up picker |
| POST | /auth/register | Create an account |
| POST | /auth/login | Log in and get a token |
| GET | /users/me | The logged-in user's profile |
| GET | /users/{id} | A public profile with their rating |
| GET | /listings | Browse and search listings on a campus |
| POST | /listings | Post a listing |
| GET | /listings/{id} | View one listing |
| PATCH | /listings/{id} | Edit your listing |
| DELETE | /listings/{id} | Delete your listing |
| POST | /uploads/image | Upload a photo |
| POST | /bookings | Request a booking |
| GET | /bookings/mine | Bookings I requested |
| GET | /bookings/incoming | Bookings on my listings |
| PATCH | /bookings/{id} | Accept, decline, complete, or cancel |
| POST | /reviews | Leave a review |
| GET | /reviews?subject_id={id} | Reviews about a user |

## Progress

- [x] Project setup: backend and frontend scaffolding, database, dev environment
- [x] Auth and universities: sign-up with a university, login by username or email, JWT, profiles
- [x] Listings: post, edit, delete, browse, and search, scoped to campus, with photo upload
- [x] Ratings and reviews: two-way reviews between students on the same campus, overall rating on profiles
- [~] Bookings: request, accept, decline, complete, cancel (API done and tested, frontend in progress)
- [ ] Polish and deploy: cleanup, error handling, and getting it live

## A note on conventions

No emojis anywhere in the code: not in source files, strings, UI text, log messages, or commit messages. Plain words instead.

## Author

Deborah Folorunsho
ffolo@uic.edu