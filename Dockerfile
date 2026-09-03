# One image serving both halves of Quad. The layout mirrors the repo because
# backend/app/main.py resolves the frontend build as ../../frontend/dist.

# ---- Stage 1: build the React app ----
FROM node:22-alpine AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

# Empty base URL means the client calls /api/... on whatever origin serves it,
# so there is no host to hard-code and no cross-origin request to allow.
ENV VITE_API_URL=""
RUN npm run build

# ---- Stage 2: the API, which also serves the build above ----
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Runtime, not build time: migrations need the real database, and seeding is
# idempotent so an empty universities table can never block sign-up. Both run
# before uvicorn and a failure in either stops the container rather than
# serving a half-configured app.
# `exec` hands uvicorn the shell's process, so Render's SIGTERM reaches the
# server itself and shutdown stays graceful instead of being killed after a wait.
CMD ["sh", "-c", "alembic upgrade head && python seed.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
