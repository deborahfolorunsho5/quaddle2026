from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.university import University


class User(Base):
    """A student account. Each user belongs to one university, which is how
    listings and bookings get scoped to a single campus."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Required, unique handle. Users can log in with this or their email.
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    # Optional (we don't verify it); unique when provided.
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    # We never store the raw password — only a bcrypt hash of it.
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    university_id: Mapped[int] = mapped_column(
        ForeignKey("universities.id"), index=True
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Lets us do `user.university` to get the related University object.
    university: Mapped[University] = relationship()