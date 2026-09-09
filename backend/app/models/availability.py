from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


class AvailabilitySlot(Base):
    """A window a provider has opened for bookings.

    Slots hang off the provider rather than off a listing because a student can
    only be in one place at a time: taking Saturday at 2 pm for a haircut has to
    close that window on their tutoring listing too.
    """
    __tablename__ = "availability_slots"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_availability_slots_order"),
        UniqueConstraint(
            "provider_id", "starts_at", name="uq_availability_slots_provider_start"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    provider: Mapped[User] = relationship()
