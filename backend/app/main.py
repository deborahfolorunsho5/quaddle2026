from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import (
    universities, auth, users, listings, uploads, reviews, bookings, geocode,
)

# Every API route lives under /api. Without it the API and the frontend collide:
# both want /listings/{id} and /users/{id}, so they could not share one origin.
API_PREFIX = "/api"

app = FastAPI(title=settings.PROJECT_NAME)

# Serve uploaded images at /media/<filename>. (Served on /media, not /uploads,
# so it doesn't collide with the POST /uploads/image endpoint.) Deliberately
# left outside API_PREFIX: listings already store "/media/..." in image_url,
# and moving the mount would break every existing row.
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")

# CORS: lets the React frontend (on a different port) call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    universities.router,
    auth.router,
    users.router,
    listings.router,
    uploads.router,
    reviews.router,
    bookings.router,
    geocode.router,
):
    app.include_router(router, prefix=API_PREFIX)


@app.get(f"{API_PREFIX}/health")
def health_check():
    """A simple endpoint to confirm the API is up."""
    return {"status": "ok", "service": settings.PROJECT_NAME}


# Optional single-service mode: if a frontend build is sitting next to the
# backend, serve it from this same app so there is one origin and no CORS.
# Absent a build (the usual local setup, where Vite serves on :5173) this whole
# block is skipped and nothing below exists.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if (FRONTEND_DIST / "index.html").is_file():

    @app.get("/{spa_path:path}", include_in_schema=False)
    def serve_spa(spa_path: str):
        """Serve a real build file when one matches, otherwise the SPA shell so
        client-side routes like /listings/3 survive a refresh."""
        # Registered last, so it only sees paths no API route claimed. An unknown
        # /api/... path must still fail as JSON rather than returning HTML.
        if spa_path == "api" or spa_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        candidate = (FRONTEND_DIST / spa_path).resolve()
        if candidate.is_relative_to(FRONTEND_DIST) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
