from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewRead

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewRead, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a review about another user. Requires an account."""
    if payload.subject_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't review yourself.")

    subject = db.get(User, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="User not found")

    if subject.university_id != current_user.university_id:
        raise HTTPException(
            status_code=403, detail="You can only review people on your own campus."
        )

    already = db.scalar(
        select(Review).where(
            Review.author_id == current_user.id,
            Review.subject_id == payload.subject_id,
        )
    )
    if already:
        raise HTTPException(status_code=409, detail="You've already reviewed this user.")

    review = Review(
        author_id=current_user.id,
        subject_id=payload.subject_id,
        rating=payload.rating,
        comment=payload.comment,
        role=payload.role,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.get("", response_model=list[ReviewRead])
def list_reviews(
    subject_id: int = Query(..., description="The user whose reviews to fetch."),
    db: Session = Depends(get_db),
):
    """List all reviews about a user, newest first. Public."""
    stmt = (
        select(Review)
        .where(Review.subject_id == subject_id)
        .order_by(Review.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a review you wrote."""
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your review")
    db.delete(review)
    db.commit()