from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# SQLite needs this flag to allow use across FastAPI's threads.
# (Ignored automatically when we switch to PostgreSQL.)
connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency: hands a database session to a route, then
    always closes it afterwards (even if the request errors)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()