from typing import List, Optional, Dict, Any
from config.settings import CACHE_TTL_STATUS_SECONDS, CACHE_TTL_ROUTE_SECONDS
from backend.train_info.providers.factory import get_train_data_provider
from backend.train_info.services.cache_service import cache_service
from backend.train_info.schemas.train_schemas import (
    TrainSummary,
    TrainDetails,
    StationStop,
    RunningStatus
)
from security.validator import sanitize_input_text


class TrainService:
    """
    Business service layer orchestrating train data operations through providers and cache.
    """

    def __init__(self):
        self.provider = get_train_data_provider()

    def search_trains(
        self,
        query: Optional[str] = None,
        from_station: Optional[str] = None,
        to_station: Optional[str] = None,
        journey_date: Optional[str] = None,
        train_type: Optional[str] = None
    ) -> List[TrainSummary]:
        clean_q = sanitize_input_text(query) if query else None
        clean_src = sanitize_input_text(from_station) if from_station else None
        clean_dst = sanitize_input_text(to_station) if to_station else None
        clean_type = sanitize_input_text(train_type) if train_type else None

        cache_key = f"search:{clean_q}:{clean_src}:{clean_dst}:{journey_date}:{clean_type}"
        cached, _ = cache_service.get(cache_key)
        if cached:
            return cached

        results = self.provider.search_trains(
            query=clean_q,
            from_station=clean_src,
            to_station=clean_dst,
            journey_date=journey_date,
            train_type=clean_type
        )
        cache_service.set(cache_key, results, CACHE_TTL_ROUTE_SECONDS)
        return results

    def get_train_details(self, train_number: str) -> Optional[TrainDetails]:
        clean_no = sanitize_input_text(train_number)
        cache_key = f"details:{clean_no}"
        cached, _ = cache_service.get(cache_key)
        if cached:
            return cached

        details = self.provider.get_train_details(clean_no)
        if details:
            cache_service.set(cache_key, details, CACHE_TTL_ROUTE_SECONDS)
        return details

    def get_train_route(self, train_number: str) -> List[StationStop]:
        clean_no = sanitize_input_text(train_number)
        cache_key = f"route:{clean_no}"
        cached, _ = cache_service.get(cache_key)
        if cached:
            return cached

        route = self.provider.get_train_route(clean_no)
        if route:
            cache_service.set(cache_key, route, CACHE_TTL_ROUTE_SECONDS)
        return route

    def get_running_status(
        self,
        train_number: str,
        journey_date: Optional[str] = None
    ) -> Optional[RunningStatus]:
        clean_no = sanitize_input_text(train_number)
        cache_key = f"status:{clean_no}:{journey_date}"
        cached, is_stale = cache_service.get(cache_key)

        if cached:
            cached.stale_data = is_stale
            return cached

        status = self.provider.get_running_status(clean_no, journey_date)
        if status:
            cache_service.set(cache_key, status, CACHE_TTL_STATUS_SECONDS)
        return status

    def get_pnr_status(self, pnr: str) -> Optional[Any]:
        clean_pnr = sanitize_input_text(pnr).strip()
        if len(clean_pnr) != 10 or not clean_pnr.isdigit():
            return None
        cache_key = f"pnr:{clean_pnr}"
        cached, _ = cache_service.get(cache_key)
        if cached:
            return cached
        res = self.provider.get_pnr_status(clean_pnr)
        if res:
            cache_service.set(cache_key, res, CACHE_TTL_STATUS_SECONDS)
        return res

    def get_coach_composition(self, train_number: str) -> Optional[Any]:
        clean_no = sanitize_input_text(train_number).strip()
        cache_key = f"coach:{clean_no}"
        cached, _ = cache_service.get(cache_key)
        if cached:
            return cached
        res = self.provider.get_coach_composition(clean_no)
        if res:
            cache_service.set(cache_key, res, CACHE_TTL_ROUTE_SECONDS)
        return res

    def search_stations(self, query: Optional[str] = None, limit: int = 20) -> List[Any]:
        from storage.stations_data import search_stations
        clean_q = sanitize_input_text(query) if query else None
        return search_stations(clean_q, limit=limit)

    def get_station(self, code: str) -> Optional[Any]:
        from storage.stations_data import get_station_by_code
        clean_code = sanitize_input_text(code).strip().upper()
        return get_station_by_code(clean_code)


train_service = TrainService()
