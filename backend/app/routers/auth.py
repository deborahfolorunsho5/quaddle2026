from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.db.session import get_db
from app.models.university import University
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Create a new account tied to a university."""
    # Username must be unique.
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status_code=409, detail="Username already taken")

    # Email, if given, must be unique too.
    if payload.email and db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    # The chosen university must actually exist.
    if not db.get(University, payload.university_id):
        raise HTTPException(status_code=404, detail="University not found")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        university_id=payload.university_id,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Log in with username OR email + password; returns a JWT."""
    # form_data.username holds whatever identifier the user typed.
    identifier = form_data.username
    user = db.scalar(
        select(User).where(
            or_(User.username == identifier, User.email == identifier)
        )
    )
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(access_token=create_access_token(user.id))