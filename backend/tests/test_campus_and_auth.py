"""Campus scoping and the line between guests and signed-in students, on the
routes the other test files do not already cover."""
from datetime import timedelta

import pytest


@pytest.fixture
def maya(make_user, campus):
    return make_user("maya", campus)


@pytest.fixture
def outsider(make_user, other_campus):
    return make_user("elsewhere", other_campus)


def titles(response):
    assert response.status_code == 200, response.text
    return sorted(listing["title"] for listing in response.json())


def test_browse_shows_a_student_their_own_campus(
    client, auth, maya, outsider, make_listing, make_user, other_campus
):
    make_listing(maya, "Calc II tutoring")
    make_listing(make_user("neighbour", other_campus), "Their tutoring")

    assert titles(client.get("/api/listings", headers=auth(maya))) == ["Calc II tutoring"]
    assert titles(client.get("/api/listings", headers=auth(outsider))) == ["Their tutoring"]


def test_browse_shows_a_guest_the_campus_quad_is_open_to(
    client, maya, make_listing, make_user, other_campus
):
    make_listing(maya, "Calc II tutoring")
    make_listing(make_user("neighbour", other_campus), "Their tutoring")

    assert titles(client.get("/api/listings")) == ["Calc II tutoring"]


def test_a_hidden_listing_shows_only_on_its_owners_profile(
    client, db, auth, maya, make_user, campus, make_listing
):
    listing = make_listing(maya, "Calc II tutoring")
    listing.is_active = False
    db.commit()
    jordan = make_user("jordan", campus)
    mine = {"owner_id": maya.id}

    assert titles(client.get("/api/listings", headers=auth(jordan))) == []
    assert titles(client.get("/api/listings", params=mine, headers=auth(jordan))) == []
    assert titles(client.get("/api/listings", params=mine, headers=auth(maya))) == [
        "Calc II tutoring"
    ]


def test_a_student_cannot_see_another_campus_calendar(
    client, auth, maya, outsider, make_slot
):
    make_slot(maya, timedelta(hours=3))

    response = client.get(
        "/api/availability", params={"provider_id": maya.id}, headers=auth(outsider)
    )

    assert response.status_code == 403


def test_a_student_cannot_message_another_campus(client, auth, maya, outsider):
    response = client.post(
        "/api/conversations", json={"user_id": maya.id}, headers=auth(outsider)
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only message people on your own campus."


def test_only_the_owner_can_edit_or_delete_a_listing(
    client, auth, maya, make_user, campus, make_listing
):
    listing = make_listing(maya)
    url = f"/api/listings/{listing.id}"
    jordan = make_user("jordan", campus)

    assert client.patch(url, json={"price": 1}, headers=auth(jordan)).status_code == 403
    assert client.delete(url, headers=auth(jordan)).status_code == 403
    assert client.get(url).json()["price"] == 25


def test_a_new_listing_lands_on_its_owners_campus(client, auth, outsider):
    """The campus comes from the account, so a student cannot post elsewhere."""
    response = client.post(
        "/api/listings",
        json={
            "title": "Bike tune-ups",
            "description": "Same day.",
            "price": 15,
            "university_id": 1,
        },
        headers=auth(outsider),
    )

    assert response.status_code == 201, response.text
    assert response.json()["university_id"] == outsider.university_id


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("post", "/api/listings", {"title": "x", "description": "x", "price": 1}),
        ("post", "/api/bookings", {"listing_id": 1, "slot_id": 1}),
        ("post", "/api/reviews", {"subject_id": 1, "rating": 5}),
        ("post", "/api/availability", {"starts_at": "2030-01-01T10:00:00Z", "ends_at": "2030-01-01T11:00:00Z"}),
        ("post", "/api/conversations", {"user_id": 1}),
        ("get", "/api/bookings/mine", None),
        ("get", "/api/bookings/incoming", None),
        ("get", "/api/availability/mine", None),
        ("get", "/api/conversations", None),
        ("get", "/api/users/me", None),
    ],
)
def test_guests_are_turned_away_from_account_routes(client, campus, method, path, body):
    kwargs = {"json": body} if body is not None else {}

    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_a_bad_token_is_treated_as_no_token(client, campus):
    headers = {"Authorization": "Bearer not-a-real-token"}

    assert client.get("/api/users/me", headers=headers).status_code == 401


@pytest.mark.parametrize(
    "path", ["/api/listings", "/api/universities", "/api/health"]
)
def test_guests_can_browse(client, campus, path):
    assert client.get(path).status_code == 200
