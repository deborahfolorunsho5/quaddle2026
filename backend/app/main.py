from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import universities, auth, users, listings, uploads

app = FastAPI(title=settings.PROJECT_NAME)

# Serve uploaded images at /media/<filename>. (Served on /media, not /uploads,
# so it doesn't collide with the POST /uploads/image endpoint.)
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

app.include_router(universities.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(listings.router)
app.include_router(uploads.router)


@app.get("/health")
def health_check():
    """A simple endpoint to confirm the API is up."""
    return {"status": "ok", "service": settings.PROJECT_NAME}