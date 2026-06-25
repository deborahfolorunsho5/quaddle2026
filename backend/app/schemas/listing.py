from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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


class ListingUpdate(BaseModel):
    """All optional — only the provided fields are changed."""
    title: str | None = Field(default=None, min_length=3, max_length=150)
    description: str | None = Field(default=None, min_length=1)
    price: float | None = Field(default=None, ge=0)
    category: str | None = None
    image_url: str | None = None
    is_active: bool | None = None


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