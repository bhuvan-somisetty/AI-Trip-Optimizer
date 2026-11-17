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
    assert body["origin"] == "BLR" and body["destination"] == "DEL"
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


def test_create_trip_requires_origin_and_destination(client, auth_headers, trip_payload):
    for field in ("origin", "destination"):
        payload = {k: v for k, v in trip_payload.items() if k != field}
        assert create_trip(client, auth_headers, payload).status_code == 422


def test_create_trip_rejects_malformed_airport_code(client, auth_headers, trip_payload):
    for bad in ("", "BL", "BLRX", "B1R", "Bengaluru"):
        trip_payload["origin"] = bad
        assert create_trip(client, auth_headers, trip_payload).status_code == 422


def test_create_trip_uppercases_airport_codes(client, auth_headers, trip_payload):
    trip_payload["origin"], trip_payload["destination"] = "blr", "del"
    body = create_trip(client, auth_headers, trip_payload).json()
    assert body["origin"] == "BLR" and body["destination"] == "DEL"


def test_create_trip_rejects_same_origin_and_destination(client, auth_headers, trip_payload):
    trip_payload["destination"] = "blr"
    response = create_trip(client, auth_headers, trip_payload)
    assert response.status_code == 422
    assert "Origin and destination must be different" in response.text


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
    assert response.json()["origin"] == "BLR"
    assert response.json()["destination"] == "DEL"


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


# ---- PATCH /trips/{id} ------------------------------------------------------

def update_trip(client, headers, trip_id, changes):
    return client.patch(f"/trips/{trip_id}", json=changes, headers=headers)


def audit_types(client, headers):
    return [e["event_type"] for e in client.get("/audit", headers=headers).json()]


def test_update_trip_changes_only_sent_fields(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    response = update_trip(client, auth_headers, trip_id, {"budget": 5000, "dates": ["2026-11-02", "2026-11-04"]})
    assert response.status_code == 200
    body = response.json()
    assert body["budget"] == 5000
    assert body["dates"] == ["2026-11-02", "2026-11-04"]
    assert body["origin"] == "BLR" and body["destination"] == "DEL"
    assert body["preferences"] == {"class": "economy"}
    assert body["status"] == "DRAFT"
    # Saved, not just echoed back.
    assert client.get(f"/trips/{trip_id}", headers=auth_headers).json()["budget"] == 5000


def test_update_trip_is_audited_with_before_and_after(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    update_trip(client, auth_headers, trip_id, {"budget": 5000})
    event = client.get("/audit", headers=auth_headers).json()[0]
    assert event["event_type"] == "TRIP_UPDATED"
    assert event["payload"]["changes"] == {"budget": {"before": 60000.0, "after": 5000.0}}
    assert event["payload"]["itinerary_dropped"] is False


def test_update_trip_without_changes_writes_no_event(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    response = update_trip(client, auth_headers, trip_id, {"budget": 60000, "origin": "blr"})
    assert response.status_code == 200
    assert "TRIP_UPDATED" not in audit_types(client, auth_headers)


def test_update_optimized_trip_drops_itinerary_and_returns_to_draft(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    assert client.post(f"/trips/{trip_id}/optimize", headers=auth_headers).json()["status"] == "OPTIMIZED"

    response = update_trip(client, auth_headers, trip_id, {"budget": 5000})
    assert response.status_code == 200
    assert response.json()["status"] == "DRAFT"
    assert client.get(f"/trips/{trip_id}/itinerary", headers=auth_headers).status_code == 404
    assert client.get("/audit", headers=auth_headers).json()[0]["payload"]["itinerary_dropped"] is True

    # The next run uses the new budget.
    rerun = client.post(f"/trips/{trip_id}/optimize", headers=auth_headers).json()
    assert rerun["itinerary"]["within_budget"] is False


def test_update_trip_under_review_is_409(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    client.post(f"/trips/{trip_id}/optimize", headers=auth_headers)
    client.post(f"/trips/{trip_id}/review", headers=auth_headers)
    response = update_trip(client, auth_headers, trip_id, {"budget": 5000})
    assert response.status_code == 409
    assert client.get(f"/trips/{trip_id}", headers=auth_headers).json()["budget"] == 60000


def test_update_trip_validates_input(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    for bad in (
        {"budget": 0},
        {"dates": ["2026-11-05", "2026-11-01"]},
        {"origin": "DELHI"},
        {"destination": "BLR"},  # same as the saved origin
        {"budget": None},
    ):
        assert update_trip(client, auth_headers, trip_id, bad).status_code == 422, bad


def test_update_trip_to_another_users_traveler_is_404(client, auth_headers, other_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    theirs = client.post("/traveler", json={"name": "Not mine"}, headers=other_headers).json()["id"]
    response = update_trip(client, auth_headers, trip_id, {"traveler_id": theirs})
    assert response.status_code == 404
    assert response.json()["detail"] == "Traveler not found"


def test_update_another_users_trip_is_404(client, auth_headers, other_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    assert update_trip(client, other_headers, trip_id, {"budget": 1000}).status_code == 404


def test_update_trip_requires_auth(client, auth_headers, trip_payload):
    trip_id = create_trip(client, auth_headers, trip_payload).json()["id"]
    assert update_trip(client, {}, trip_id, {"budget": 1000}).status_code == 401
