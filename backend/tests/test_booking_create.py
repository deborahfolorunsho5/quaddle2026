"""POST /api/bookings: what a customer may request, and against which slot."""
from datetime import timedelta

import pytest

from app.models.booking import Booking

URL = "/api/bookings"
HOUR = timedelta(hours=1)


@pytest.fixture
def maya(make_user, campus):
    return make_user("maya", campus)


@pytest.fixture
def jordan(make_user, campus):
    return make_user("jordan", campus)


@pytest.fixture
def listing(maya, make_listing):
    return make_listing(maya)


@pytest.fixture
def slot(maya, make_slot):
    return make_slot(maya, 3 * HOUR)


def book(client, headers, listing_id, slot_id, **extra):
    return client.post(
        URL, json={"listing_id": listing_id, "slot_id": slot_id, **extra}, headers=headers
    )


def test_a_customer_books_an_open_slot(client, db, auth, jordan, maya, listing, slot):
    response = book(client, auth(jordan), listing.id, slot.id, message="See you there")

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "pending"
    assert body["customer"]["id"] == jordan.id
    # The provider comes from the listing, not from anything the customer sends.
    assert body["provider"]["id"] == maya.id
    assert body["message"] == "See you there"
    # The time is copied off the slot so it survives the slot being released.
    stored = db.get(Booking, body["id"])
    assert stored.slot_id == slot.id
    assert stored.requested_time is not None and stored.requested_end is not None


def test_a_guest_cannot_book(client, listing, slot):
    assert book(client, {}, listing.id, slot.id).status_code == 401


def test_you_cannot_book_your_own_listing(client, auth, maya, listing, slot):
    response = book(client, auth(maya), listing.id, slot.id)

    assert response.status_code == 400
    assert response.json()["detail"] == "You can't book your own listing."


def test_an_unknown_listing_is_not_found(client, auth, jordan, slot):
    assert book(client, auth(jordan), 999, slot.id).status_code == 404


def test_a_hidden_listing_cannot_be_booked(client, db, auth, jordan, listing, slot):
    listing.is_active = False
    db.commit()

    assert book(client, auth(jordan), listing.id, slot.id).status_code == 404


def test_another_campus_cannot_book(client, auth, make_user, other_campus, listing, slot):
    outsider = make_user("elsewhere", other_campus)

    response = book(client, auth(outsider), listing.id, slot.id)

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only book listings on your own campus."


def test_the_slot_must_belong_to_the_listing_owner(
    client, auth, jordan, make_user, campus, listing, make_slot
):
    """A slot from someone else's calendar cannot be attached to this listing."""
    leo = make_user("leo", campus)
    leos_slot = make_slot(leo, 3 * HOUR)

    assert book(client, auth(jordan), listing.id, leos_slot.id).status_code == 404


def test_an_unknown_slot_is_not_found(client, auth, jordan, listing):
    assert book(client, auth(jordan), listing.id, 999).status_code == 404


def test_a_slot_that_already_started_cannot_be_booked(
    client, auth, jordan, maya, listing, make_slot
):
    started = make_slot(maya, -HOUR)

    response = book(client, auth(jordan), listing.id, started.id)

    assert response.status_code == 400
    assert response.json()["detail"] == "That time has already passed."


def test_a_taken_slot_cannot_be_booked_twice(
    client, auth, jordan, make_user, campus, listing, slot
):
    assert book(client, auth(jordan), listing.id, slot.id).status_code == 201

    sam = make_user("sam", campus)
    response = book(client, auth(sam), listing.id, slot.id)

    assert response.status_code == 409


def test_a_message_over_1000_characters_is_rejected(client, auth, jordan, listing, slot):
    response = book(client, auth(jordan), listing.id, slot.id, message="x" * 1001)

    assert response.status_code == 422


def test_the_message_is_trimmed(client, auth, jordan, listing, slot):
    response = book(client, auth(jordan), listing.id, slot.id, message="  hi  ")

    assert response.status_code == 201
    assert response.json()["message"] == "hi"
