from datetime import datetime

from sqlalchemy import String, Text, Numeric, Float, ForeignKey, DateTime, func
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

    # Where the provider meets the customer, pinned on a map when posting.
    # Optional: listings posted before the map existed have no pin, and a
    # service the provider travels to deliver may not have a fixed spot.
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Browsing is open to guests, so an exact pin is published to anyone. When
    # this is set the API coarsens the pin before serving it, letting a provider
    # show the right end of campus without publishing their doorstep.
    location_is_approximate: Mapped[bool] = mapped_column(default=False)

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
