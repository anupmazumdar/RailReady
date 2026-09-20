import pytest
import sqlite3
from storage.models import (
    JourneyCreate,
    PassengerCreate,
    TatkalType,
    Gender,
    BerthPreference,
    MealPreference
)
import storage.db as db


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch, tmp_path):
    """Fixture to ensure all tests use an isolated temporary database."""
    temp_db = tmp_path / "test_tatkal.db"
    monkeypatch.setattr(db, "DB_PATH", temp_db)
    db.init_db()
    yield temp_db


def test_journey_persistence():
    journey_data = JourneyCreate(
        from_station="NDLS",
        to_station="HWH",
        journey_date="2026-11-10",
        preferred_train="12302 HOWRAH RAJDHANI",
        preferred_class="2A",
        tatkal_type=TatkalType.AC
    )

    opening = "2026-11-09 10:00:00 IST"
    saved = db.save_journey(journey_data, opening)

    assert saved.id is not None
    assert saved.from_station == "NDLS"
    assert saved.to_station == "HWH"
    assert saved.expected_opening_time == opening

    latest = db.get_latest_journey()
    assert latest.id == saved.id
    assert latest.preferred_train == "12302 HOWRAH RAJDHANI"


def test_passenger_crud():
    p1 = PassengerCreate(
        name="Sunita Rao",
        age=45,
        gender=Gender.FEMALE,
        berth_preference=BerthPreference.LOWER,
        meal_preference=MealPreference.VEG
    )

    saved_p = db.add_passenger(p1)
    assert saved_p.id is not None
    assert saved_p.name == "Sunita Rao"

    passengers = db.list_passengers()
    assert len(passengers) == 1
    assert passengers[0].name == "Sunita Rao"

    # Delete
    deleted = db.delete_passenger(saved_p.id)
    assert deleted is True
    assert len(db.list_passengers()) == 0


def test_checklist_toggle():
    items = db.get_checklist()
    assert len(items) > 0

    key = items[0]["item_key"]
    # Toggle to true
    db.update_checklist_item(key, True)
    updated_items = db.get_checklist()
    target = next(i for i in updated_items if i["item_key"] == key)
    assert target["checked"] is True

    # Reset
    db.reset_checklist()
    reset_items = db.get_checklist()
    assert all(i["checked"] is False for i in reset_items)
