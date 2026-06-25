from datetime import datetime

from sqlalchemy import String, Text, Numeric, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


class Listing(Base):
    """A service a student offers, e.g. tutoring or a haircut. Belongs to the
    student who posted it (owner) and is scoped to their campus (university)."""
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150), index=True)
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    category: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Copied from the owner's university when created, so we can filter
    # listings by campus without joining through the users table every time.
    university_id: Mapped[int] = mapped_column(
        ForeignKey("universities.id"), index=True
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    owner: Mapped[User] = relationship()