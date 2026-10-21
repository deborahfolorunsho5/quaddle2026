"""PATCH /api/bookings/{id}: who may move a booking to which status."""
from datetime import timedelta
from itertools import product

import pytest

from app.models.booking import BOOKING_STATUSES, Booking

# Spelled out here rather than imported from the router: a test that reads the
# rule from the code under test would agree with any bug in it.
ALLOWED = {
    ("provider", "pending", "accepted"),
    ("provider", "pending", "declined"),
    ("provider", "accepted", "completed"),
    ("customer", "pending", "cancelled"),
    ("customer", "accepted", "cancelled"),
}
# What BookingStatusUpdate accepts. "pending" is where every booking starts and
# is never a destination.
TARGETS = ("accepted", "declined", "completed", "cancelled")
RELEASING = {"declined", "cancelled"}


@pytest.fixture
def people(make_user, campus):
    return {
        "provider": make_user("maya", campus),
        "customer": make_user("jordan", campus),
        "outsider": make_user("priya", campus),
    }


@pytest.fixture
def booking_in(db, people, make_listing, make_slot):
    """A booking already in `status`, shaped the way the API would leave it:
    a released one no longer holds its slot."""

    def make(status):
        listing = make_listing(people["provider"])
        slot = make_slot(people["provider"], timedelta(hours=3))
        booking = Booking(
            listing_id=listing.id,
            customer_id=people["customer"].id,
            provider_id=people["provider"].id,
            slot_id=None if status in RELEASING else slot.id,
            status=status,
            requested_time=slot.starts_at,
            requested_end=slot.ends_at,
        )
        db.add(booking)
        db.commit()
        return booking

    return make


def patch(client, booking, status, headers):
    return client.patch(
        f"/api/bookings/{booking.id}", json={"status": status}, headers=headers
    )


@pytest.mark.parametrize(
    "role, current, target",
    list(product(("provider", "customer"), BOOKING_STATUSES, TARGETS)),
)
def test_every_transition_for_both_sides(
    client, db, people, booking_in, auth, role, current, target
):
    booking = booking_in(current)

    response = patch(client, booking, target, auth(people[role]))

    db.refresh(booking)
    if (role, current, target) in ALLOWED:
        assert response.status_code == 200, response.text
        assert response.json()["status"] == target
        assert booking.status == target
    else:
        assert response.status_code == 400, response.text
        assert response.json()["detail"] == (
            f"A {role} can't change a {current} booking to {target}."
        )
        # A refused move changes nothing, the held slot included.
        assert booking.status == current


@pytest.mark.parametrize("current", BOOKING_STATUSES)
def test_someone_outside_the_booking_cannot_touch_it(
    client, db, people, booking_in, auth, current
):
    booking = booking_in(current)

    for target in TARGETS:
        response = patch(client, booking, target, auth(people["outsider"]))
        assert response.status_code == 403
        assert response.json()["detail"] == "Not your booking"

    db.refresh(booking)
    assert booking.status == current


def test_a_guest_is_turned_away(client, db, booking_in):
    booking = booking_in("pending")

    assert patch(client, booking, "accepted", {}).status_code == 401

    db.refresh(booking)
    assert booking.status == "pending"


def test_an_unknown_booking_is_not_found(client, people, auth):
    response = client.patch(
        "/api/bookings/999", json={"status": "accepted"}, headers=auth(people["provider"])
    )

    assert response.status_code == 404


@pytest.mark.parametrize("status", ["pending", "done", "", "ACCEPTED"])
def test_a_status_outside_the_schema_is_rejected(client, people, booking_in, auth, status):
    booking = booking_in("pending")

    assert patch(client, booking, status, auth(people["provider"])).status_code == 422


@pytest.mark.parametrize(
    "role, current, target",
    [
        ("provider", "pending", "declined"),
        ("customer", "pending", "cancelled"),
        ("customer", "accepted", "cancelled"),
    ],
)
def test_declining_or_cancelling_frees_the_slot_for_someone_else(
    client, db, people, booking_in, auth, make_user, campus, role, current, target
):
    booking = booking_in(current)
    slot_id = booking.slot_id
    asked_for = booking.requested_time

    assert patch(client, booking, target, auth(people[role])).status_code == 200

    db.refresh(booking)
    assert booking.slot_id is None
    # The booking still says which time it was for after letting go of it.
    assert booking.requested_time == asked_for

    other = make_user("sam", campus)
    rebooked = client.post(
        "/api/bookings",
        json={"listing_id": booking.listing_id, "slot_id": slot_id},
        headers=auth(other),
    )
    assert rebooked.status_code == 201, rebooked.text


@pytest.mark.parametrize(
    "role, current, target",
    [("provider", "pending", "accepted"), ("provider", "accepted", "completed")],
)
def test_accepting_or_completing_keeps_the_slot_held(
    client, db, people, booking_in, auth, make_user, campus, role, current, target
):
    booking = booking_in(current)
    slot_id = booking.slot_id

    assert patch(client, booking, target, auth(people[role])).status_code == 200

    db.refresh(booking)
    assert booking.slot_id == slot_id
    other = make_user("sam", campus)
    rebooked = client.post(
        "/api/bookings",
        json={"listing_id": booking.listing_id, "slot_id": slot_id},
        headers=auth(other),
    )
    assert rebooked.status_code == 409


def test_the_full_happy_path_ends_at_completed(client, people, booking_in, auth):
    booking = booking_in("pending")
    provider, customer = auth(people["provider"]), auth(people["customer"])

    assert patch(client, booking, "accepted", provider).status_code == 200
    assert patch(client, booking, "completed", provider).status_code == 200

    # Completed is final: neither side can move it anywhere.
    for headers in (provider, customer):
        for target in TARGETS:
            assert patch(client, booking, target, headers).status_code == 400
