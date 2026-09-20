"""Automated verification suite for RailReady expanded capabilities."""
import pytest
from fastapi.testclient import TestClient
from backend.app import app
from storage.db import init_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    init_db()


def test_station_search_and_lookup():
    # Popular stations default
    r1 = client.get("/api/stations/search")
    assert r1.status_code == 200
    stations = r1.json()
    assert len(stations) > 0
    codes = [s["code"] for s in stations]
    assert "NDLS" in codes or "DHN" in codes

    # Search by code
    r2 = client.get("/api/stations/search?query=DHN")
    assert r2.status_code == 200
    res2 = r2.json()
    assert len(res2) >= 1
    assert res2[0]["code"] == "DHN"
    assert res2[0]["name"] == "Dhanbad Junction"

    # Search by city/name
    r3 = client.get("/api/stations/search?query=Jaipur")
    assert r3.status_code == 200
    res3 = r3.json()
    assert any(s["code"] in ["JP", "KWP"] for s in res3)

    # Specific station by code
    r4 = client.get("/api/stations/KWP")
    assert r4.status_code == 200
    assert r4.json()["name"] == "Khatipura"

    # Non-existent code
    r5 = client.get("/api/stations/NONEXISTENT99")
    assert r5.status_code == 404


def test_pnr_validation_and_simulation():
    # Valid 10 digit PNR
    valid_pnr = "2458917234"
    r1 = client.get(f"/api/pnr/{valid_pnr}")
    assert r1.status_code == 200
    data = r1.json()
    assert data["pnr_number"] == valid_pnr
    assert "train_number" in data
    assert "train_name" in data
    assert len(data["passengers"]) >= 1
    assert data["chart_status"] in ["CHART PREPARED", "CHART NOT PREPARED"]
    assert data["is_mock"] is True
    assert "Offline Simulation" in data["notice"]

    # Invalid PNR: 9 digits
    r2 = client.get("/api/pnr/123456789")
    assert r2.status_code == 400
    assert "Invalid PNR" in r2.json()["detail"]

    # Invalid PNR: letters
    r3 = client.get("/api/pnr/245891ABCD")
    assert r3.status_code == 400


def test_reference_trains_and_corridor_search():
    # DHN to KWP search
    r1 = client.get("/api/trains/search?from_station=DHN&to_station=KWP")
    assert r1.status_code == 200
    trains = r1.json()
    assert len(trains) >= 1
    train_numbers = [t["train_number"] for t in trains]
    assert "12307" in train_numbers or "12987" in train_numbers

    # Direct search for 12307 Jodhpur SF Express
    r2 = client.get("/api/trains/12307")
    assert r2.status_code == 200
    t12307 = r2.json()
    assert t12307["train_number"] == "12307"
    assert "Jodhpur" in t12307["train_name"]
    assert len(t12307["stops"]) >= 10
    stop_codes = [s["station_code"] for s in t12307["stops"]]
    assert "DHN" in stop_codes
    assert "PNME" in stop_codes
    assert "KQR" in stop_codes
    assert "KWP" in stop_codes
    assert "JP" in stop_codes

    # Running status
    r3 = client.get("/api/trains/12307/running-status")
    assert r3.status_code == 200
    status_data = r3.json()
    assert status_data["train_number"] == "12307"
    assert status_data["current_status"] == "RUNNING"
    assert len(status_data["timeline"]) >= 10


def test_coach_composition():
    # Coach layout for 12307 (Superfast Express)
    r1 = client.get("/api/trains/12307/coaches")
    assert r1.status_code == 200
    comp1 = r1.json()
    assert comp1["train_number"] == "12307"
    assert comp1["total_coaches"] >= 16
    coach_codes = [c["coach_code"] for c in comp1["coaches"]]
    assert any("S1" in code for code in coach_codes)
    assert any("B1" in code for code in coach_codes)
    assert any("A1" in code for code in coach_codes)

    # Coach layout for 12952 (Rajdhani)
    r2 = client.get("/api/trains/12952/coaches")
    assert r2.status_code == 200
    comp2 = r2.json()
    assert comp2["total_coaches"] >= 14
    assert any("H1" in c["coach_code"] for c in comp2["coaches"])


def test_search_history_crud():
    # Add history entry
    item = {
        "train_number": "12307",
        "train_name": "Jodhpur Superfast Express",
        "from_station": "DHN",
        "to_station": "KWP",
        "journey_date": "2026-09-25"
    }
    r1 = client.post("/api/history", json=item)
    assert r1.status_code == 200
    saved = r1.json()
    assert saved["from_station"] == "DHN"
    assert saved["to_station"] == "KWP"
    item_id = saved["id"]

    # List history
    r2 = client.get("/api/history")
    assert r2.status_code == 200
    hist = r2.json()
    assert any(h["id"] == item_id for h in hist)

    # Delete single item
    r3 = client.delete(f"/api/history/{item_id}")
    assert r3.status_code == 200

    # Clear all
    r4 = client.delete("/api/history")
    assert r4.status_code == 200
    r5 = client.get("/api/history")
    assert len(r5.json()) == 0


def test_alerts_crud():
    # Add alert
    alert = {
        "alert_type": "DEPARTURE",
        "train_number": "12307",
        "train_name": "Jodhpur Superfast Express",
        "title": "Departure Reminder",
        "message": "Train 12307 departs from DHN Platform 3 in 30 minutes",
        "trigger_time": "02:55",
        "enabled": True
    }
    r1 = client.post("/api/alerts", json=alert)
    assert r1.status_code == 200
    saved_alert = r1.json()
    alert_id = saved_alert["id"]
    assert saved_alert["enabled"] is True

    # List alerts
    r2 = client.get("/api/alerts")
    assert r2.status_code == 200
    assert any(a["id"] == alert_id for a in r2.json())

    # Toggle alert
    r3 = client.put(f"/api/alerts/{alert_id}/toggle?enabled=false")
    assert r3.status_code == 200
    assert r3.json()["enabled"] is False

    # Delete alert
    r4 = client.delete(f"/api/alerts/{alert_id}")
    assert r4.status_code == 200
