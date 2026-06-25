"""Populate the database with the list of US universities.

Reads names from data/us_universities.json (sourced from the open Hipolabs
university dataset, filtered to the United States).

Run from the backend/ directory:  python seed.py
Safe to run multiple times — it only inserts universities not already present.
"""
import json
from pathlib import Path

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.university import University

DATA_FILE = Path(__file__).parent / "data" / "us_universities.json"


def seed() -> None:
    names = json.loads(DATA_FILE.read_text())
    db = SessionLocal()
    try:
        existing = set(db.scalars(select(University.name)).all())
        new_names = [n for n in names if n not in existing]
        db.add_all([University(name=n) for n in new_names])
        db.commit()
        print(f"Seed complete. Added {len(new_names)}, "
              f"{len(existing)} already present "
              f"({len(names)} total in data file).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()