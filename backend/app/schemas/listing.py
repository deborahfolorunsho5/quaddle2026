from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Three decimal places is roughly 100 m, which reads as "this block" on a map
# without narrowing a provider down to a doorway.
APPROX_DECIMALS = 3

# Every column on Listing except category, image_url, and the two coordinates
# is NOT NULL. An explicit null for one of those reaches the database as None
# and surfaces as a 500, so a PATCH must refuse it: leaving a field out is how
# a PATCH says "do not touch this".
NOT_NULLABLE_FIELDS = (
    "title",
    "description",
    "price",
    "is_active",
    "location_is_approximate",
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
    image_url: str | None = None
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
    image_url: str | None = None
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
    image_url: str | None
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
