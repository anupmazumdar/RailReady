import pytest
from fastapi.testclient import TestClient
from backend.app import app
import storage.db as db


@pytest.fixture
def client(monkeypatch, tmp_path):
    temp_db = tmp_path / "integration_test.db"
    monkeypatch.setattr(db, "DB_PATH", temp_db)
    db.init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_status_endpoint(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "IST" in data["current_time_ist"]
    assert data["compliance"]["irctc_automation"] is False
    assert data["compliance"]["browser_automation"] is False


def test_serve_html_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Tatkal Booking Preparation Assistant" in response.text
    assert "Expected opening time" in response.text


def test_end_to_end_flow(client):
    # 1. Create Journey
    journey_payload = {
        "from_station": "NDLS - New Delhi",
        "to_station": "BCT - Mumbai Central",
        "journey_date": "2026-12-01",
        "preferred_train": "12952 TEJAS RAJ",
        "preferred_class": "3A",
        "tatkal_type": "AC"
    }
    j_res = client.post("/api/journey", json=journey_payload)
    assert j_res.status_code == 200
    j_data = j_res.json()
    assert j_data["journey"]["from_station"] == "NDLS - New Delhi"
    assert "2026-11-30 10:00:00 IST" in j_data["opening_time"]

    # 2. Add 4 Passengers (Tatkal Max)
    names = ["Passenger One", "Passenger Two", "Passenger Three", "Passenger Four"]
    for i, name in enumerate(names, start=1):
        p_res = client.post("/api/passengers", json={
            "name": name,
            "age": 20 + i,
            "gender": "MALE",
            "berth_preference": "Lower",
            "meal_preference": "Veg"
        })
        assert p_res.status_code == 200

    # 3. 5th Passenger must be rejected (Max 4 limit)
    excess_res = client.post("/api/passengers", json={
        "name": "Passenger Five",
        "age": 25,
        "gender": "FEMALE",
        "berth_preference": "Upper",
        "meal_preference": "None"
    })
    assert excess_res.status_code == 400
    assert "maximum of 4 passengers" in excess_res.json()["detail"].lower()

    # 4. Check Clipboard Text Generation
    clip_res = client.get("/api/clipboard/passengers")
    assert clip_res.status_code == 200
    clip_data = clip_res.json()
    assert clip_data["count"] == 4
    assert "Passenger 1" in clip_data["formatted_summary"]
    assert "Passenger 4" in clip_data["formatted_summary"]
    assert "https://www.irctc.co.in" in clip_data["formatted_summary"]

    # 5. Checklist Interaction
    checklist_res = client.get("/api/checklist")
    assert checklist_res.status_code == 200
    items = checklist_res.json()
    assert len(items) == 8

    # Toggle first item
    first_key = items[0]["item_key"]
    toggle_res = client.put(f"/api/checklist/{first_key}", json={"item_key": first_key, "checked": True})
    assert toggle_res.status_code == 200

    # Reset checklist
    reset_res = client.post("/api/checklist/reset")
    assert reset_res.status_code == 200
    items_after_reset = client.get("/api/checklist").json()
    assert all(it["checked"] is False for it in items_after_reset)
