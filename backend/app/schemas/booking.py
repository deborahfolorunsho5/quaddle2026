from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app.core.time import as_utc
from app.schemas.availability import SlotBrief
from app.schemas.common import UserBrief


class ListingBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str


class BookingCreate(BaseModel):
    """Customer's request for a listing, against one of the provider's open
    availability slots. The time itself comes off the slot, so it is not part
    of the request body."""
    listing_id: int
    slot_id: int
    message: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None
    ) = None


class BookingStatusUpdate(BaseModel):
    """Move a booking to a new state. Allowed transitions are checked on the
    server based on who you are (provider vs customer)."""
    status: Literal["accepted", "declined", "completed", "cancelled"]


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    message: str | None
    # Copied off the slot, and kept after a decline or cancel releases it.
    requested_time: datetime | None
    requested_end: datetime | None
    created_at: datetime
    listing: ListingBrief
    customer: UserBrief
    provider: UserBrief
    # Null once the booking is declined or cancelled and the slot reopens.
    slot: SlotBrief | None

    @field_validator("requested_time", "requested_end", "created_at")
    @classmethod
    def _normalize(cls, value: datetime | None) -> datetime | None:
        return None if value is None else as_utc(value)
