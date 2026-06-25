from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import universities, auth, users

app = FastAPI(title=settings.PROJECT_NAME)

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


@app.get("/health")
def health_check():
    """A simple endpoint to confirm the API is up."""
    return {"status": "ok", "service": settings.PROJECT_NAME}