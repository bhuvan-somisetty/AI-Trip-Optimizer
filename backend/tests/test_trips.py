import uuid


def create_trip(client, headers, payload):
    return client.post("/trip", json=payload, headers=headers)


# ---- POST /trip -----------------------------------------------------------

def test_create_trip_starts_as_draft(client, auth_headers, trip_payload):
    response = create_trip(client, auth_headers, trip_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "DRAFT"
    assert body["dates"] == ["2026-11-01", "2026-11-05"]
    assert body["traveler_id"] == trip_payload["traveler_id"]
    assert body["preferences"] == {"class": "economy"}
    assert body["budget"] == 60000 and isinstance(body["budget"], (int, float))
    assert uuid.UUID(body["id"])


def test_create_trip_requires_auth(client, trip_payload):
    assert create_trip(client, {}, trip_payload).status_code == 401


def test_create_trip_unknown_traveler_is_404(client, auth_headers, trip_payload):
    trip_payload["traveler_id"] = str(uuid.uuid4())
    response = create_trip(client, auth_headers, trip_payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Traveler not found"


def test_create_trip_for_another_users_traveler_is_404(client, other_headers, trip_payload):
    response = create_trip(client, other_headers, trip_payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Traveler not found"


def test_create_trip_missing_budget_is_422(client, auth_headers, trip_payload):
    del trip_payload["budget"]
    response = create_trip(client, auth_headers, trip_payload)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "budget"]


def test_create_trip_rejects_non_positive_budget(client, auth_headers, trip_payload):
    for bad in (0, -100):
        trip_payload["budget"] = bad
        assert create_trip(client, auth_headers, trip_payload).status_code == 422


def test_create_trip_rejects_end_before_start(client, auth_headers, trip_payload):
    trip_payload["dates"] = ["2026-11-05", "2026-11-01"]
    assert create_trip(client, auth_headers, trip_payload).status_code == 422


def test_create_trip_rejects_malformed_dates(client, auth_headers, trip_payload):
    for bad in (["2026-11-01"], "2026-11-01", ["not-a-date", "2026-11-05"]):
        trip_payload["dates"] = bad
        assert create_trip(client, auth_headers, trip_payload).status_code == 422


def test_create_trip_allows_same_day(client, auth_headers, trip_payload):
    trip_payload["dates"] = ["2026-11-01", "2026-11-01"]
    assert create_trip(client, auth_headers, trip_payload).status_code == 201


# ---- GET /trips -----------------------------------------------------------

def test_list_trips_requires_auth(client):
    assert client.get("/trips").status_code == 401


def test_list_trips_empty(client, auth_headers):
    response = client.get("/trips", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_trips_returns_only_own_trips(client, auth_headers, other_headers, trip_payload):
    create_trip(client, auth_headers, trip_payload)
    create_trip(client, auth_headers, trip_payload)
    assert len(client.get("/trips", headers=auth_headers).json()) == 2
    assert client.get("/trips", headers=other_headers).json() == []


def test_list_trips_status_filter(client, auth_headers, trip_payload):
    create_trip(client, auth_headers, trip_payload)
    drafts = client.get("/trips?status=DRAFT", headers=auth_headers)
    assert drafts.status_code == 200 and len(drafts.json()) == 1
    optimized = client.get("/trips?status=OPTIMIZED", headers=auth_headers)
    assert optimized.status_code == 200 and optimized.json() == []


def test_list_trips_invalid_status_is_422(client, auth_headers):
    assert client.get("/trips?status=BOGUS", headers=auth_headers).status_code == 422


# ---- GET /trips/{id} ------------------------------------------------------

def test_get_trip_returns_detail(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    response = client.get(f"/trips/{trip_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == trip_id
    assert response.json()["status"] == "DRAFT"


def test_get_trip_requires_auth(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    assert client.get(f"/trips/{trip_id}").status_code == 401


def test_get_trip_missing_is_404(client, auth_headers):
    response = client.get(f"/trips/{uuid.uuid4()}", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_get_another_users_trip_is_404_not_403(client, auth_headers, other_headers, trip_payload):
    # Same 404 as a missing trip, so the API doesn't reveal which trip IDs exist.
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    response = client.get(f"/trips/{trip_id}", headers=other_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_get_trip_malformed_id_is_422(client, auth_headers):
    assert client.get("/trips/not-a-uuid", headers=auth_headers).status_code == 422
