from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from storage.models import (
    JourneyCreate,
    JourneyResponse,
    PassengerCreate,
    PassengerResponse,
    ChecklistUpdate,
    SearchHistoryCreate,
    SearchHistoryItem,
    AlertCreate,
    AlertItem,
    StationInfo,
    PNRResponse
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
    generate_quick_row_format,
    generate_irctc_quick_format
)
from utils.route_split import (
    find_direct_trains,
    find_split_routes,
    get_live_status_guide
)
from backend.train_info.services.train_service import train_service
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
    irctc_format = generate_irctc_quick_format(passengers)
    return {
        "formatted_summary": summary,
        "row_format": row_format,
        "irctc_format": irctc_format,
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


@router.get("/trains/direct")
def get_direct_trains(from_station: str, to_station: str):
    """Find scheduled direct trains between two stations from offline dataset."""
    trains = find_direct_trains(from_station, to_station)
    return {
        "from": from_station,
        "to": to_station,
        "count": len(trains),
        "trains": trains
    }


@router.get("/trains/alternatives")
def get_alternative_split_routes(
    from_station: str,
    to_station: str,
    min_layover: float = 1.0,
    max_layover: float = 8.0
):
    """
    Find legal 2-leg split journey alternatives through intermediate transit junctions.
    Includes connecting PNR layover validation and refund protection guidance.
    """
    options = find_split_routes(
        from_station,
        to_station,
        min_layover_hours=min_layover,
        max_layover_hours=max_layover
    )
    return {
        "from": from_station,
        "to": to_station,
        "alternatives_count": len(options),
        "alternatives": options,
        "connecting_pnr_advisory": (
            "Indian Railways Connecting PNR Rule: Link both bookings on IRCTC by selecting "
            "'Connecting Journey Booking' and entering PNR 1. If Train 1 is delayed causing a missed connection, "
            "you receive a 100% full refund on Train 2."
        )
    }


@router.get("/trains/live-status")
def get_train_live_status_guide(train_number: Optional[str] = None):
    """Provides verified official NTES live tracking methods and 139 SMS guide."""
    return get_live_status_guide(train_number)


# ================= STATIONS =================
@router.get("/stations/search", response_model=List[StationInfo])
def search_stations_endpoint(query: Optional[str] = None, limit: int = 20):
    """Lookup stations by code, station name, or city with popularity ranking."""
    return train_service.search_stations(query, limit=limit)


@router.get("/stations/{code}", response_model=StationInfo)
def get_station_endpoint(code: str):
    """Retrieve station profile and metadata by code."""
    res = train_service.get_station(code)
    if not res:
        raise HTTPException(status_code=404, detail=f"Station code '{code}' not found.")
    return res


# ================= PNR STATUS =================
@router.get("/pnr/{pnr}", response_model=PNRResponse)
def get_pnr_status_endpoint(pnr: str):
    """
    Retrieve passenger booking status, current status, coach/berth, and chart status.
    Requires exactly 10 numeric digits.
    """
    clean_pnr = pnr.strip()
    if len(clean_pnr) != 10 or not clean_pnr.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Invalid PNR number. PNR must be exactly 10 numeric digits."
        )
    result = train_service.get_pnr_status(clean_pnr)
    if not result:
        raise HTTPException(status_code=404, detail=f"PNR status for '{clean_pnr}' is unavailable.")
    return result


# ================= SEARCH HISTORY =================
@router.get("/history", response_model=List[SearchHistoryItem])
def get_search_history_endpoint(limit: int = 30):
    """Retrieve recent train and corridor search history."""
    return db.get_search_history(limit=limit)


@router.post("/history", response_model=SearchHistoryItem)
def add_search_history_endpoint(item: SearchHistoryCreate):
    """Record a train or corridor search."""
    inspect_for_credentials(item.model_dump())
    item.from_station = sanitize_input_text(item.from_station)
    item.to_station = sanitize_input_text(item.to_station)
    if item.train_number:
        item.train_number = sanitize_input_text(item.train_number)
    if item.train_name:
        item.train_name = sanitize_input_text(item.train_name)
    return db.add_search_history(item)


@router.delete("/history/{item_id}")
def delete_search_history_endpoint(item_id: int):
    """Delete a specific search history entry."""
    deleted = db.delete_search_history_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Search history item not found.")
    return {"status": "deleted", "id": item_id}


@router.delete("/history")
def clear_search_history_endpoint():
    """Clear all search history records."""
    db.clear_search_history()
    return {"status": "cleared"}


# ================= ALERTS =================
@router.get("/alerts", response_model=List[AlertItem])
def get_alerts_endpoint():
    """List all scheduled railway journey and train alerts."""
    return db.get_alerts()


@router.post("/alerts", response_model=AlertItem)
def create_alert_endpoint(alert: AlertCreate):
    """Create a new journey, departure, delay, or PNR reminder alert."""
    inspect_for_credentials(alert.model_dump())
    alert.title = sanitize_input_text(alert.title)
    alert.message = sanitize_input_text(alert.message)
    if alert.train_number:
        alert.train_number = sanitize_input_text(alert.train_number)
    if alert.train_name:
        alert.train_name = sanitize_input_text(alert.train_name)
    return db.add_alert(alert)


@router.delete("/alerts/{alert_id}")
def delete_alert_endpoint(alert_id: int):
    """Delete an alert by ID."""
    deleted = db.delete_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return {"status": "deleted", "id": alert_id}


@router.put("/alerts/{alert_id}/toggle", response_model=AlertItem)
def toggle_alert_endpoint(alert_id: int, enabled: Optional[bool] = None):
    """Toggle enabled status of an alert."""
    updated = db.toggle_alert(alert_id, enabled)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return updated

