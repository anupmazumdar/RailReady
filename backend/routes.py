from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from storage.models import (
    JourneyCreate,
    JourneyResponse,
    PassengerCreate,
    PassengerResponse,
    ChecklistUpdate
)
import storage.db as db
from security.validator import inspect_for_credentials, sanitize_input_text
from utils.time_calc import (
    calculate_tatkal_opening_time,
    get_countdown_info,
    get_ist_now
)
from utils.clipboard import (
    generate_full_passenger_summary,
    generate_quick_row_format
)
from config.settings import MAX_PASSENGERS_TATKAL

router = APIRouter(prefix="/api")


@router.get("/status")
def get_system_status() -> Dict[str, Any]:
    """Provides system health, current IST time, and compliance guarantees."""
    now_ist = get_ist_now()
    return {
        "status": "online",
        "current_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
        "compliance": {
            "mode": "OFFLINE_ORGANIZER_ONLY",
            "irctc_automation": False,
            "browser_automation": False,
            "credentials_stored": False,
            "external_traffic": False,
            "notice": "This application prepares information and provides reminders only. It does not interact with IRCTC or book tickets."
        }
    }


@router.post("/journey", response_model=Dict[str, Any])
def create_journey(journey: JourneyCreate):
    """
    Plan a journey, calculate the exact Tatkal opening time, and save to local storage.
    """
    # Security inspection
    inspect_for_credentials(journey.model_dump())

    # Sanitize strings
    journey.from_station = sanitize_input_text(journey.from_station)
    journey.to_station = sanitize_input_text(journey.to_station)
    journey.preferred_train = sanitize_input_text(journey.preferred_train)
    journey.preferred_class = sanitize_input_text(journey.preferred_class)

    # Validate journey date format and ensure it is not in the past
    try:
        j_date = datetime.strptime(journey.journey_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")

    # Calculate Tatkal opening time
    opening_time_dt = calculate_tatkal_opening_time(journey.journey_date, journey.tatkal_type)
    opening_time_str = opening_time_dt.strftime("%Y-%m-%d %H:%M:%S IST")

    saved_journey = db.save_journey(journey, opening_time_str)
    countdown = get_countdown_info(opening_time_dt)

    return {
        "journey": saved_journey,
        "opening_time": opening_time_str,
        "opening_time_iso": opening_time_dt.isoformat(),
        "countdown": countdown,
        "disclaimer": "Expected opening time — verify current IRCTC rules before booking."
    }


@router.get("/journey/latest")
def get_latest_journey():
    """Retrieve the most recently saved journey with real-time countdown."""
    journey = db.get_latest_journey()
    if not journey:
        return {"journey": None, "countdown": None}

    # Recalculate opening time and countdown
    opening_time_dt = calculate_tatkal_opening_time(journey.journey_date, journey.tatkal_type)
    countdown = get_countdown_info(opening_time_dt)

    return {
        "journey": journey,
        "opening_time": journey.expected_opening_time,
        "opening_time_iso": opening_time_dt.isoformat(),
        "countdown": countdown,
        "disclaimer": "Expected opening time — verify current IRCTC rules before booking."
    }


@router.post("/passengers", response_model=PassengerResponse)
def add_passenger(passenger: PassengerCreate):
    """
    Add a passenger for preparation, enforcing the Tatkal limit of max 4 passengers.
    """
    # Security inspection
    inspect_for_credentials(passenger.model_dump())

    # Sanitize passenger name
    passenger.name = sanitize_input_text(passenger.name)

    current_passengers = db.list_passengers()
    if len(current_passengers) >= MAX_PASSENGERS_TATKAL:
        raise HTTPException(
            status_code=400,
            detail=f"Tatkal limit reached. A maximum of {MAX_PASSENGERS_TATKAL} passengers are permitted per Tatkal booking."
        )

    saved_passenger = db.add_passenger(passenger)
    return saved_passenger


@router.get("/passengers", response_model=List[PassengerResponse])
def get_passengers():
    """List all currently prepared passengers."""
    return db.list_passengers()


@router.delete("/passengers/{passenger_id}")
def delete_passenger(passenger_id: int):
    """Delete a prepared passenger by ID."""
    deleted = db.delete_passenger(passenger_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Passenger not found.")
    return {"status": "deleted", "id": passenger_id}


@router.delete("/passengers")
def clear_all_passengers():
    """Clear all prepared passengers."""
    db.clear_passengers()
    return {"status": "cleared"}


@router.get("/clipboard/passengers")
def get_clipboard_text():
    """Generate formatted text for clipboard copying."""
    passengers = db.list_passengers()
    journey = db.get_latest_journey()
    summary = generate_full_passenger_summary(passengers, journey)
    row_format = generate_quick_row_format(passengers)
    return {
        "formatted_summary": summary,
        "row_format": row_format,
        "count": len(passengers)
    }


@router.get("/checklist")
def get_checklist_items():
    """Retrieve pre-booking preparation checklist."""
    return db.get_checklist()


@router.put("/checklist/{item_key}")
def toggle_checklist_item(item_key: str, update: ChecklistUpdate):
    """Update checkbox state for a checklist item."""
    updated = db.update_checklist_item(item_key, update.checked)
    if not updated:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    return {"status": "updated", "item_key": item_key, "checked": update.checked}


@router.post("/checklist/reset")
def reset_checklist():
    """Reset all checklist items to unchecked."""
    db.reset_checklist()
    return {"status": "reset"}
