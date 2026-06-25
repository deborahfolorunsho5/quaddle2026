import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

# backend/uploads — created on import so it's ready for StaticFiles to serve.
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Allowed image content types mapped to a file extension.
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image and get back its URL to attach to a listing.
    Requires an account."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, WEBP, or GIF images are allowed.",
        )

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB).")

    filename = f"{uuid.uuid4().hex}{ALLOWED_TYPES[file.content_type]}"
    (UPLOAD_DIR / filename).write_bytes(data)

    # Relative URL; the frontend prepends the API base when displaying it.
    return {"image_url": f"/media/{filename}"}