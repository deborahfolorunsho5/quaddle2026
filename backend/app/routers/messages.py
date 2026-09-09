from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.message import Conversation, Message
from app.models.user import User
from app.schemas.common import UserBrief
from app.schemas.message import (
    ConversationRead,
    ConversationStart,
    MessageCreate,
    MessageRead,
    UnreadCount,
)

router = APIRouter(prefix="/conversations", tags=["messages"])

# How much of a thread the first load pulls down. Later messages arrive through
# after_id, so this only caps the opening request on a long-running thread.
PAGE_SIZE = 100


def _ordered_pair(a: int, b: int) -> tuple[int, int]:
    """Conversations store the lower user id first so the pair is unique."""
    return (a, b) if a < b else (b, a)


def _mine(user_id: int):
    return or_(Conversation.user_a_id == user_id, Conversation.user_b_id == user_id)


def _load_participant(
    db: Session, conversation_id: int, current_user: User
) -> Conversation:
    """Fetch a conversation the caller is actually in.

    Being signed in is not enough here: without the membership check any user
    could read any thread by guessing an id.
    """
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conversation.user_a_id, conversation.user_b_id):
        raise HTTPException(status_code=403, detail="Not your conversation")
    return conversation


def _read_one(
    db: Session, conversation: Conversation, viewer: User, other: User
) -> ConversationRead:
    last = db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.id.desc())
        .limit(1)
    )
    unread = db.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation.id,
            Message.sender_id != viewer.id,
            Message.read_at.is_(None),
        )
    )
    return ConversationRead(
        id=conversation.id,
        other_user=UserBrief.model_validate(other),
        last_message=last.body if last else None,
        last_message_at=conversation.last_message_at,
        unread_count=unread or 0,
    )


@router.get("/unread-count", response_model=UnreadCount)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Total unread messages across my threads, for the badge in the nav."""
    count = db.scalar(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            _mine(current_user.id),
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
    )
    return UnreadCount(count=count or 0)


@router.get("", response_model=list[ConversationRead])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """My inbox, most recently active first."""
    stmt = (
        select(Conversation)
        .where(_mine(current_user.id))
        .options(
            selectinload(Conversation.user_a), selectinload(Conversation.user_b)
        )
        .order_by(
            func.coalesce(
                Conversation.last_message_at, Conversation.created_at
            ).desc()
        )
    )
    conversations = db.scalars(stmt).all()
    if not conversations:
        return []

    ids = [c.id for c in conversations]

    unread = dict(
        db.execute(
            select(Message.conversation_id, func.count(Message.id))
            .where(
                Message.conversation_id.in_(ids),
                Message.sender_id != current_user.id,
                Message.read_at.is_(None),
            )
            .group_by(Message.conversation_id)
        ).all()
    )

    # The newest message in every thread, in one query rather than one per row.
    # Both PostgreSQL and SQLite support row_number().
    ranked = (
        select(
            Message.conversation_id.label("conversation_id"),
            Message.body.label("body"),
            func.row_number()
            .over(partition_by=Message.conversation_id, order_by=Message.id.desc())
            .label("rank"),
        )
        .where(Message.conversation_id.in_(ids))
        .subquery()
    )
    previews = dict(
        db.execute(
            select(ranked.c.conversation_id, ranked.c.body).where(ranked.c.rank == 1)
        ).all()
    )

    return [
        ConversationRead(
            id=c.id,
            other_user=UserBrief.model_validate(c.other_user(current_user.id)),
            last_message=previews.get(c.id),
            last_message_at=c.last_message_at,
            unread_count=unread.get(c.id, 0),
        )
        for c in conversations
    ]


@router.post("", response_model=ConversationRead)
def start_conversation(
    payload: ConversationStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Open a thread with another student, or hand back the existing one.

    Deliberately not 201: reopening an old thread creates nothing.
    """
    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't message yourself.")

    other = db.get(User, payload.user_id)
    if other is None or not other.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    if other.university_id != current_user.university_id:
        raise HTTPException(
            status_code=403,
            detail="You can only message people on your own campus.",
        )

    user_a_id, user_b_id = _ordered_pair(current_user.id, other.id)
    pair = (Conversation.user_a_id == user_a_id, Conversation.user_b_id == user_b_id)
    conversation = db.scalar(select(Conversation).where(*pair))

    if conversation is None:
        conversation = Conversation(user_a_id=user_a_id, user_b_id=user_b_id)
        db.add(conversation)
        try:
            db.commit()
        except IntegrityError:
            # Two tabs opened the same thread at once; keep the one that landed.
            db.rollback()
            conversation = db.scalar(select(Conversation).where(*pair))
            if conversation is None:
                # The clash was something else, so do not guess at a thread id.
                raise HTTPException(
                    status_code=500, detail="Could not open that conversation."
                )
        db.refresh(conversation)

    return _read_one(db, conversation, current_user, other)


@router.get("/{conversation_id}", response_model=ConversationRead)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One of my threads, so a thread view can name who it is with."""
    conversation = _load_participant(db, conversation_id, current_user)
    return _read_one(
        db, conversation, current_user, conversation.other_user(current_user.id)
    )


@router.get("/{conversation_id}/messages", response_model=list[MessageRead])
def list_messages(
    conversation_id: int,
    after_id: int | None = Query(
        None, description="Only messages newer than this id. Used for polling."
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The messages in one of my threads, oldest first."""
    _load_participant(db, conversation_id, current_user)

    stmt = select(Message).where(Message.conversation_id == conversation_id)
    if after_id is not None:
        return db.scalars(stmt.where(Message.id > after_id).order_by(Message.id)).all()

    # Newest page first, then flipped, so opening a long thread does not ship
    # the whole history.
    newest = db.scalars(stmt.order_by(Message.id.desc()).limit(PAGE_SIZE)).all()
    return list(reversed(newest))


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a message into one of my threads."""
    conversation = _load_participant(db, conversation_id, current_user)

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        body=payload.body,
    )
    db.add(message)
    # The database clock, so it cannot drift from the message's own created_at.
    conversation.last_message_at = func.now()
    db.commit()
    db.refresh(message)
    return message


@router.post("/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark the other side's messages in this thread as read."""
    _load_participant(db, conversation_id, current_user)
    db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    db.commit()
