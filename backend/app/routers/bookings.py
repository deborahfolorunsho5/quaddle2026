from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
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


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Request a booking on a listing. Requires an account."""
    listing = db.get(Listing, payload.listing_id)
    if listing is None or not listing.is_active:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't book your own listing.")
    if listing.university_id != current_user.university_id:
        raise HTTPException(
            status_code=403, detail="You can only book listings on your own campus."
        )

    booking = Booking(
        listing_id=listing.id,
        customer_id=current_user.id,
        provider_id=listing.owner_id,
        message=payload.message,
        requested_time=payload.requested_time,
        status="pending",
    )
    db.add(booking)
    db.commit()
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
    db.commit()
    db.refresh(booking)
    return booking