from datetime import datetime, timezone


def as_utc(value: datetime) -> datetime:
    """Stamp UTC onto a naive datetime read back from the database.

    SQLite has no timezone type, so DateTime(timezone=True) columns come back
    naive there while PostgreSQL returns them aware. A naive value serializes
    without an offset, and the browser then reads it as local time, which slides
    a 2 pm slot by however many hours the student is from UTC. Everything is
    stored in UTC, so naive means UTC.
    """
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def to_utc(value: datetime) -> datetime:
    """Normalize a client-supplied datetime to UTC, refusing a naive one.

    Naive input is ambiguous: we cannot tell whose clock it came from, and
    guessing turns a booking into a no-show.
    """
    if value.tzinfo is None:
        raise ValueError(
            "Send a time with a UTC offset, for example 2026-09-12T14:00:00Z."
        )
    return value.astimezone(timezone.utc)
