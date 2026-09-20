from abc import ABC, abstractmethod
from typing import List, Optional
from backend.train_info.schemas.train_schemas import (
    TrainSummary,
    TrainDetails,
    StationStop,
    RunningStatus
)


class TrainDataProvider(ABC):
    """
    Abstract interface for railway train information and running status providers.
    All implementations (mock or authorized feeds) must adhere to this contract.
    """

    @abstractmethod
    def search_trains(
        self,
        query: Optional[str] = None,
        from_station: Optional[str] = None,
        to_station: Optional[str] = None,
        journey_date: Optional[str] = None,
        train_type: Optional[str] = None
    ) -> List[TrainSummary]:
        """Search trains by number, name, or source-destination pair."""
        pass

    @abstractmethod
    def get_train_details(self, train_number: str) -> Optional[TrainDetails]:
        """Retrieve full train profile including route, stops, and schedules."""
        pass

    @abstractmethod
    def get_train_route(self, train_number: str) -> List[StationStop]:
        """Retrieve sequential station stops and timetable for a train."""
        pass

    @abstractmethod
    def get_running_status(
        self,
        train_number: str,
        journey_date: Optional[str] = None
    ) -> Optional[RunningStatus]:
        """Retrieve live or estimated running status, delays, and current location."""
        pass
