import time
import pytest
from fastapi.testclient import TestClient
from backend.app import app
from backend.train_info.providers.mock_provider import MockTrainDataProvider
from backend.train_info.providers.factory import get_train_data_provider
from backend.train_info.services.cache_service import InMemoryCacheService
from backend.train_info.services.train_service import TrainService


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def mock_provider():
    return MockTrainDataProvider()


def test_train_search_by_number(mock_provider):
    results = mock_provider.search_trains(query="12302")
    assert len(results) == 1
    assert results[0].train_number == "12302"
    assert "Howrah Rajdhani" in results[0].train_name


def test_train_search_by_name(mock_provider):
    results = mock_provider.search_trains(query="Shatabdi")
    assert len(results) >= 2
    names = [r.train_name for r in results]
    assert any("Lucknow Shatabdi" in n for n in names)
    assert any("Ajmer Shatabdi" in n for n in names)


def test_train_search_by_station_pair(mock_provider):
    results = mock_provider.search_trains(from_station="NDLS", to_station="BCT")
    assert len(results) >= 1
    assert any(r.train_number == "12952" for r in results)

    # Jaipur to Mumbai
    jp_results = mock_provider.search_trains(from_station="JP", to_station="BCT")
    assert len(jp_results) >= 1
    assert jp_results[0].train_number == "12956"


def test_auto_find_trains_all_categories_by_route(mock_provider):
    # Route search with only route details (NDLS -> BCT)
    results = mock_provider.search_trains(from_station="NDLS", to_station="BCT")
    assert len(results) >= 4
    types = {r.train_type for r in results}
    assert "Rajdhani" in types
    assert "Special" in types
    assert any(t in types for t in ["Mail/Express", "Superfast"])
    assert "Passenger" in types

    # Arbitrary route search with zero manual train details (MAS to SBC)
    sbc_results = mock_provider.search_trains(from_station="MAS", to_station="SBC")
    assert len(sbc_results) >= 4
    sbc_types = {r.train_type for r in sbc_results}
    assert "Rajdhani" in sbc_types
    assert "Special" in sbc_types
    assert "Mail/Express" in sbc_types
    assert "Passenger" in sbc_types


def test_train_details(mock_provider):
    details = mock_provider.get_train_details("12952")
    assert details is not None
    assert details.train_number == "12952"
    assert details.source_code == "NDLS"
    assert details.dest_code == "BCT"
    assert details.pantry is True
    assert len(details.stops) == 7
    assert details.stops[0].station_code == "NDLS"
    assert details.stops[-1].station_code == "BCT"

    # Non-existent
    bad_details = mock_provider.get_train_details("99999")
    assert bad_details is None


def test_train_route_timeline(mock_provider):
    stops = mock_provider.get_train_route("12015")
    assert len(stops) >= 5
    assert stops[0].station_code == "NDLS"
    assert stops[0].halt_minutes == 0
    # Intermediate station has halt
    assert any(s.station_code == "JP" and s.halt_minutes == 5 for s in stops)


def test_running_status(mock_provider):
    status = mock_provider.get_running_status("12302", "2026-10-15")
    assert status is not None
    assert status.train_number == "12302"
    assert status.current_status == "RUNNING"
    assert status.delay_minutes >= 0
    assert "IST" in status.last_updated
    assert len(status.timeline) > 0
    assert status.timeline[0].has_departed is True


def test_cache_service_ttl_and_stale():
    cache = InMemoryCacheService()
    cache.set("test_key", {"val": 42}, ttl=0.1)

    # Immediate get: fresh
    data, is_stale = cache.get("test_key")
    assert data == {"val": 42}
    assert is_stale is False

    # Wait for TTL to expire but within grace period (0.1 < 0.18 < 0.3)
    time.sleep(0.18)
    data_stale, is_stale = cache.get("test_key")
    assert data_stale == {"val": 42}
    assert is_stale is True

    # Wait for grace period expiration (age > 0.3)
    time.sleep(0.2)
    data_expired, _ = cache.get("test_key")
    assert data_expired is None


def test_provider_factory():
    provider = get_train_data_provider()
    assert isinstance(provider, MockTrainDataProvider)


def test_api_train_info_endpoints(client):
    # 1. Search
    res_search = client.get("/api/trains/search?query=Rajdhani")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert len(search_data) >= 2

    # 2. Details
    res_details = client.get("/api/trains/12302")
    assert res_details.status_code == 200
    details_data = res_details.json()
    assert details_data["train_number"] == "12302"
    assert "Howrah Rajdhani" in details_data["train_name"]

    # 3. Route
    res_route = client.get("/api/trains/12302/route")
    assert res_route.status_code == 200
    route_data = res_route.json()
    assert len(route_data) >= 5

    # 4. Status
    res_status = client.get("/api/trains/12302/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["train_number"] == "12302"
    assert "last_updated" in status_data
    assert "NTES" in status_data["source_attribution"]

    # 5. Route search with only stations (NDLS -> BCT)
    res_route_search = client.get("/api/trains/search?from_station=NDLS&to_station=BCT")
    assert res_route_search.status_code == 200
    all_route_trains = res_route_search.json()
    assert len(all_route_trains) >= 4
    categories = {t["train_type"] for t in all_route_trains}
    assert "Rajdhani" in categories
    assert "Special" in categories
    assert any("Mail" in c or "Express" in c or "Superfast" in c for c in categories)
    assert any("Passenger" in c or "Local" in c for c in categories)

    # 6. Category query param filtering
    res_spec = client.get("/api/trains/search?from_station=NDLS&to_station=BCT&train_type=Special")
    assert res_spec.status_code == 200
    spec_trains = res_spec.json()
    assert len(spec_trains) >= 1
    assert all(t["train_type"] == "Special" for t in spec_trains)

    # 7. Non-existent train returns 404
    res_404 = client.get("/api/trains/99999")
    assert res_404.status_code == 404

