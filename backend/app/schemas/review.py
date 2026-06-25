from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewAuthor(BaseModel):
    """Minimal info about who wrote a review."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str


class ReviewCreate(BaseModel):
    """Fields to leave a review about another user."""
    subject_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = None
    role: str | None = None  # "provider" or "customer"


class ReviewRead(BaseModel):
    """A review as returned by the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    rating: int
    comment: str | None
    role: str | None
    created_at: datetime
    subject_id: int
    author: ReviewAuthor