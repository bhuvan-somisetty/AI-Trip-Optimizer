import uuid


# ---- POST /traveler --------------------------------------------------------

def test_create_traveler(client, auth_headers):
    response = client.post("/traveler", json={"name": "Asha", "preferences": {"seat": "aisle"}}, headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Asha"
    assert body["preferences"] == {"seat": "aisle"}
    assert uuid.UUID(body["id"])


def test_create_traveler_requires_auth(client):
    assert client.post("/traveler", json={"name": "Asha"}).status_code == 401


def test_create_traveler_missing_name_is_422(client, auth_headers):
    assert client.post("/traveler", json={}, headers=auth_headers).status_code == 422


# ---- GET /travelers ---------------------------------------------------------

def test_list_travelers_returns_only_own(client, auth_headers, other_headers):
    client.post("/traveler", json={"name": "Asha"}, headers=auth_headers)
    client.post("/traveler", json={"name": "Priya"}, headers=auth_headers)
    client.post("/traveler", json={"name": "Rahul"}, headers=other_headers)
    assert len(client.get("/travelers", headers=auth_headers).json()) == 2
    assert len(client.get("/travelers", headers=other_headers).json()) == 1


def test_list_travelers_requires_auth(client):
    assert client.get("/travelers").status_code == 401


# ---- PUT /traveler/{id} -----------------------------------------------------

def test_update_traveler(client, auth_headers, traveler_id):
    response = client.put(
        f"/traveler/{traveler_id}",
        json={"name": "Asha Rao", "preferences": {"seat": "window"}},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == traveler_id
    assert body["name"] == "Asha Rao"
    assert body["preferences"] == {"seat": "window"}
    # The change is really saved, not just echoed back.
    assert client.get("/travelers", headers=auth_headers).json()[0]["name"] == "Asha Rao"


def test_update_traveler_requires_auth(client, traveler_id):
    assert client.put(f"/traveler/{traveler_id}", json={"name": "Asha"}).status_code == 401


def test_update_traveler_missing_name_is_422(client, auth_headers, traveler_id):
    assert client.put(f"/traveler/{traveler_id}", json={}, headers=auth_headers).status_code == 422


def test_update_missing_traveler_is_404(client, auth_headers):
    response = client.put(f"/traveler/{uuid.uuid4()}", json={"name": "Asha"}, headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Traveler not found"


def test_update_another_users_traveler_is_404(client, auth_headers, other_headers, traveler_id):
    response = client.put(f"/traveler/{traveler_id}", json={"name": "Hacked"}, headers=other_headers)
    assert response.status_code == 404
    # The owner's traveler is untouched.
    assert client.get("/travelers", headers=auth_headers).json()[0]["name"] == "Asha"


# ---- DELETE /traveler/{id} --------------------------------------------------

def test_delete_traveler(client, auth_headers):
    traveler_id = client.post("/traveler", json={"name": "Asha"}, headers=auth_headers).json()["id"]
    response = client.delete(f"/traveler/{traveler_id}", headers=auth_headers)
    assert response.status_code == 204
    assert client.get("/travelers", headers=auth_headers).json() == []


def test_delete_traveler_requires_auth(client, traveler_id):
    assert client.delete(f"/traveler/{traveler_id}").status_code == 401


def test_delete_missing_traveler_is_404(client, auth_headers):
    response = client.delete(f"/traveler/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Traveler not found"


def test_delete_another_users_traveler_is_404_not_403(client, auth_headers, other_headers):
    # Same 404 as a missing traveler, so the API doesn't reveal which IDs exist.
    traveler_id = client.post("/traveler", json={"name": "Asha"}, headers=auth_headers).json()["id"]
    response = client.delete(f"/traveler/{traveler_id}", headers=other_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Traveler not found"
    # And it must genuinely still exist — not actually deleted underneath the 404.
    assert len(client.get("/travelers", headers=auth_headers).json()) == 1


def test_delete_traveler_with_existing_trip_is_409(client, auth_headers, traveler_id, trip_payload):
    client.post("/trip", json=trip_payload, headers=auth_headers)
    response = client.delete(f"/traveler/{traveler_id}", headers=auth_headers)
    assert response.status_code == 409
    assert response.json()["detail"] == "Traveler has existing trips and cannot be deleted"
    # Confirm nothing was actually deleted.
    assert len(client.get("/travelers", headers=auth_headers).json()) == 1


def test_delete_traveler_without_trips_still_works(client, auth_headers, traveler_id, trip_payload):
    # Sanity check: a *different* traveler with no trips is still deletable,
    # so the 409 above is really about trips, not a blanket block.
    other_traveler = client.post("/traveler", json={"name": "Priya"}, headers=auth_headers).json()["id"]
    response = client.delete(f"/traveler/{other_traveler}", headers=auth_headers)
    assert response.status_code == 204
