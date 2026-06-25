from pydantic import BaseModel, EmailStr, ConfigDict


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
    university_id: int


class UserProfile(BaseModel):
    """Public profile of a user, including their overall rating."""
    id: int
    username: str
    full_name: str | None
    university_id: int
    rating_average: float | None = None
    rating_count: int = 0


class Token(BaseModel):
    """What /auth/login returns: the JWT and its type."""
    access_token: str
    token_type: str = "bearer"
