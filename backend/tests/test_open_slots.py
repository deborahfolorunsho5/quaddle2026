"""GET /api/availability/open: every open slot on a campus, for the home screen."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.booking import Booking

URL = "/api/availability/open"
HOUR = timedelta(hours=1)
DAY = timedelta(days=1)


def until(delta):
    """`until` as the browser sends it: an ISO string with an offset."""
    return {"until": (datetime.now(timezone.utc) + delta).isoformat()}


def ids(response):
    assert response.status_code == 200, response.text
    return [slot["id"] for slot in response.json()]


@pytest.fixture
def maya(make_user, campus):
    return make_user("maya", campus)


def test_returns_open_slots_in_start_order(client, maya, make_slot):
    later = make_slot(maya, 5 * HOUR)
    sooner = make_slot(maya, 2 * HOUR)

    response = client.get(URL, params=until(DAY))

    assert ids(response) == [sooner.id, later.id]
    first = response.json()[0]
    assert first["provider_id"] == maya.id
    # A UTC offset on the way out, so the browser does not read it as local time.
    assert first["starts_at"].endswith("Z") or first["starts_at"].endswith("+00:00")


def test_until_is_exclusive_and_past_slots_are_left_out(client, maya, make_slot):
    make_slot(maya, -HOUR)
    inside = make_slot(maya, 2 * HOUR)
    make_slot(maya, 10 * HOUR)

    assert ids(client.get(URL, params=until(6 * HOUR))) == [inside.id]


def test_until_in_the_past_returns_nothing(client, maya, make_slot):
    make_slot(maya, 2 * HOUR)

    assert ids(client.get(URL, params=until(-HOUR))) == []


def test_a_held_slot_is_hidden(client, db, maya, make_user, campus, make_slot, make_listing):
    jordan = make_user("jordan", campus)
    listing = make_listing(maya)
    held = make_slot(maya, 2 * HOUR)
    free = make_slot(maya, 3 * HOUR)
    db.add(
        Booking(
            listing_id=listing.id,
            customer_id=jordan.id,
            provider_id=maya.id,
            slot_id=held.id,
            status="accepted",
        )
    )
    db.commit()

    assert ids(client.get(URL, params=until(DAY))) == [free.id]


def test_declining_a_booking_puts_the_slot_back(
    client, maya, make_user, campus, make_slot, make_listing, auth
):
    """End to end through the bookings API: decline nulls the booking's slot,
    which is what releases it."""
    jordan = make_user("jordan", campus)
    listing = make_listing(maya)
    slot = make_slot(maya, 2 * HOUR)

    created = client.post(
        "/api/bookings",
        json={"listing_id": listing.id, "slot_id": slot.id},
        headers=auth(jordan),
    )
    assert created.status_code == 201, created.text
    assert ids(client.get(URL, params=until(DAY))) == []

    declined = client.patch(
        f"/api/bookings/{created.json()['id']}",
        json={"status": "declined"},
        headers=auth(maya),
    )
    assert declined.status_code == 200, declined.text
    assert ids(client.get(URL, params=until(DAY))) == [slot.id]


def test_guests_see_only_the_active_campus(
    client, maya, make_user, other_campus, make_slot
):
    elsewhere = make_user("elsewhere", other_campus)
    ours = make_slot(maya, 2 * HOUR)
    make_slot(elsewhere, 2 * HOUR)

    assert ids(client.get(URL, params=until(DAY))) == [ours.id]


def test_a_student_sees_only_their_own_campus(
    client, maya, make_user, other_campus, make_slot, auth
):
    elsewhere = make_user("elsewhere", other_campus)
    neighbour = make_user("neighbour", other_campus)
    make_slot(maya, 2 * HOUR)
    theirs = make_slot(neighbour, 3 * HOUR)

    response = client.get(URL, params=until(DAY), headers=auth(elsewhere))

    assert ids(response) == [theirs.id]


def test_deactivated_providers_are_hidden(client, maya, make_user, campus, make_slot):
    gone = make_user("gone", campus, is_active=False)
    make_slot(gone, 2 * HOUR)
    open_slot = make_slot(maya, 3 * HOUR)

    assert ids(client.get(URL, params=until(DAY))) == [open_slot.id]


def test_until_is_capped_at_a_week(client, maya, make_slot):
    within = make_slot(maya, 6 * DAY)
    make_slot(maya, 9 * DAY)

    assert ids(client.get(URL, params=until(30 * DAY))) == [within.id]


def test_an_offset_names_the_same_instant(client, maya, make_slot):
    """A -05:00 time five hours "earlier" on the clock is the same moment, so
    it must not cut the window short. SQLite drops offsets on bound values,
    which is why the route converts to UTC first."""
    inside = make_slot(maya, 4 * HOUR)
    make_slot(maya, 8 * HOUR)
    cutoff = (datetime.now(timezone.utc) + 6 * HOUR).astimezone(
        timezone(timedelta(hours=-5))
    )

    assert ids(client.get(URL, params={"until": cutoff.isoformat()})) == [inside.id]


def test_a_time_without_an_offset_is_refused(client, campus):
    naive = (datetime.now(timezone.utc) + DAY).replace(tzinfo=None).isoformat()

    response = client.get(URL, params={"until": naive})

    assert response.status_code == 400
    assert "UTC offset" in response.json()["detail"]


@pytest.mark.parametrize("params", [{}, {"until": "tomorrow"}, {"until": ""}])
def test_a_missing_or_malformed_until_is_rejected(client, campus, params):
    assert client.get(URL, params=params).status_code == 422
