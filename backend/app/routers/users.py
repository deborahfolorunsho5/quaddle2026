from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.review import Review
from app.models.user import User
from app.schemas.user import UserRead, UserProfile

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Return the logged-in user's profile. Protected: requires a valid JWT."""
    return current_user


@router.get("/{user_id}", response_model=UserProfile)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """Public profile for any user, including their overall rating."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.subject_id == user_id
        )
    ).one()

    return UserProfile(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        university_id=user.university_id,
        rating_average=round(float(avg), 2) if avg is not None else None,
        rating_count=count,
    )