import re

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

# Exactly what POST /uploads/image hands back, so a profile photo is always one
# of our own re-encoded uploads.
AVATAR_PATH = re.compile(r"/media/[0-9a-f]{32}\.webp")


class UserCreate(BaseModel):
    """Data required to register a new account."""
    username: str
    password: str
    university_id: int
    email: EmailStr | None = None
    full_name: str | None = None


class UserRead(BaseModel):
    """Public shape of a user returned by the API (never includes the hash)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr | None
    full_name: str | None
    avatar_url: str | None = None
    university_id: int


class UserUpdate(BaseModel):
    """What a student may change about their own profile. A field left out
    stays as it is; null clears it."""
    avatar_url: str | None = None

    @field_validator("avatar_url")
    @classmethod
    def _own_upload_only(cls, value: str | None) -> str | None:
        if value is not None and not AVATAR_PATH.fullmatch(value):
            raise ValueError(
                "Upload the photo first, then send the /media/... path it returns."
            )
        return value


class UserProfile(BaseModel):
    """Public profile of a user, including their overall rating."""
    id: int
    username: str
    full_name: str | None
    avatar_url: str | None = None
    university_id: int
    rating_average: float | None = None
    rating_count: int = 0


class Token(BaseModel):
    """What /auth/login returns: the JWT and its type."""
    access_token: str
    token_type: str = "bearer"
