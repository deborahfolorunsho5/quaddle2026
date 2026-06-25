from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import get_db
from app.models.user import User

# Tells FastAPI/Swagger where to get a token, and to read it from the
# "Authorization: Bearer <token>" header.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Same, but auto_error=False means a missing token is allowed (no 401) —
# used for routes that guests may access, like browsing listings.
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency for protected routes: decodes the JWT, looks up the user,
    and returns them. Raises 401 if the token is missing/invalid."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.get(User, int(user_id))
    if user is None:
        raise credentials_error
    return user


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """For guest-friendly routes: returns the logged-in user if a valid token
    is present, otherwise None (no error). Lets guests browse while still
    letting us tailor results for logged-in users."""
    if token is None:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    return db.get(User, int(user_id))