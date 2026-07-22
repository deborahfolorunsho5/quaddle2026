from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str


class ListingBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str


class BookingCreate(BaseModel):
    """Customer's request for a listing."""
    listing_id: int
    message: str | None = None
    requested_time: datetime | None = None


class BookingStatusUpdate(BaseModel):
    """Move a booking to a new state. Allowed transitions are checked on the
    server based on who you are (provider vs customer)."""
    status: Literal["accepted", "declined", "completed", "cancelled"]


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    message: str | None
    requested_time: datetime | None
    created_at: datetime
    listing: ListingBrief
    customer: UserBrief
    provider: UserBrief