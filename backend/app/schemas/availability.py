from datetime import datetime, timedelta

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.core.time import as_utc, to_utc

# A slot longer than this is almost always a mistyped end time, and because
# slots may not overlap one bad row would block out the provider's whole week.
MAX_SLOT_HOURS = 12


class SlotCreate(BaseModel):
    """A window the provider is opening up for bookings."""
    starts_at: datetime
    ends_at: datetime

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _normalize(cls, value: datetime) -> datetime:
        return to_utc(value)

    @model_validator(mode="after")
    def _check_window(self) -> "SlotCreate":
        if self.ends_at <= self.starts_at:
            raise ValueError("A slot has to end after it starts.")
        if self.ends_at - self.starts_at > timedelta(hours=MAX_SLOT_HOURS):
            raise ValueError(f"A slot can't be longer than {MAX_SLOT_HOURS} hours.")
        return self


class SlotRead(BaseModel):
    """An open window, as a customer sees it."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    starts_at: datetime
    ends_at: datetime

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _normalize(cls, value: datetime) -> datetime:
        return as_utc(value)


class ProviderSlotRead(SlotRead):
    """The provider's own view, which also shows the ones already taken."""
    is_booked: bool


class SlotBrief(BaseModel):
    """The window a booking holds, nested inside a booking."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    starts_at: datetime
    ends_at: datetime

    @field_validator("starts_at", "ends_at")
    @classmethod
    def _normalize(cls, value: datetime) -> datetime:
        return as_utc(value)
