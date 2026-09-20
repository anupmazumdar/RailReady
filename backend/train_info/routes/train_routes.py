from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from backend.train_info.services.train_service import train_service
from backend.train_info.schemas.train_schemas import (
    TrainSummary,
    TrainDetails,
    StationStop,
    RunningStatus
)

train_router = APIRouter(prefix="/api/trains", tags=["Train Information"])


@train_router.get("/search", response_model=List[TrainSummary])
def search_trains_endpoint(
    query: Optional[str] = Query(None, description="Search by train number or name"),
    from_station: Optional[str] = Query(None, description="Origin / Boarding station code"),
    to_station: Optional[str] = Query(None, description="Destination station code"),
    journey_date: Optional[str] = Query(None, description="Journey date (YYYY-MM-DD)"),
    train_type: Optional[str] = Query(None, description="Filter by category (Rajdhani, Special, Mail/Express, Passenger)")
):
    """Search trains by number, name, station pair, or category."""
    results = train_service.search_trains(
        query=query,
        from_station=from_station,
        to_station=to_station,
        journey_date=journey_date,
        train_type=train_type
    )
    return results


@train_router.get("/{train_number}", response_model=TrainDetails)
def get_train_details_endpoint(train_number: str):
    """Retrieve full train profile including route, stops, and schedules."""
    details = train_service.get_train_details(train_number)
    if not details:
        raise HTTPException(
            status_code=404,
            detail=f"Train number '{train_number}' not found in database."
        )
    return details


@train_router.get("/{train_number}/route", response_model=List[StationStop])
def get_train_route_endpoint(train_number: str):
    """Retrieve ordered station timeline, halts, and platforms for a train."""
    route = train_service.get_train_route(train_number)
    if not route:
        raise HTTPException(
            status_code=404,
            detail=f"Route for train number '{train_number}' not found."
        )
    return route


@train_router.get("/{train_number}/status", response_model=RunningStatus)
def get_running_status_endpoint(
    train_number: str,
    journey_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)")
):
    """Retrieve live / estimated running status, delays, and current station."""
    status = train_service.get_running_status(train_number, journey_date)
    if not status:
        raise HTTPException(
            status_code=404,
            detail=f"Running status for train '{train_number}' is unavailable."
        )
    return status
