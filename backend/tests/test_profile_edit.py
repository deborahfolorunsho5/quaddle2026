"""PATCH /api/users/me: a student's own profile photo."""
import pytest

URL = "/api/users/me"
PHOTO = "/media/" + "a" * 32 + ".webp"


@pytest.fixture
def maya(make_user, campus):
    return make_user("maya", campus)


def profile(client, user):
    return client.get(f"/api/users/{user.id}").json()


def test_a_student_sets_a_profile_photo(client, auth, maya):
    response = client.patch(URL, json={"avatar_url": PHOTO}, headers=auth(maya))

    assert response.status_code == 200, response.text
    assert response.json()["avatar_url"] == PHOTO
    # The public profile shows it too, not just the owner's own view.
    assert profile(client, maya)["avatar_url"] == PHOTO


def test_null_removes_the_photo(client, auth, maya):
    client.patch(URL, json={"avatar_url": PHOTO}, headers=auth(maya))

    response = client.patch(URL, json={"avatar_url": None}, headers=auth(maya))

    assert response.status_code == 200
    assert profile(client, maya)["avatar_url"] is None


def test_an_empty_update_changes_nothing(client, auth, maya):
    client.patch(URL, json={"avatar_url": PHOTO}, headers=auth(maya))

    assert client.patch(URL, json={}, headers=auth(maya)).status_code == 200

    assert profile(client, maya)["avatar_url"] == PHOTO


@pytest.mark.parametrize(
    "avatar_url",
    [
        "https://example.com/me.jpg",  # an outside link skips the re-encode
        "javascript:alert(1)",
        "/media/../backend/.env",
        "/media/" + "a" * 32 + ".png",  # uploads are always .webp
        "/media/" + "A" * 32 + ".webp",
        "/media/short.webp",
        "",
    ],
)
def test_only_our_own_uploads_can_be_a_profile_photo(client, auth, maya, avatar_url):
    response = client.patch(URL, json={"avatar_url": avatar_url}, headers=auth(maya))

    assert response.status_code == 422
    assert profile(client, maya)["avatar_url"] is None


def test_a_guest_cannot_edit_a_profile(client, campus):
    assert client.patch(URL, json={"avatar_url": PHOTO}).status_code == 401


def test_editing_never_touches_anyone_else(client, auth, maya, make_user, campus):
    jordan = make_user("jordan", campus)

    client.patch(URL, json={"avatar_url": PHOTO}, headers=auth(maya))

    assert profile(client, jordan)["avatar_url"] is None


@pytest.mark.parametrize(
    "field, value",
    [
        ("username", "taken"),
        ("university_id", 999),
        ("email", "x@y.z"),
        ("is_active", False),
        ("bio", "Not a field any more"),
    ],
)
def test_other_account_fields_cannot_be_changed_here(client, db, auth, maya, field, value):
    """Only the photo is editable; anything else in the body is ignored, most
    importantly the campus, which would otherwise move a student."""
    before = (maya.username, maya.university_id, maya.email, maya.is_active)

    response = client.patch(URL, json={field: value}, headers=auth(maya))

    assert response.status_code == 200
    db.refresh(maya)
    assert (maya.username, maya.university_id, maya.email, maya.is_active) == before
