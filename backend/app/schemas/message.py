from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app.core.time import as_utc
from app.schemas.common import UserBrief

MessageBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]


class ConversationStart(BaseModel):
    """Open (or reopen) a thread with another student on your campus."""
    user_id: int


class MessageCreate(BaseModel):
    body: MessageBody


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    body: str
    read_at: datetime | None
    created_at: datetime

    @field_validator("read_at", "created_at")
    @classmethod
    def _normalize(cls, value: datetime | None) -> datetime | None:
        return None if value is None else as_utc(value)


class ConversationRead(BaseModel):
    """One row of the inbox."""
    id: int
    other_user: UserBrief
    last_message: str | None
    last_message_at: datetime | None
    unread_count: int

    @field_validator("last_message_at")
    @classmethod
    def _normalize(cls, value: datetime | None) -> datetime | None:
        return None if value is None else as_utc(value)


class UnreadCount(BaseModel):
    count: int
