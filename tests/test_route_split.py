import pytest
from fastapi.testclient import TestClient
from backend.app import app
from utils.route_split import (
    find_direct_trains,
    find_split_routes,
    get_live_status_guide,
    extract_station_code
)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_station_code_extraction():
    assert extract_station_code("NDLS - New Delhi") == "NDLS"
    assert extract_station_code("bct") == "BCT"
    assert extract_station_code("  HWH  ") == "HWH"


def test_direct_trains():
    trains = find_direct_trains("NDLS", "HWH")
    assert len(trains) >= 2
    train_numbers = [t["train_number"] for t in trains]
    assert "12302" in train_numbers  # Howrah Rajdhani
    assert "12304" in train_numbers  # Poorva Express
    assert trains[0]["from_station"] == "NDLS"
    assert trains[0]["to_station"] == "HWH"


def test_split_routes():
    alternatives = find_split_routes("NDLS", "HWH", min_layover_hours=1.0, max_layover_hours=8.0)
    assert len(alternatives) > 0
    alt = alternatives[0]
    assert "junction_code" in alt
    assert "leg1" in alt
    assert "leg2" in alt
    assert alt["leg1"]["from"] == "NDLS"
    assert alt["leg2"]["to"] == "HWH"
    assert alt["connecting_pnr_eligible"] is True
    assert alt["layover_minutes"] >= 60


def test_live_status_guide():
    guide = get_live_status_guide("12302")
    assert "12302" in guide["official_web_portal"]["direct_search_url"]
    assert guide["official_sms_service"]["syntax"] == "SPOT 12302"
    assert guide["official_sms_service"]["number"] == "139"


def test_api_route_endpoints(client):
    # Direct trains API
    res_direct = client.get("/api/trains/direct?from_station=NDLS&to_station=HWH")
    assert res_direct.status_code == 200
    data_direct = res_direct.json()
    assert data_direct["count"] >= 2

    # Alternatives API
    res_alt = client.get("/api/trains/alternatives?from_station=NDLS&to_station=HWH")
    assert res_alt.status_code == 200
    data_alt = res_alt.json()
    assert data_alt["alternatives_count"] > 0
    assert "Connecting PNR" in data_alt["connecting_pnr_advisory"]

    # Live status guide API
    res_live = client.get("/api/trains/live-status?train_number=12952")
    assert res_live.status_code == 200
    data_live = res_live.json()
    assert "12952" in data_live["official_sms_service"]["syntax"]
