from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.time import as_utc
from app.db.session import get_db
from app.models.availability import AvailabilitySlot
from app.models.booking import Booking, SLOT_RELEASING_STATUSES
from app.models.listing import Listing
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingRead, BookingStatusUpdate

router = APIRouter(prefix="/bookings", tags=["bookings"])

# (actor_role, current_status, new_status) combinations that are allowed.
ALLOWED_TRANSITIONS = {
    ("provider", "pending", "accepted"),
    ("provider", "pending", "declined"),
    ("provider", "accepted", "completed"),
    ("customer", "pending", "cancelled"),
    ("customer", "accepted", "cancelled"),
}

SLOT_TAKEN_MESSAGE = "Someone just booked that time. Pick another one."


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request a booking against one of the provider's open slots."""
    listing = db.get(Listing, payload.listing_id)
    if listing is None or not listing.is_active:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't book your own listing.")
    if listing.university_id != current_user.university_id:
        raise HTTPException(
            status_code=403, detail="You can only book listings on your own campus."
        )

    slot = db.get(AvailabilitySlot, payload.slot_id)
    if slot is None or slot.provider_id != listing.owner_id:
        raise HTTPException(
            status_code=404, detail="That time isn't on this provider's calendar."
        )
    if as_utc(slot.starts_at) <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="That time has already passed.")

    held = db.scalar(select(Booking.id).where(Booking.slot_id == slot.id).limit(1))
    if held is not None:
        raise HTTPException(status_code=409, detail=SLOT_TAKEN_MESSAGE)

    booking = Booking(
        listing_id=listing.id,
        customer_id=current_user.id,
        provider_id=listing.owner_id,
        slot_id=slot.id,
        message=payload.message,
        # Copied off the slot so the time survives the slot being released.
        requested_time=slot.starts_at,
        requested_end=slot.ends_at,
        status="pending",
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        # Two customers hit the same slot at once; the unique constraint decided.
        db.rollback()
        raise HTTPException(status_code=409, detail=SLOT_TAKEN_MESSAGE)
    db.refresh(booking)
    return booking


@router.get("/mine", response_model=list[BookingRead])
def my_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bookings I requested (as a customer)."""
    stmt = (
        select(Booking)
        .where(Booking.customer_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.get("/incoming", response_model=list[BookingRead])
def incoming_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bookings on my listings (as a provider)."""
    stmt = (
        select(Booking)
        .where(Booking.provider_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.patch("/{booking_id}", response_model=BookingRead)
def update_status(
    booking_id: int,
    payload: BookingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept/decline/complete (provider) or cancel (customer) a booking."""
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.id == booking.provider_id:
        role = "provider"
    elif current_user.id == booking.customer_id:
        role = "customer"
    else:
        raise HTTPException(status_code=403, detail="Not your booking")

    if (role, booking.status, payload.status) not in ALLOWED_TRANSITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"A {role} can't change a {booking.status} booking to {payload.status}.",
        )

    booking.status = payload.status
    if payload.status in SLOT_RELEASING_STATUSES:
        # Hand the time back so another customer can take it.
        booking.slot_id = None
    db.commit()
    db.refresh(booking)
    return booking