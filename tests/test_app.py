from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi import HTTPException

from src.app import activities, signup_for_activity


def test_root_redirects_to_static_index(client):
    # Act
    response = client.get("/", follow_redirects=False)

    # Assert
    assert response.status_code == 307
    assert response.headers["location"] == "/static/index.html"


def test_get_activities_returns_all_activities_with_details(client):
    # Arrange
    expected_fields = {"description", "schedule", "max_participants", "participants"}

    # Act
    response = client.get("/activities")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data == activities
    assert all(set(details) == expected_fields for details in data.values())


def test_signup_adds_participant(client):
    # Arrange
    activity_name = "Art Club"
    email = "newstudent@mergington.edu"
    activities[activity_name]["participants"] = []

    # Act
    response = client.post(f"/activities/{activity_name}/signup", params={"email": email})

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": f"Signed up {email} for {activity_name}"}
    assert activities[activity_name]["participants"] == [email]


def test_signup_unknown_activity_returns_404(client):
    # Arrange
    activity_name = "Underwater Basket Weaving"
    email = "newstudent@mergington.edu"

    # Act
    response = client.post(f"/activities/{activity_name}/signup", params={"email": email})

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}
    assert activity_name not in activities


def test_signup_duplicate_participant_returns_400(client):
    # Arrange
    activity_name = "Chess Club"
    email = "michael@mergington.edu"
    activities[activity_name]["participants"] = [email]

    # Act
    response = client.post(f"/activities/{activity_name}/signup", params={"email": email})

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "Participant already signed up"}
    assert activities[activity_name]["participants"] == [email]


def test_signup_full_activity_returns_400(client):
    # Arrange
    activity_name = "Chess Club"
    email = "latecomer@mergington.edu"
    max_participants = activities[activity_name]["max_participants"]
    full_roster = [f"student{i}@mergington.edu" for i in range(max_participants)]
    activities[activity_name]["participants"] = list(full_roster)

    # Act
    response = client.post(f"/activities/{activity_name}/signup", params={"email": email})

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "Activity is full"}
    assert activities[activity_name]["participants"] == full_roster


@pytest.mark.parametrize(
    ("emails", "expected_detail"),
    [
        (("newstudent@mergington.edu", "newstudent@mergington.edu"),
         "Participant already signed up"),
        (("firststudent@mergington.edu", "secondstudent@mergington.edu"),
         "Activity is full"),
    ],
)
def test_concurrent_signups_preserve_participant_constraints(emails, expected_detail):
    activity_name = "Art Club"
    activities[activity_name]["participants"] = []
    activities[activity_name]["max_participants"] = 1
    barrier = Barrier(len(emails))

    def signup(email):
        barrier.wait()
        return signup_for_activity(activity_name, email)

    with ThreadPoolExecutor(max_workers=len(emails)) as executor:
        futures = [executor.submit(signup, email) for email in emails]
        responses = []
        errors = []
        for future in futures:
            try:
                responses.append(future.result())
            except HTTPException as error:
                errors.append(error)

    assert len(responses) == 1
    assert len(errors) == 1
    assert errors[0].status_code == 400
    assert errors[0].detail == expected_detail
    assert len(activities[activity_name]["participants"]) == 1


def test_unregister_removes_participant(client):
    # Arrange
    activity_name = "Chess Club"
    email = "michael@mergington.edu"
    other_email = "daniel@mergington.edu"
    activities[activity_name]["participants"] = [email, other_email]

    # Act
    response = client.delete(f"/activities/{activity_name}/unregister", params={"email": email})

    # Assert
    assert response.status_code == 200
    assert response.json() == {"message": f"Unregistered {email} from {activity_name}"}
    assert activities[activity_name]["participants"] == [other_email]


def test_unregister_unknown_activity_returns_404(client):
    # Arrange
    activity_name = "Underwater Basket Weaving"
    email = "michael@mergington.edu"

    # Act
    response = client.delete(f"/activities/{activity_name}/unregister", params={"email": email})

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Activity not found"}


def test_unregister_participant_not_signed_up_returns_404(client):
    # Arrange
    activity_name = "Chess Club"
    email = "stranger@mergington.edu"
    other_email = "daniel@mergington.edu"
    activities[activity_name]["participants"] = [other_email]

    # Act
    response = client.delete(f"/activities/{activity_name}/unregister", params={"email": email})

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "Participant is not signed up for this activity"}
    assert activities[activity_name]["participants"] == [other_email]
