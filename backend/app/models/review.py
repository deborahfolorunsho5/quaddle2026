from datetime import datetime

from sqlalchemy import (
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    func,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


class Review(Base):
    """A rating one user leaves about another. Two-way: the subject may be
    reviewed as a provider or as a customer (captured in `role`)."""
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        # One review per author -> subject pair.
        UniqueConstraint("author_id", "subject_id", name="uq_reviews_author_subject"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Optional context: "provider" or "customer" — who the subject was here.
    role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Two links to users, so we tell SQLAlchemy which column is which.
    author: Mapped[User] = relationship(foreign_keys=[author_id])
    subject: Mapped[User] = relationship(foreign_keys=[subject_id])