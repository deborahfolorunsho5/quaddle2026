from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.campus import get_active_campus
from app.core.deps import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.listing import Listing
from app.models.review import Review
from app.models.user import User
from app.schemas.listing import (
    ListingBrowseItem,
    ListingCreate,
    ListingRead,
    ListingUpdate,
)

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("", response_model=list[ListingBrowseItem])
def browse_listings(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    university_id: Optional[int] = Query(
        None, description="Campus to browse. Defaults to your own, or to the campus Quad is open to."
    ),
    q: Optional[str] = Query(None, description="Search text in title."),
    category: Optional[str] = Query(None),
    owner_id: Optional[int] = Query(
        None, description="Only this user's listings, for their profile."
    ),
):
    """Browse active listings on a campus, or one owner's listings with
    owner_id (including their inactive ones, if the owner is asking). Public,
    and guests need not say which campus: with Quad open to a single campus,
    that is the sensible default, and it is what makes the browse page work
    before sign-up."""
    campus_id = (
        university_id
        or (current_user.university_id if current_user else None)
        or get_active_campus(db).id
    )

    stmt = (
        select(Listing)
        .where(Listing.university_id == campus_id)
        .order_by(Listing.created_at.desc())
    )
    # Inactive listings stay out of everyone's results except their owner's,
    # so a provider's profile still accounts for everything they have posted.
    viewing_own = current_user is not None and owner_id == current_user.id
    if not viewing_own:
        stmt = stmt.where(Listing.is_active.is_(True))
    if owner_id is not None:
        stmt = stmt.where(Listing.owner_id == owner_id)
    if q:
        stmt = stmt.where(Listing.title.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(Listing.category == category)

    listings = db.scalars(stmt).all()
    ratings = _owner_ratings(db, {listing.owner_id for listing in listings})

    items = []
    for listing in listings:
        item = ListingBrowseItem.model_validate(listing)
        if listing.owner_id in ratings:
            item.owner.rating_average, item.owner.rating_count = ratings[
                listing.owner_id
            ]
        items.append(item)
    return items


def _owner_ratings(db: Session, owner_ids: set[int]) -> dict[int, tuple[float, int]]:
    """Average and count of reviews per owner, in one grouped query rather
    than one per card. Owners with no reviews are simply absent."""
    if not owner_ids:
        return {}
    rows = db.execute(
        select(Review.subject_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.subject_id.in_(owner_ids))
        .group_by(Review.subject_id)
    ).all()
    # Rounded the same way as the profile endpoint so the two never disagree.
    return {
        subject_id: (round(float(avg), 2), count) for subject_id, avg, count in rows
    }


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