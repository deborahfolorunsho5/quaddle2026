import os

# Point settings at SQLite before anything imports app.db.session, which builds
# its engine at import time. Without this the tests would open whatever
# DATABASE_URL backend/.env names, which may be the real Postgres database.
os.environ["DATABASE_URL"] = "sqlite://"

from datetime import datetime, timedelta, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401  registers every table on Base.metadata
from app.core.config import settings  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.availability import AvailabilitySlot  # noqa: E402
from app.models.listing import Listing  # noqa: E402
from app.models.university import University  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture
def db():
    """A fresh in-memory database per test, built from the models.

    StaticPool keeps the single connection alive, since each new connection to
    "sqlite://" would otherwise be an empty database of its own. The schema
    comes from the models rather than Alembic, because one migration alters a
    constraint, which SQLite cannot do outside batch mode.
    """
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture
def client(db):
    def use_test_db():
        yield db

    app.dependency_overrides[get_db] = use_test_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def campus(db):
    """The campus Quad is open to, which guests are scoped to."""
    university = University(name=settings.ACTIVE_CAMPUS_NAME)
    db.add(university)
    db.commit()
    return university


@pytest.fixture
def other_campus(db):
    university = University(name="Some Other University")
    db.add(university)
    db.commit()
    return university


@pytest.fixture
def make_user(db):
    def make(username, university, is_active=True):
        # Never logs in with a password, so the hash only has to be present.
        user = User(
            username=username,
            hashed_password="unused",
            university_id=university.id,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        return user

    return make


@pytest.fixture
def auth():
    """Headers that sign a request in as `user`."""
    return lambda user: {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def make_slot(db):
    def make(provider, starts_in, length=timedelta(hours=1)):
        starts_at = datetime.now(timezone.utc) + starts_in
        slot = AvailabilitySlot(
            provider_id=provider.id, starts_at=starts_at, ends_at=starts_at + length
        )
        db.add(slot)
        db.commit()
        return slot

    return make


@pytest.fixture
def make_listing(db):
    def make(owner, title="Calc II tutoring"):
        listing = Listing(
            title=title,
            description="Weekly sessions before exams.",
            price=25,
            owner_id=owner.id,
            university_id=owner.university_id,
        )
        db.add(listing)
        db.commit()
        return listing

    return make
