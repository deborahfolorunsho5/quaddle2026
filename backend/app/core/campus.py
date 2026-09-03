from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.university import University


def get_active_campus(db: Session) -> University:
    """The single campus Quad is open to, named by ACTIVE_CAMPUS_NAME.

    The universities table still holds the whole US catalog, so the campus is
    resolved by name rather than by a hard-coded id, which differs per database.
    A missing row means the app is misconfigured or unseeded, not that the
    caller asked for something that does not exist, so it is a 503.
    """
    campus = db.scalar(
        select(University).where(University.name == settings.ACTIVE_CAMPUS_NAME)
    )
    if campus is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Active campus {settings.ACTIVE_CAMPUS_NAME!r} is not in the "
                "database. Run seed.py."
            ),
        )
    return campus
