from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings

# Algorithm used to sign JWTs.
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Turn a plaintext password into a bcrypt hash for storage.

    bcrypt only uses the first 72 bytes, so we truncate to avoid an error
    on very long inputs."""
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a login attempt against the stored hash."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))


def create_access_token(subject: str | int) -> str:
    """Create a signed JWT whose `sub` claim identifies the user."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)