from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.listing import Listing
from app.models.user import User

# Valid booking states. Stored as a plain string (simpler migrations than a
# database enum), validated in code and in the Pydantic schemas.
BOOKING_STATUSES = ("pending", "accepted", "declined", "completed", "cancelled")


class Booking(Base):
    """A request from a customer to a provider for a listing. Moves through
    the status lifecycle pending -> accepted/declined -> completed/cancelled."""
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Listing owner at request time, denormalized for easy "my incoming" queries.
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    listing: Mapped[Listing] = relationship()
    customer: Mapped[User] = relationship(foreign_keys=[customer_id])
    provider: Mapped[User] = relationship(foreign_keys=[provider_id])