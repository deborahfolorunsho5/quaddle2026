from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.campus import get_active_campus
from app.db.session import get_db
from app.schemas.university import UniversityRead

router = APIRouter(prefix="/universities", tags=["universities"])


@router.get("", response_model=list[UniversityRead])
def list_universities(db: Session = Depends(get_db)):
    """Return the campuses open to sign-ups. Quad is UIC only for now, so
    this is a one-item list; it stays a list so opening a second campus is a
    config change rather than an API change."""
    return [get_active_campus(db)]
