from typing import List, Optional
from pydantic import BaseModel, Field


class StationStop(BaseModel):
    station_code: str = Field(..., description="Station Code (e.g. NDLS)")
    station_name: str = Field(..., description="Station Name")
    scheduled_arrival: str = Field(..., description="Scheduled Arrival Time (HH:MM)")
    scheduled_departure: str = Field(..., description="Scheduled Departure Time (HH:MM)")
    actual_arrival: Optional[str] = Field(default=None, description="Actual / Estimated Arrival Time")
    actual_departure: Optional[str] = Field(default=None, description="Actual / Estimated Departure Time")
    halt_minutes: int = Field(default=0, description="Halt duration in minutes")
    day_of_journey: int = Field(default=1, description="Day of journey (1, 2, etc.)")
    platform: Optional[str] = Field(default=None, description="Platform number when available")
    distance_km: int = Field(default=0, description="Distance from origin in kilometers")
    delay_minutes: int = Field(default=0, description="Delay in minutes (0 = Right Time)")
    has_departed: bool = Field(default=False, description="Whether train has already departed this station")


class TrainSummary(BaseModel):
    train_number: str = Field(..., description="5-digit Train Number")
    train_name: str = Field(..., description="Train Name")
    train_type: str = Field(default="Superfast", description="Type (e.g. Rajdhani, Shatabdi, Express)")
    source_code: str = Field(..., description="Origin Station Code")
    source_name: str = Field(..., description="Origin Station Name")
    dest_code: str = Field(..., description="Destination Station Code")
    dest_name: str = Field(..., description="Destination Station Name")
    departure_time: str = Field(..., description="Departure Time from Origin (HH:MM)")
    arrival_time: str = Field(..., description="Arrival Time at Destination (HH:MM)")
    duration: str = Field(..., description="Formatted Duration (e.g. 15h 30m)")
    running_days: List[str] = Field(default=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    classes: List[str] = Field(default=["3A", "2A", "1A", "SL"])


class TrainDetails(BaseModel):
    train_number: str
    train_name: str
    train_type: str
    source_code: str
    source_name: str
    dest_code: str
    dest_name: str
    departure_time: str
    arrival_time: str
    duration: str
    running_days: List[str]
    classes: List[str]
    pantry: bool = True
    total_distance_km: int = 0
    stops: List[StationStop] = []


class RunningStatus(BaseModel):
    train_number: str
    train_name: str
    journey_date: str
    current_status: str = Field(..., description="Status (e.g. RUNNING, ARRIVED, NOT_STARTED, DELAYED)")
    current_station: str = Field(..., description="Current or last reported station")
    current_station_name: str = Field(..., description="Current station name")
    delay_minutes: int = Field(default=0, description="Delay in minutes")
    delay_status: str = Field(default="On Time", description="Formatted delay string")
    next_station: Optional[str] = Field(default=None, description="Upcoming station")
    next_station_name: Optional[str] = Field(default=None, description="Upcoming station name")
    previous_station: Optional[str] = Field(default=None, description="Previous station")
    last_updated: str = Field(..., description="Timestamp of last status update")
    timeline: List[StationStop] = []
    stale_data: bool = Field(default=False, description="Indicates if cached data is older than TTL")
    source_attribution: str = Field(
        default="Verified reference simulation. Verify through official NTES (enquiry.indianrail.gov.in) / Helpline 139.",
        description="Legal source disclaimer"
    )
