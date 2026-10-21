import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

# backend/uploads — created on import so it's ready for StaticFiles to serve.
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB

# Wide enough for the listing page on a large screen, a fraction of what a
# phone camera produces. A listing can carry six of these.
MAX_SIDE = 1600
# A small file can still declare enormous dimensions and exhaust memory once
# decoded. This is above any phone camera, so it only stops crafted files.
MAX_PIXELS = 50_000_000


@router.post("/image")
def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image and get back its URL to attach to a listing.
    Requires an account.

    Every photo is decoded and re-saved rather than stored as sent. That
    shrinks it, proves it really is an image whatever the declared content
    type says, and drops the EXIF block, which on a phone photo often holds
    the GPS position it was taken at."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, WEBP, or GIF images are allowed.",
        )

    # Read one byte past the limit so an oversized file is caught without
    # pulling all of it into memory.
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB).")

    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > MAX_PIXELS:
            raise HTTPException(status_code=400, detail="Image dimensions too large.")
        # Phones store photos sideways plus a rotation flag in EXIF. Apply it
        # now, since the flag is about to be stripped.
        image = ImageOps.exif_transpose(image)
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        # WEBP keeps transparency and is far smaller than PNG for photos. An
        # animated GIF is flattened to its first frame, which is fine for a
        # listing photo.
        if image.mode not in ("RGB", "RGBA"):
            has_alpha = image.mode in ("LA", "PA") or "transparency" in image.info
            image = image.convert("RGBA" if has_alpha else "RGB")
        out = io.BytesIO()
        image.save(out, format="WEBP", quality=82)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise HTTPException(status_code=400, detail="That file is not a readable image.")

    filename = f"{uuid.uuid4().hex}.webp"
    (UPLOAD_DIR / filename).write_bytes(out.getvalue())

    # Relative URL; the frontend prepends the API base when displaying it.
    return {"image_url": f"/media/{filename}"}
