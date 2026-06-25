<div align="center">

# 🎓 Quaddle

### A campus marketplace where students turn their side hustles into bookable businesses.

Students post the services they offer — tutoring, hair, photography, baked goods, repairs — other students browse and book them, and both sides build a reputation through ratings. **Everything is scoped to your university**, so the people you book are on the same campus: closer, cheaper to reach, and easier to trust.

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Status](https://img.shields.io/badge/status-in%20active%20development-yellow)]()

**[Live Demo](#) · [API Docs](#) · [Report Bug](../../issues)**

</div>

---

## 📸 Demo

> _Screenshots and a live demo link land here as features ship. Replace the placeholder below with a short GIF of the core flow — it's the single most effective thing on a project README._

<div align="center">

`[ demo GIF / screenshots coming soon ]`

</div>

---

## ✨ What it does

- **🏫 Campus-scoped** — students pick their university at sign-up, and the marketplace only shows listings from their own campus. Proximity is the whole point: the people you book are right there with you.
- **🔐 Authentication** — secure register / login with hashed passwords and JWT-based sessions, plus editable student profiles tied to a university.
- **🛍️ Listings** — providers create, edit, and delete service listings with pricing and images; students browse and search within their campus.
- **📅 Bookings** — customers request a service and providers accept or decline, with bookings moving through a full lifecycle (`pending → accepted → completed / cancelled`).
- **⭐ Ratings & reviews** — after a completed booking, both parties leave a star rating and review; average ratings surface on each profile to build trust.

---

## 🛠️ Built with

| Layer | Technology | Why |
|---|---|---|
| **Backend** | FastAPI (async Python) | Type-safe, auto-documented REST API with high performance |
| **Frontend** | React + Vite | Fast, component-driven SPA |
| **Database** | SQLite (dev) → PostgreSQL (prod) | Zero-config locally, production-grade in deployment |
| **ORM / Migrations** | SQLAlchemy + Alembic | Versioned, reproducible schema changes |
| **Auth** | JWT + bcrypt | Stateless sessions, industry-standard password hashing |
| **Validation** | Pydantic | Strict request/response schemas |

---

## 💡 Engineering highlights

What this project demonstrates beyond "it works":

- **Full-stack ownership** — designed and built both a JSON API and the client that consumes it, including the API contract between them.
- **Real authentication & authorization** — JWT issuance/verification, password hashing, and route protection (not a fake login).
- **Domain modeling** — a booking lifecycle with enforced state transitions, and a review system gated on completed bookings to prevent fake ratings.
- **Relational data design** — universities, users, listings, bookings, and reviews modeled with foreign-key relationships and migrations.
- **Campus scoping** — listings and bookings are filtered by the user's university, the foundation of a per-campus marketplace.
- **Auto-generated, interactive API documentation** via FastAPI's OpenAPI/Swagger UI.

---

## 🏗️ Architecture

```
quaddle2026/
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py         # FastAPI entry point
│   │   ├── models/         # SQLAlchemy database models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── routers/        # API routes (auth, listings, bookings, reviews)
│   │   ├── core/           # config, security, dependencies
│   │   └── db/             # database session & setup
│   ├── alembic/            # database migrations
│   └── requirements.txt
└── frontend/               # React application (Vite)
    └── src/
        ├── components/     # reusable UI components
        ├── pages/          # route-level pages
        ├── api/            # API client / fetch helpers
        └── context/        # auth context, global state
```

---

## 🚀 Getting started

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head             # set up the database
uvicorn app.main:app --reload    # http://localhost:8000
```
Interactive API docs auto-generate at `http://localhost:8000/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

---

## 📡 API overview

| Method | Endpoint | Description |
|---|---|---|
| `GET`  | `/universities` | List supported universities (for the sign-up picker) |
| `POST` | `/auth/register` | Create an account (with chosen university) |
| `POST` | `/auth/login` | Log in, receive a JWT |
| `GET`  | `/users/me` | Get the current user's profile |
| `GET`  | `/listings` | Browse / search listings on your campus |
| `POST` | `/listings` | Create a listing (provider) |
| `GET`  | `/listings/{id}` | View a single listing |
| `POST` | `/bookings` | Request a booking |
| `PATCH`| `/bookings/{id}` | Accept / decline / update status |
| `POST` | `/reviews` | Leave a rating after a completed booking |

---

## 🗺️ Roadmap

Built in vertical slices so there's always something demoable.

- [x] **Phase 0 — Setup:** repo structure, FastAPI + React scaffolding, dev environment, health-check wired end-to-end
- [x] **Phase 1 — Auth & universities:** university picker at sign-up, register/login (username or email), bcrypt hashing, JWT, protected routes, profiles
- [x] **Phase 2 — Listings:** create/edit/delete (owner-only), browse + search scoped to campus, guest browsing (image *uploads* deferred — `image_url` field for now)
- [ ] **Phase 3 — Bookings:** request a service, accept/decline, status lifecycle
- [x] **Phase 4 — Ratings & reviews:** two-way reviews between users (same campus), overall rating on profiles, leave/delete reviews (booking-gating deferred)
- [ ] **Phase 5 — Polish & deploy:** UI cleanup, error handling, testing, deployment

**First milestone — the vertical slice:** one user registers → logs in → posts a listing → another user books it → leaves a rating. Working end-to-end before any feature gets polished.

---

## 📐 Conventions

Project rules — the source of truth for how code is written here.

- **No emojis in code, ever.** No emojis in source files, identifiers, string literals, log messages, or commit messages. UI-facing text uses plain words. (Emojis are fine in this README and other docs.)

---

## 👤 Author

**Deborah Folorunsho**
📫 ffolo@uic.edu
🔗 [LinkedIn](#) · [Portfolio](#)

---

 