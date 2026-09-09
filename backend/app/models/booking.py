from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.availability import AvailabilitySlot
from app.models.listing import Listing
from app.models.user import User

# Valid booking states. Stored as a plain string (simpler migrations than a
# database enum), validated in code and in the Pydantic schemas.
BOOKING_STATUSES = ("pending", "accepted", "declined", "completed", "cancelled")

# Statuses that hand the slot back to the provider so someone else can take it.
SLOT_RELEASING_STATUSES = ("declined", "cancelled")


class Booking(Base):
    """A request from a customer to a provider for a listing. Moves through
    the status lifecycle pending -> accepted/declined -> completed/cancelled."""
    __tablename__ = "bookings"
    __table_args__ = (
        # At most one live booking per slot. Declining or cancelling nulls the
        # column instead of deleting the row, and both databases allow repeated
        # nulls in a unique constraint, so the freed slot reopens on its own.
        UniqueConstraint("slot_id", name="uq_bookings_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Listing owner at request time, denormalized for easy "my incoming" queries.
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # The availability window this booking holds. Null once the booking is
    # declined or cancelled, which is what releases the slot.
    slot_id: Mapped[int | None] = mapped_column(
        ForeignKey("availability_slots.id"), nullable=True
    )

    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Copied off the slot at request time. Kept after the slot is released so a
    # declined booking can still say which time was asked for.
    requested_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    requested_end: Mapped[datetime | None] = mapped_column(
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
    slot: Mapped[AvailabilitySlot | None] = relationship()
