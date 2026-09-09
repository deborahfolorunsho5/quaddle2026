from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.availability import AvailabilitySlot
from app.models.booking import Booking
from app.models.user import User
from app.schemas.availability import ProviderSlotRead, SlotCreate, SlotRead

router = APIRouter(prefix="/availability", tags=["availability"])

OVERLAP_MESSAGE = "That overlaps a slot you already have open."


def _held_slot_ids(provider_id: int | None = None):
    """Slot ids a live booking is holding.

    The `is_not(None)` is load-bearing, not tidiness: a NOT IN against a
    subquery that yields a single NULL matches no rows at all, which would
    silently hide every open slot on the calendar.
    """
    stmt = select(Booking.slot_id).where(Booking.slot_id.is_not(None))
    if provider_id is not None:
        stmt = stmt.where(Booking.provider_id == provider_id)
    return stmt


@router.get("/mine", response_model=list[ProviderSlotRead])
def my_slots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """My upcoming slots, including the ones a customer has already taken."""
    stmt = (
        select(AvailabilitySlot)
        .where(
            AvailabilitySlot.provider_id == current_user.id,
            AvailabilitySlot.ends_at > func.now(),
        )
        .order_by(AvailabilitySlot.starts_at)
    )
    slots = db.scalars(stmt).all()
    held = set(db.scalars(_held_slot_ids(current_user.id)).all())
    return [
        ProviderSlotRead(
            id=slot.id,
            provider_id=slot.provider_id,
            starts_at=slot.starts_at,
            ends_at=slot.ends_at,
            is_booked=slot.id in held,
        )
        for slot in slots
    ]


@router.get("", response_model=list[SlotRead])
def list_open_slots(
    provider_id: int = Query(..., description="Whose calendar to show."),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """A provider's open, upcoming slots. Guests may look, the same as they can
    browse listings, but only a signed-in student can take one."""
    provider = db.get(User, provider_id)
    if provider is None or not provider.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user and current_user.university_id != provider.university_id:
        raise HTTPException(
            status_code=403,
            detail="You can only see the calendar of someone on your own campus.",
        )

    stmt = (
        select(AvailabilitySlot)
        .where(
            AvailabilitySlot.provider_id == provider_id,
            AvailabilitySlot.starts_at > func.now(),
            AvailabilitySlot.id.not_in(_held_slot_ids(provider_id)),
        )
        .order_by(AvailabilitySlot.starts_at)
    )
    return db.scalars(stmt).all()


@router.post("", response_model=ProviderSlotRead, status_code=status.HTTP_201_CREATED)
def create_slot(
    payload: SlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Open a window on my calendar."""
    if payload.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="That time has already passed.")

    clash = db.scalar(
        select(AvailabilitySlot.id)
        .where(
            AvailabilitySlot.provider_id == current_user.id,
            AvailabilitySlot.starts_at < payload.ends_at,
            AvailabilitySlot.ends_at > payload.starts_at,
        )
        .limit(1)
    )
    if clash is not None:
        raise HTTPException(status_code=409, detail=OVERLAP_MESSAGE)

    slot = AvailabilitySlot(
        provider_id=current_user.id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
    )
    db.add(slot)
    try:
        db.commit()
    except IntegrityError:
        # Two tabs adding the same start time; the unique constraint caught it.
        db.rollback()
        raise HTTPException(status_code=409, detail=OVERLAP_MESSAGE)
    db.refresh(slot)

    return ProviderSlotRead(
        id=slot.id,
        provider_id=slot.provider_id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        is_booked=False,
    )


@router.delete("/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_slot(
    slot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Take a window off my calendar."""
    slot = db.get(AvailabilitySlot, slot_id)
    if slot is None:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your slot")

    booked_message = "Someone has this time booked. Decline that booking first."
    held = db.scalar(select(Booking.id).where(Booking.slot_id == slot_id).limit(1))
    if held is not None:
        raise HTTPException(status_code=409, detail=booked_message)

    db.delete(slot)
    try:
        db.commit()
    except IntegrityError:
        # A customer took the slot between the check above and this delete; the
        # booking's foreign key is what stopped the time vanishing under them.
        db.rollback()
        raise HTTPException(status_code=409, detail=booked_message)
