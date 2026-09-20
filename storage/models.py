from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class TatkalType(str, Enum):
    AC = "AC"
    NON_AC = "NON_AC"


class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    TRANSGENDER = "TRANSGENDER"


class BerthPreference(str, Enum):
    NO_PREFERENCE = "No Preference"
    LOWER = "Lower"
    MIDDLE = "Middle"
    UPPER = "Upper"
    SIDE_LOWER = "Side Lower"
    SIDE_UPPER = "Side Upper"
    WINDOW = "Window Side"


class MealPreference(str, Enum):
    NONE = "None"
    VEG = "Veg"
    NON_VEG = "Non-Veg"
    JAIN = "Jain"


class PassengerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=16, description="Passenger Name (Max 16 chars as per IRCTC)")
    age: int = Field(..., ge=1, le=125, description="Passenger Age")
    gender: Gender = Field(..., description="Passenger Gender")
    berth_preference: BerthPreference = Field(default=BerthPreference.NO_PREFERENCE)
    meal_preference: MealPreference = Field(default=MealPreference.NONE)
    senior_citizen_opt: bool = Field(default=False)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Passenger name cannot be empty or whitespace.")
        # IRCTC restricts names to letters and spaces
        if not all(c.isalpha() or c.isspace() or c == "." for c in clean):
            raise ValueError("Passenger name should only contain letters, spaces, or dots.")
        return clean


class PassengerCreate(PassengerBase):
    pass


class PassengerResponse(PassengerBase):
    id: int
    journey_id: Optional[int] = None


class JourneyBase(BaseModel):
    from_station: str = Field(..., min_length=2, max_length=50, description="Source Station (e.g. NDLS / New Delhi)")
    to_station: str = Field(..., min_length=2, max_length=50, description="Destination Station (e.g. BCT / Mumbai Central)")
    journey_date: str = Field(..., description="Journey Date (YYYY-MM-DD)")
    preferred_train: str = Field(..., min_length=1, max_length=100, description="Train Name or Number")
    preferred_class: str = Field(..., min_length=1, max_length=10, description="Class (e.g. 3A, 2A, SL)")
    tatkal_type: TatkalType = Field(default=TatkalType.AC)
    primary_train: Optional[str] = Field(default=None, description="Primary Train Selection")
    alt_train_1: Optional[str] = Field(default=None, description="Alternative Train 1")
    alt_train_2: Optional[str] = Field(default=None, description="Alternative Train 2")


class JourneyCreate(JourneyBase):
    pass


class JourneyResponse(JourneyBase):
    id: int
    expected_opening_time: str
    passengers: List[PassengerResponse] = []
    created_at: str


class ChecklistUpdate(BaseModel):
    item_key: str
    checked: bool


class SearchHistoryCreate(BaseModel):
    train_number: Optional[str] = None
    train_name: Optional[str] = None
    from_station: str
    to_station: str
    journey_date: Optional[str] = None


class SearchHistoryItem(SearchHistoryCreate):
    id: int
    searched_at: str


class AlertCreate(BaseModel):
    alert_type: str = Field(..., description="DEPARTURE, STATUS, DELAY, PLATFORM, JOURNEY, PNR_REFRESH")
    train_number: Optional[str] = None
    train_name: Optional[str] = None
    title: str
    message: str
    trigger_time: Optional[str] = None
    enabled: bool = True


class AlertItem(AlertCreate):
    id: int
    created_at: str


class StationInfo(BaseModel):
    code: str
    name: str
    city: Optional[str] = None
    state: Optional[str] = None
    is_popular: bool = False


class PNRPassenger(BaseModel):
    number: int
    booking_status: str
    current_status: str
    coach: str
    berth: int
    berth_type: str


class PNRResponse(BaseModel):
    pnr_number: str
    train_number: str
    train_name: str
    journey_date: str
    from_station: str
    from_station_name: str
    to_station: str
    to_station_name: str
    boarding_station: str
    reservation_upto: str
    booking_class: str
    quota: str
    chart_status: str
    passengers: List[PNRPassenger]
    is_mock: bool = True
    notice: str = "Demo PNR Record (Offline Simulation). RailReady does not connect directly to PRS/IRCTC."


class CoachInfo(BaseModel):
    coach_code: str
    coach_type: str
    class_code: str
    total_berths: int
    berth_layout: str


class CoachCompositionResponse(BaseModel):
    train_number: str
    train_name: str
    total_coaches: int
    coaches: List[CoachInfo]
    rake_type: str = "ICF / LHB"

