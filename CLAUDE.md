# CLAUDE.md - Instructions for Claude Code in this repo

This file is loaded automatically by Claude Code when working in `quaddle2026/`. It tells Claude what this project is, who is working on it, and how the work is done.

## When in doubt, ASK

The single most important rule:

> **If you are unsure about a domain term, a schema field, an enum value, an API contract, a status transition, or how a piece of the system fits together, STOP and ASK.** Do not invent field names, do not guess at enum values, do not fabricate endpoints or model attributes.

Prefer **reading the actual code (models, schemas, routers), the migrations, and the README over assumptions**. If you cannot find a definitive source, say so in your response rather than papering over the gap. Wrong field names or invented statuses may pass a quick read but break the frontend and the database.

Cost of asking is low. Cost of guessing is high.

## Project context

Quad is a **campus marketplace for students to run their small businesses**. Students post services they offer (tutoring, hair, photography, baked goods, repairs, and so on), other students browse and book them, and both sides build a reputation through star ratings and reviews.

The core idea is **proximity, scoped to a single university**. When you sign up you pick your school, and you only see listings from your own campus. Because the person you are booking is on your campus, they are closer, cheaper to reach, and easier to trust.

The end-to-end flow:

> Sign up (pick your university) -> browse or search listings on your campus -> request a booking on a listing -> the provider accepts, declines, or completes it (either side can cancel while it is open) -> after the transaction, either side leaves a star rating and review, which rolls up into an overall rating on the profile.

Browsing is open to guests. Posting, booking, and reviewing require an account.

The current state of each feature is tracked in the **Progress** checklist at the bottom of `README.md`. Read that before assuming a feature is or is not built. As of this writing, bookings have a working, tested API with the frontend still in progress.

## Who works here

This is a solo project by **Deborah Folorunsho (ffolo@uic.edu)**. There is no team to route changes through, but that does not lower the bar: when you make a change that crosses a boundary (for example, changing a Pydantic response schema that the frontend `api/client.js` consumes, or renaming a model field that a migration and a router both reference), **call out the ripple effects explicitly** so nothing silently drifts out of sync between the backend, the migrations, and the frontend.

## Architecture at a glance

Two apps plus a database.

- **Backend** (`backend/`): FastAPI. Routers per resource, Pydantic schemas for request and response bodies, SQLAlchemy 2.0 models, Alembic migrations. Runs on `http://localhost:8000`, interactive docs at `/docs`.
- **Frontend** (`frontend/`): React 19 with Vite, React Router. One file per screen under `src/pages/`, shared UI in `src/components/`, auth state in `src/context/AuthContext.jsx`, and a single API client in `src/api/client.js`. Runs on `http://localhost:5173`.
- **Database**: PostgreSQL 16 in Docker for a Postgres-like local environment (`docker compose up -d`, host port `5433`). Note the mismatch to be aware of: the backend's **default** `DATABASE_URL` is SQLite (`sqlite:///./quaddle.db`), and `backend/app/db/session.py` special-cases SQLite. Confirm which database you are actually pointed at (check `backend/.env`) before reasoning about migrations or SQL behavior.

### Request path

Frontend calls go through `src/api/client.js` only. That client reads the base URL from `import.meta.env.VITE_API_URL` (defaults to `http://localhost:8000`), attaches the JWT from `localStorage` as `Authorization: Bearer <token>`, and turns relative `/media/...` paths into full image URLs via `mediaUrl()`. Do not scatter raw `fetch` calls through the pages; add a method to the `api` object instead.

On the backend, `app/main.py` wires up CORS, mounts uploaded images at `/media/<filename>`, and includes each router. Auth flows through `app/core/`: `security.py` (bcrypt hashing, JWT creation), `deps.py` (`get_current_user` for protected routes, `get_current_user_optional` for guest-friendly ones like browsing).

## Code conventions

### Python (`backend/`)

- Python 3.11+ (README lists 3.11+; the `.venv` may be newer).
- PEP 8. Type hints on public functions. Use modern SQLAlchemy 2.0 typing (`Mapped[...]`, `mapped_column(...)`) to match the existing models.
- **Pydantic v2** for all HTTP request and response bodies. Response models use `model_config = ConfigDict(from_attributes=True)`. Constrain inputs where the model already does (for example, booking status transitions are a `Literal`, review ratings are range-checked).
- **Sessions are synchronous.** This project uses sync SQLAlchemy `Session` via the `get_db` dependency and plain `def` route handlers. Do **not** introduce `async def` endpoints, `asyncpg`, or async sessions without a deliberate, discussed migration. Match the existing style.
- Prefer `pathlib.Path` over `os.path`.
- Keep secrets and config in settings (`app/core/config.py`), loaded from `.env`. Never hard-code a secret key, database URL, or CORS origin in code.

### JavaScript / React (`frontend/`)

- Plain JavaScript with JSX (`.jsx`), ES modules, React 19 function components with hooks. There is no TypeScript in this project today; do not add a TS toolchain without discussing it.
- Lint with `oxlint` (`npm run lint`).
- One screen per file in `src/pages/`. Reusable pieces go in `src/components/`. All server access goes through `src/api/client.js`.
- Read the token key and auth helpers from the existing client (`getToken`, `setToken`, `TOKEN_KEY = "quaddle_token"`); do not duplicate them.

### Both

- **Small, focused commits.** Do not bundle unrelated changes.
- **No dead code.** Do not leave commented-out blocks "just in case."
- **No premature abstraction.** A few similar lines beat a speculative framework for a future that may not arrive.
- **Comments explain why, not what.** The existing code comments the non-obvious reasons (why SQLite needs `check_same_thread`, why `provider_id` is denormalized on bookings, why images serve on `/media` not `/uploads`). Match that bar: default to no comment, add one only when the reason is not obvious from the code.
- **No emojis anywhere** (code, comments, docs, commit messages) and **no em dashes** in the README or docs. Keep documentation in a plain, human voice.

## Data model and domain glossary

> These are working summaries. When precision matters (implementing a status transition, a query, or a validation rule), **confirm against the actual model, schema, and migration** rather than trusting this table.

| Term | Working definition |
| --- | --- |
| **University / campus** | The scoping unit for everything. A user belongs to one university; listings, browsing, and reviews are all filtered to the same campus. Seeded from a catalog of US universities via `backend/seed.py`. |
| **User** | An account with a username (email optional), password stored as a bcrypt hash, and a university. Can log in by username or email. Has a public profile carrying an overall rating. |
| **Listing** | A service a student offers: title, description, price, category, and a photo. Owned by the posting user. Scoped to that user's campus. |
| **Booking** | A request from a **customer** to a **provider** (the listing owner) for a listing. Statuses are `BOOKING_STATUSES = ("pending", "accepted", "declined", "completed", "cancelled")`, stored as a plain string, not a database enum. Lifecycle: `pending -> accepted/declined -> completed/cancelled`. Allowed transitions depend on who you are (provider vs customer) and are enforced server-side. `provider_id` is denormalized onto the booking for easy "my incoming" queries. |
| **Provider vs customer** | The two sides of a booking. The provider owns the listing; the customer requests it. The same user can be a provider on one booking and a customer on another. |
| **Review** | A star rating (1 to 5, check-constrained) plus optional comment that one user (`author`) leaves about another (`subject`). Two-way: the subject may have been a provider or a customer, captured in the optional `role` field. One review per `(author_id, subject_id)` pair (unique constraint). Rolls up into the profile's overall rating. |
| **Media / uploads** | User-uploaded listing photos. Uploaded via `POST /uploads/image`, stored under `backend/uploads/` (gitignored), and served read-only at `/media/<filename>`. The frontend builds displayable URLs with `mediaUrl()`. |
| **Guest** | An unauthenticated visitor. Guests can browse and search listings. Posting, booking, and reviewing require a valid JWT. Guest-friendly routes use `get_current_user_optional`. |

If you hit a term or field not covered here, **ask** rather than inferring it from surrounding code.

## API surface

The current endpoints are listed in the **API overview** table in `README.md`. Treat that table plus the actual routers in `backend/app/routers/` as the source of truth. When you add or change an endpoint, update both the router and, if it affects the contract, `README.md` and `src/api/client.js`.

## Testing

There is **no automated test suite in the repo yet**. Be honest about this: do not claim tests pass, and do not imply a feature is verified when it is not.

- When you implement or change backend behavior, verify it against the running API (`uvicorn app.main:app --reload`, then exercise it through `/docs` or a request) and say exactly what you checked.
- If you add tests, use `pytest` for the backend and keep them runnable from `backend/`. Cover the parts most likely to break silently: booking status-transition rules (who may move a booking to which state), review constraints (rating range, one-per-pair), campus scoping (a user should never see or act on another campus's data), and auth boundaries (guest vs authenticated).
- If you cannot run something in the current environment, **say so plainly** instead of implying success.

## Review your own output (required)

After you generate or change any non-trivial code, **switch hats and review it as a strict, separate senior developer.** Do not skip this and do not soften it. In your response, call out:

- **Bugs and logic errors**, including off-by-one, wrong status transitions, missing `await` or session handling, and incorrect query filters.
- **Edge cases**: empty inputs, missing or malformed tokens, a user acting on another user's or another campus's data, duplicate bookings or reviews, unexpected status values, absent optional fields, large or malformed uploads.
- **Security risks**: auth and authorization gaps (is the route protected, and does it check ownership, not just authentication), injection, secrets leaking into code or logs, unsafe file uploads (path traversal, content type, size), overly broad CORS, and JWT handling mistakes.

For each issue, state the concrete failure scenario and **how to fix it**. If after honest review you find nothing material, say that explicitly rather than inventing filler. Prefer fixing clear problems in the same change over merely listing them.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add booking accept/decline endpoint
fix: reject reviews from users on a different campus
docs: document the bookings API in the README
test: cover booking status-transition rules
refactor: extract campus-scoping filter into a helper
chore: bump vite to 8.x
```

Keep the subject concise. Use the body to explain why, not what. No emojis.

## Branching and PRs

- Trunk-based on `main`.
- Branch before starting non-trivial work; do not commit or push unless asked.
- Keep changes reviewable. For UI changes, a screenshot in the PR helps.

## Deployment quick reference

- **Local database:** `docker compose up -d` from the repo root. PostgreSQL 16, exposed on host port `5433` (container `5432`) to avoid clashing with other local Postgres instances. `docker compose down -v` also wipes the data volume.
- **Backend (local):** from `backend/`: create a venv, `pip install -r requirements.txt`, `cp .env.example .env` and fill it in, `alembic upgrade head`, `python seed.py`, then `uvicorn app.main:app --reload` on `http://localhost:8000`.
- **Frontend (local):** from `frontend/`: `npm install`, `npm run dev` on `http://localhost:5173`.
- **Config:** all backend config lives in `backend/.env` (gitignored), mirrored by `backend/.env.example`. Generate `SECRET_KEY` with `python -c "import secrets; print(secrets.token_hex(32))"`. For production, set `DATABASE_URL` to a PostgreSQL URL (for example `postgresql+psycopg2://user:password@host:5432/quaddle`).

## Anti-patterns to avoid

- **Inventing model fields, schema attributes, statuses, or endpoints** that are not grounded in the actual code or migrations.
- **Adding `async def` routes, async SQLAlchemy, or asyncpg** into a codebase that is deliberately synchronous, without discussing the migration first.
- **Bypassing the API client** by scattering raw `fetch` calls through the React pages instead of adding a method to `src/api/client.js`.
- **Hard-coding secrets, the database URL, CORS origins, or the API base URL** in code instead of reading them from settings (`app/core/config.py`) or `import.meta.env`.
- **Skipping ownership and campus-scoping checks.** Authenticating a request is not the same as authorizing it. A logged-in user must not be able to edit someone else's listing, act on a booking they are not part of, or touch another campus's data.
- **Changing a response schema without updating its consumer.** If you change a Pydantic response model, update `src/api/client.js` and the affected pages, and the README API table.
- **Committing secrets or user uploads.** `backend/.env` and `backend/uploads/` are gitignored; keep it that way.
- **Trusting uploaded files.** Validate content type and size and never build filesystem paths straight from user-supplied names.
- **Adding emojis or em dashes** to code or documentation.
