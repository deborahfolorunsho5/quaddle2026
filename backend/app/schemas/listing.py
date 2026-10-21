from datetime import datetime

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_PHOTOS = 6
# Matches the old image_url column, so an existing URL always fits.
PhotoUrl = Annotated[str, Field(min_length=1, max_length=500)]

# Three decimal places is roughly 100 m, which reads as "this block" on a map
# without narrowing a provider down to a doorway.
APPROX_DECIMALS = 3

# Every column on Listing except category and the two coordinates is NOT NULL. An explicit null for one of those reaches the database as None
# and surfaces as a 500, so a PATCH must refuse it: leaving a field out is how
# a PATCH says "do not touch this".
NOT_NULLABLE_FIELDS = (
    "title",
    "description",
    "price",
    "is_active",
    "location_is_approximate",
    "image_urls",
)


class ListingOwner(BaseModel):
    """Minimal owner info shown alongside a listing."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str


class ListingCreate(BaseModel):
    """Fields a provider supplies to create a listing."""
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=1)
    price: float = Field(ge=0)
    category: str | None = None
    image_urls: list[PhotoUrl] = Field(default_factory=list, max_length=MAX_PHOTOS)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_is_approximate: bool = False

    @model_validator(mode="after")
    def _coordinates_come_in_pairs(self):
        """Half a pin is not a location, and would render at the equator."""
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be given together")
        return self


class ListingUpdate(BaseModel):
    """All optional — only the provided fields are changed."""
    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = Field(default=None, min_length=1)
    price: float | None = Field(default=None, ge=0)
    category: str | None = None
    # Replaces the whole list: send every photo to keep, in order.
    image_urls: list[PhotoUrl] | None = Field(default=None, max_length=MAX_PHOTOS)
    is_active: bool | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_is_approximate: bool | None = None

    @model_validator(mode="after")
    def _reject_explicit_nulls(self):
        for name in NOT_NULLABLE_FIELDS:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self

    @model_validator(mode="after")
    def _coordinates_move_together(self):
        """Sending one half would leave the stored pin mismatched, so require
        both — including when clearing a pin by sending both as null."""
        sent = self.model_fields_set
        if ("latitude" in sent) != ("longitude" in sent):
            raise ValueError("latitude and longitude must be updated together")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be given together")
        return self


class ListingRead(BaseModel):
    """Shape of a listing returned by the API."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    price: float
    category: str | None
    image_urls: list[str]
    is_active: bool
    university_id: int
    created_at: datetime
    owner: ListingOwner
    latitude: float | None
    longitude: float | None
    location_is_approximate: bool

    @model_validator(mode="after")
    def _coarsen_approximate_pin(self):
        """The precise pin never leaves the database for an approximate
        listing, so rounding here is what actually protects the provider."""
        if (
            self.location_is_approximate
            and self.latitude is not None
            and self.longitude is not None
        ):
            self.latitude = round(self.latitude, APPROX_DECIMALS)
            self.longitude = round(self.longitude, APPROX_DECIMALS)
        return self


class RatedListingOwner(ListingOwner):
    """Owner info plus their overall rating, the same numbers their profile
    shows. Reviews are about people, not listings, so this is the provider's
    rating across everything they have done on Quad."""
    rating_average: float | None = None
    rating_count: int = 0


class ListingBrowseItem(ListingRead):
    """A listing as it appears on a browse card. Only browse pays for the
    rating lookup, so the other endpoints keep returning ListingRead rather
    than a rating_count of 0 that was never actually counted."""
    owner: RatedListingOwner
