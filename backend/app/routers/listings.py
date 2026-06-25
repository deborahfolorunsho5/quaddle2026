from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.listing import Listing
from app.models.user import User
from app.schemas.listing import ListingCreate, ListingRead, ListingUpdate

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("", response_model=list[ListingRead])
def browse_listings(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    university_id: Optional[int] = Query(
        None, description="Campus to browse. Defaults to your own if logged in."
    ),
    q: Optional[str] = Query(None, description="Search text in title."),
    category: Optional[str] = Query(None),
):
    """Browse active listings on a campus. Public — guests may browse, but
    they must say which campus; logged-in users default to their own."""
    campus_id = university_id or (current_user.university_id if current_user else None)
    if campus_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specify a university_id to browse, or log in.",
        )

    stmt = (
        select(Listing)
        .where(Listing.university_id == campus_id, Listing.is_active.is_(True))
        .order_by(Listing.created_at.desc())
    )
    if q:
        stmt = stmt.where(Listing.title.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(Listing.category == category)

    return db.scalars(stmt).all()


@router.get("/{listing_id}", response_model=ListingRead)
def get_listing(listing_id: int, db: Session = Depends(get_db)):
    """View a single listing. Public."""
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.post("", response_model=ListingRead, status_code=status.HTTP_201_CREATED)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a listing. Requires an account. The listing is automatically
    scoped to the creator's campus."""
    listing = Listing(
        **payload.model_dump(),
        owner_id=current_user.id,
        university_id=current_user.university_id,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _get_owned_listing(listing_id: int, db: Session, current_user: User) -> Listing:
    """Fetch a listing and confirm the current user owns it."""
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    return listing


@router.patch("/{listing_id}", response_model=ListingRead)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit a listing. Requires an account and ownership."""
    listing = _get_owned_listing(listing_id, db, current_user)
    # Only apply the fields the client actually sent.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)
    db.commit()
    db.refresh(listing)
    return listing


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a listing. Requires an account and ownership."""
    listing = _get_owned_listing(listing_id, db, current_user)
    db.delete(listing)
    db.commit()