"""POST and DELETE /api/reviews: ratings one student leaves about another."""
import pytest

URL = "/api/reviews"


@pytest.fixture
def maya(make_user, campus):
    return make_user("maya", campus)


@pytest.fixture
def jordan(make_user, campus):
    return make_user("jordan", campus)


def review(client, headers, subject_id, **fields):
    return client.post(URL, json={"subject_id": subject_id, "rating": 5, **fields}, headers=headers)


def test_a_student_reviews_someone_on_their_campus(client, auth, jordan, maya):
    response = review(client, auth(jordan), maya.id, rating=4, comment="On time.", role="provider")

    assert response.status_code == 201, response.text
    body = response.json()
    assert (body["rating"], body["comment"], body["role"]) == (4, "On time.", "provider")
    assert body["author"]["id"] == jordan.id
    assert body["subject_id"] == maya.id


@pytest.mark.parametrize("rating", [1, 5])
def test_the_ends_of_the_scale_are_allowed(client, auth, jordan, maya, rating):
    assert review(client, auth(jordan), maya.id, rating=rating).status_code == 201


@pytest.mark.parametrize("rating", [0, 6, -1, 4.5, "five"])
def test_a_rating_off_the_scale_is_rejected(client, auth, jordan, maya, rating):
    assert review(client, auth(jordan), maya.id, rating=rating).status_code == 422


def test_one_review_per_person(client, auth, jordan, maya):
    assert review(client, auth(jordan), maya.id).status_code == 201

    second = review(client, auth(jordan), maya.id, rating=1)

    assert second.status_code == 409
    assert len(client.get(URL, params={"subject_id": maya.id}).json()) == 1


def test_the_one_per_pair_rule_runs_one_way(client, auth, jordan, maya):
    """Jordan reviewing Maya does not stop Maya reviewing Jordan."""
    assert review(client, auth(jordan), maya.id).status_code == 201
    assert review(client, auth(maya), jordan.id).status_code == 201


def test_you_cannot_review_yourself(client, auth, maya):
    response = review(client, auth(maya), maya.id)

    assert response.status_code == 400
    assert response.json()["detail"] == "You can't review yourself."


def test_an_unknown_person_is_not_found(client, auth, jordan):
    assert review(client, auth(jordan), 999).status_code == 404


def test_another_campus_cannot_be_reviewed(client, auth, jordan, make_user, other_campus):
    outsider = make_user("elsewhere", other_campus)

    response = review(client, auth(jordan), outsider.id)

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only review people on your own campus."


def test_a_guest_cannot_review(client, maya):
    assert review(client, {}, maya.id).status_code == 401


def test_only_the_author_can_delete_a_review(client, auth, jordan, maya, make_user, campus):
    created = review(client, auth(jordan), maya.id).json()
    url = f"{URL}/{created['id']}"

    # Not the subject either: being reviewed does not let you remove it.
    assert client.delete(url, headers=auth(maya)).status_code == 403
    assert client.delete(url, headers=auth(make_user("priya", campus))).status_code == 403
    assert client.delete(url).status_code == 401

    assert client.delete(url, headers=auth(jordan)).status_code == 204
    assert client.get(URL, params={"subject_id": maya.id}).json() == []


def test_after_deleting_you_can_review_again(client, auth, jordan, maya):
    created = review(client, auth(jordan), maya.id, rating=2).json()
    client.delete(f"{URL}/{created['id']}", headers=auth(jordan))

    assert review(client, auth(jordan), maya.id, rating=4).status_code == 201


def test_the_profile_rating_rolls_up_every_review(client, auth, maya, make_user, campus):
    for name, rating in [("a", 5), ("b", 4), ("c", 3)]:
        assert review(client, auth(make_user(name, campus)), maya.id, rating=rating).status_code == 201

    profile = client.get(f"/api/users/{maya.id}").json()

    assert profile["rating_count"] == 3
    assert profile["rating_average"] == 4.0
