from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


class Conversation(Base):
    """A direct message thread between two students on the same campus.

    The pair is stored with the lower user id first, which is what makes the
    unique constraint mean anything: unordered, (3, 7) and (7, 3) would be two
    separate threads between the same two people.
    """
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("user_a_id < user_b_id", name="ck_conversations_pair_order"),
        UniqueConstraint("user_a_id", "user_b_id", name="uq_conversations_pair"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_a_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    user_b_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Denormalized so the inbox can sort threads without reaching into messages.
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user_a: Mapped[User] = relationship(foreign_keys=[user_a_id])
    user_b: Mapped[User] = relationship(foreign_keys=[user_b_id])

    def other_user(self, viewer_id: int) -> User:
        """The person on the far side of the thread from `viewer_id`."""
        return self.user_b if viewer_id == self.user_a_id else self.user_a


class Message(Base):
    """One message in a conversation."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    # Set when the recipient opens the thread. Null means unread.
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    sender: Mapped[User] = relationship()
