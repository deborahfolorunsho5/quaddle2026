from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.university import University
from app.schemas.university import UniversityRead

router = APIRouter(prefix="/universities", tags=["universities"])


@router.get("", response_model=list[UniversityRead])
def list_universities(db: Session = Depends(get_db)):
    """Return every university, alphabetically — used to populate the
    sign-up dropdown on the frontend."""
    return db.scalars(select(University).order_by(University.name)).all()