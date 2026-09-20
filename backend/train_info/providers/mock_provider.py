from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from backend.train_info.providers.base import TrainDataProvider
from backend.train_info.schemas.train_schemas import (
    TrainSummary,
    TrainDetails,
    StationStop,
    RunningStatus
)
from utils.time_calc import get_ist_now
from utils.route_split import extract_station_code

# Mock Database with complete station stops, platforms, and distances
MOCK_TRAINS_DATA: Dict[str, Dict[str, Any]] = {
    "12302": {
        "train_number": "12302",
        "train_name": "Howrah Rajdhani Express",
        "train_type": "Rajdhani",
        "source_code": "NDLS",
        "source_name": "New Delhi",
        "dest_code": "HWH",
        "dest_name": "Howrah Junction",
        "departure_time": "16:50",
        "arrival_time": "09:55",
        "duration": "17h 05m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "classes": ["1A", "2A", "3A"],
        "total_distance_km": 1451,
        "pantry": True,
        "stops": [
            {"code": "NDLS", "name": "New Delhi", "arr": "16:50", "dep": "16:50", "halt": 0, "day": 1, "pf": "PF 16", "km": 0},
            {"code": "CNB", "name": "Kanpur Central", "arr": "21:32", "dep": "21:37", "halt": 5, "day": 1, "pf": "PF 4", "km": 440},
            {"code": "PRYJ", "name": "Prayagraj Junction", "arr": "23:43", "dep": "23:45", "halt": 2, "day": 1, "pf": "PF 4", "km": 635},
            {"code": "DDU", "name": "Pt. Deen Dayal Upadhyaya", "arr": "01:47", "dep": "01:57", "halt": 10, "day": 2, "pf": "PF 2", "km": 787},
            {"code": "GAYA", "name": "Gaya Junction", "arr": "04:10", "dep": "04:13", "halt": 3, "day": 2, "pf": "PF 1", "km": 992},
            {"code": "DHN", "name": "Dhanbad Junction", "arr": "06:43", "dep": "06:48", "halt": 5, "day": 2, "pf": "PF 2", "km": 1193},
            {"code": "HWH", "name": "Howrah Junction", "arr": "09:55", "dep": "09:55", "halt": 0, "day": 2, "pf": "PF 8", "km": 1451},
        ]
    },
    "12301": {
        "train_number": "12301",
        "train_name": "Howrah - New Delhi Rajdhani Express",
        "train_type": "Rajdhani",
        "source_code": "HWH",
        "source_name": "Howrah Junction",
        "dest_code": "NDLS",
        "dest_name": "New Delhi",
        "departure_time": "16:50",
        "arrival_time": "10:05",
        "duration": "17h 15m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "classes": ["1A", "2A", "3A"],
        "total_distance_km": 1451,
        "pantry": True,
        "stops": [
            {"code": "HWH", "name": "Howrah Junction", "arr": "16:50", "dep": "16:50", "halt": 0, "day": 1, "pf": "PF 9", "km": 0},
            {"code": "DHN", "name": "Dhanbad Junction", "arr": "19:55", "dep": "20:00", "halt": 5, "day": 1, "pf": "PF 3", "km": 258},
            {"code": "GAYA", "name": "Gaya Junction", "arr": "22:30", "dep": "22:33", "halt": 3, "day": 1, "pf": "PF 1", "km": 459},
            {"code": "DDU", "name": "Pt. Deen Dayal Upadhyaya", "arr": "00:45", "dep": "00:55", "halt": 10, "day": 2, "pf": "PF 3", "km": 664},
            {"code": "PRYJ", "name": "Prayagraj Junction", "arr": "02:43", "dep": "02:45", "halt": 2, "day": 2, "pf": "PF 1", "km": 816},
            {"code": "CNB", "name": "Kanpur Central", "arr": "04:50", "dep": "04:55", "halt": 5, "day": 2, "pf": "PF 1", "km": 1011},
            {"code": "NDLS", "name": "New Delhi", "arr": "10:05", "dep": "10:05", "halt": 0, "day": 2, "pf": "PF 1", "km": 1451},
        ]
    },
    "12952": {
        "train_number": "12952",
        "train_name": "Mumbai Tejas Rajdhani Express",
        "train_type": "Rajdhani",
        "source_code": "NDLS",
        "source_name": "New Delhi",
        "dest_code": "BCT",
        "dest_name": "Mumbai Central",
        "departure_time": "16:55",
        "arrival_time": "08:35",
        "duration": "15h 40m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "classes": ["1A", "2A", "3A", "3E"],
        "total_distance_km": 1384,
        "pantry": True,
        "stops": [
            {"code": "NDLS", "name": "New Delhi", "arr": "16:55", "dep": "16:55", "halt": 0, "day": 1, "pf": "PF 3", "km": 0},
            {"code": "KOTA", "name": "Kota Junction", "arr": "21:30", "dep": "21:40", "halt": 10, "day": 1, "pf": "PF 1", "km": 465},
            {"code": "RTM", "name": "Ratlam Junction", "arr": "00:50", "dep": "00:53", "halt": 3, "day": 2, "pf": "PF 4", "km": 732},
            {"code": "BRC", "name": "Vadodara Junction", "arr": "03:40", "dep": "03:50", "halt": 10, "day": 2, "pf": "PF 1", "km": 993},
            {"code": "ST", "name": "Surat", "arr": "05:13", "dep": "05:18", "halt": 5, "day": 2, "pf": "PF 2", "km": 1123},
            {"code": "BVI", "name": "Borivali", "arr": "07:40", "dep": "07:42", "halt": 2, "day": 2, "pf": "PF 7", "km": 1354},
            {"code": "BCT", "name": "Mumbai Central", "arr": "08:35", "dep": "08:35", "halt": 0, "day": 2, "pf": "PF 5", "km": 1384},
        ]
    },
    "12956": {
        "train_number": "12956",
        "train_name": "Jaipur - Mumbai Superfast Express",
        "train_type": "Superfast",
        "source_code": "JP",
        "source_name": "Jaipur Junction",
        "dest_code": "BCT",
        "dest_name": "Mumbai Central",
        "departure_time": "14:00",
        "arrival_time": "06:55",
        "duration": "16h 55m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "classes": ["1A", "2A", "3A", "SL"],
        "total_distance_km": 1159,
        "pantry": True,
        "stops": [
            {"code": "JP", "name": "Jaipur Junction", "arr": "14:00", "dep": "14:00", "halt": 0, "day": 1, "pf": "PF 4", "km": 0},
            {"code": "SWM", "name": "Sawai Madhopur", "arr": "15:45", "dep": "16:00", "halt": 15, "day": 1, "pf": "PF 2", "km": 132},
            {"code": "KOTA", "name": "Kota Junction", "arr": "17:10", "dep": "17:20", "halt": 10, "day": 1, "pf": "PF 2", "km": 240},
            {"code": "RTM", "name": "Ratlam Junction", "arr": "21:05", "dep": "21:15", "halt": 10, "day": 1, "pf": "PF 4", "km": 506},
            {"code": "BRC", "name": "Vadodara Junction", "arr": "01:05", "dep": "01:15", "halt": 10, "day": 2, "pf": "PF 2", "km": 767},
            {"code": "ST", "name": "Surat", "arr": "02:57", "dep": "03:02", "halt": 5, "day": 2, "pf": "PF 2", "km": 897},
            {"code": "BCT", "name": "Mumbai Central", "arr": "06:55", "dep": "06:55", "halt": 0, "day": 2, "pf": "PF 1", "km": 1159},
        ]
    },
    "12015": {
        "train_number": "12015",
        "train_name": "New Delhi - Ajmer Shatabdi Express",
        "train_type": "Shatabdi",
        "source_code": "NDLS",
        "source_name": "New Delhi",
        "dest_code": "AII",
        "dest_name": "Ajmer Junction",
        "departure_time": "06:10",
        "arrival_time": "12:55",
        "duration": "6h 45m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "classes": ["CC", "EC"],
        "total_distance_km": 443,
        "pantry": True,
        "stops": [
            {"code": "NDLS", "name": "New Delhi", "arr": "06:10", "dep": "06:10", "halt": 0, "day": 1, "pf": "PF 10", "km": 0},
            {"code": "DEC", "name": "Delhi Cantt", "arr": "06:36", "dep": "06:38", "halt": 2, "day": 1, "pf": "PF 1", "km": 15},
            {"code": "GGN", "name": "Gurugram", "arr": "06:51", "dep": "06:53", "halt": 2, "day": 1, "pf": "PF 1", "km": 32},
            {"code": "AWR", "name": "Alwar Junction", "arr": "08:32", "dep": "08:35", "halt": 3, "day": 1, "pf": "PF 2", "km": 158},
            {"code": "JP", "name": "Jaipur Junction", "arr": "10:40", "dep": "10:45", "halt": 5, "day": 1, "pf": "PF 3", "km": 308},
            {"code": "AII", "name": "Ajmer Junction", "arr": "12:55", "dep": "12:55", "halt": 0, "day": 1, "pf": "PF 1", "km": 443},
        ]
    },
    "12004": {
        "train_number": "12004",
        "train_name": "Lucknow Shatabdi Express",
        "train_type": "Shatabdi",
        "source_code": "NDLS",
        "source_name": "New Delhi",
        "dest_code": "LKO",
        "dest_name": "Lucknow Charbagh",
        "departure_time": "06:10",
        "arrival_time": "12:40",
        "duration": "6h 30m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "classes": ["CC", "EC"],
        "total_distance_km": 511,
        "pantry": True,
        "stops": [
            {"code": "NDLS", "name": "New Delhi", "arr": "06:10", "dep": "06:10", "halt": 0, "day": 1, "pf": "PF 9", "km": 0},
            {"code": "GZB", "name": "Ghaziabad", "arr": "06:48", "dep": "06:50", "halt": 2, "day": 1, "pf": "PF 2", "km": 26},
            {"code": "ALJN", "name": "Aligarh Junction", "arr": "07:58", "dep": "08:00", "halt": 2, "day": 1, "pf": "PF 3", "km": 131},
            {"code": "CNB", "name": "Kanpur Central", "arr": "11:20", "dep": "11:25", "halt": 5, "day": 1, "pf": "PF 5", "km": 440},
            {"code": "LKO", "name": "Lucknow Charbagh", "arr": "12:40", "dep": "12:40", "halt": 0, "day": 1, "pf": "PF 2", "km": 511},
        ]
    },
    "20901": {
        "train_number": "20901",
        "train_name": "Mumbai Central - Gandhinagar Capital Vande Bharat",
        "train_type": "Vande Bharat",
        "source_code": "BCT",
        "source_name": "Mumbai Central",
        "dest_code": "GNC",
        "dest_name": "Gandhinagar Capital",
        "departure_time": "06:00",
        "arrival_time": "12:25",
        "duration": "6h 25m",
        "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        "classes": ["CC", "EC"],
        "total_distance_km": 522,
        "pantry": True,
        "stops": [
            {"code": "BCT", "name": "Mumbai Central", "arr": "06:00", "dep": "06:00", "halt": 0, "day": 1, "pf": "PF 5", "km": 0},
            {"code": "BVI", "name": "Borivali", "arr": "06:23", "dep": "06:25", "halt": 2, "day": 1, "pf": "PF 7", "km": 30},
            {"code": "ST", "name": "Surat", "arr": "08:37", "dep": "08:40", "halt": 3, "day": 1, "pf": "PF 1", "km": 263},
            {"code": "BRC", "name": "Vadodara Junction", "arr": "10:00", "dep": "10:05", "halt": 5, "day": 1, "pf": "PF 2", "km": 392},
            {"code": "ADI", "name": "Ahmedabad Junction", "arr": "11:25", "dep": "11:30", "halt": 5, "day": 1, "pf": "PF 1", "km": 491},
            {"code": "GNC", "name": "Gandhinagar Capital", "arr": "12:25", "dep": "12:25", "halt": 0, "day": 1, "pf": "PF 1", "km": 522},
        ]
    }
}


class MockTrainDataProvider(TrainDataProvider):
    """
    High-fidelity offline mock data provider.
    Provides realistic search, timetable, station sequence, and running status calculations.
    """

    def search_trains(
        self,
        query: Optional[str] = None,
        from_station: Optional[str] = None,
        to_station: Optional[str] = None,
        journey_date: Optional[str] = None
    ) -> List[TrainSummary]:
        results = []
        src_code = extract_station_code(from_station) if from_station else None
        dst_code = extract_station_code(to_station) if to_station else None
        q = query.strip().lower() if query else None

        for t in MOCK_TRAINS_DATA.values():
            match = True

            # Query filter (number or name)
            if q:
                if q not in t["train_number"].lower() and q not in t["train_name"].lower():
                    match = False

            # Station pair filter
            if match and src_code and dst_code:
                codes = [s["code"] for s in t["stops"]]
                if src_code in codes and dst_code in codes:
                    src_idx = codes.index(src_code)
                    dst_idx = codes.index(dst_code)
                    if src_idx >= dst_idx:
                        match = False
                else:
                    match = False
            elif match and src_code:
                codes = [s["code"] for s in t["stops"]]
                if src_code not in codes:
                    match = False
            elif match and dst_code:
                codes = [s["code"] for s in t["stops"]]
                if dst_code not in codes:
                    match = False

            if match:
                results.append(TrainSummary(
                    train_number=t["train_number"],
                    train_name=t["train_name"],
                    train_type=t["train_type"],
                    source_code=t["source_code"],
                    source_name=t["source_name"],
                    dest_code=t["dest_code"],
                    dest_name=t["dest_name"],
                    departure_time=t["departure_time"],
                    arrival_time=t["arrival_time"],
                    duration=t["duration"],
                    running_days=t["running_days"],
                    classes=t["classes"]
                ))

        return results

    def get_train_details(self, train_number: str) -> Optional[TrainDetails]:
        data = MOCK_TRAINS_DATA.get(train_number.strip())
        if not data:
            return None

        stops = [
            StationStop(
                station_code=s["code"],
                station_name=s["name"],
                scheduled_arrival=s["arr"],
                scheduled_departure=s["dep"],
                halt_minutes=s["halt"],
                day_of_journey=s["day"],
                platform=s.get("pf", "PF 1"),
                distance_km=s.get("km", 0),
                delay_minutes=0
            )
            for s in data["stops"]
        ]

        return TrainDetails(
            train_number=data["train_number"],
            train_name=data["train_name"],
            train_type=data["train_type"],
            source_code=data["source_code"],
            source_name=data["source_name"],
            dest_code=data["dest_code"],
            dest_name=data["dest_name"],
            departure_time=data["departure_time"],
            arrival_time=data["arrival_time"],
            duration=data["duration"],
            running_days=data["running_days"],
            classes=data["classes"],
            pantry=data.get("pantry", True),
            total_distance_km=data.get("total_distance_km", 0),
            stops=stops
        )

    def get_train_route(self, train_number: str) -> List[StationStop]:
        details = self.get_train_details(train_number)
        return details.stops if details else []

    def get_running_status(
        self,
        train_number: str,
        journey_date: Optional[str] = None
    ) -> Optional[RunningStatus]:
        data = MOCK_TRAINS_DATA.get(train_number.strip())
        if not data:
            return None

        now_ist = get_ist_now()
        j_date = journey_date or now_ist.strftime("%Y-%m-%d")
        simulated_delay = 12  # 12 minutes standard simulated delay

        # Build timeline with simulated delay and departure flags
        stops_count = len(data["stops"])
        # Determine intermediate progress
        current_idx = min(2, stops_count - 1)  # mid-route station for simulation
        
        timeline = []
        for idx, s in enumerate(data["stops"]):
            has_departed = idx <= current_idx
            delay = simulated_delay if idx >= 1 else 0
            
            # Format actuals with delay
            arr_h, arr_m = map(int, s["arr"].split(":"))
            act_m = arr_m + delay
            act_h = (arr_h + act_m // 60) % 24
            act_m = act_m % 60
            actual_arr = f"{act_h:02d}:{act_m:02d}"

            dep_h, dep_m = map(int, s["dep"].split(":"))
            act_dep_m = dep_m + delay
            act_dep_h = (dep_h + act_dep_m // 60) % 24
            act_dep_m = act_dep_m % 60
            actual_dep = f"{act_dep_h:02d}:{act_dep_m:02d}"

            timeline.append(StationStop(
                station_code=s["code"],
                station_name=s["name"],
                scheduled_arrival=s["arr"],
                scheduled_departure=s["dep"],
                actual_arrival=actual_arr if has_departed or idx == current_idx + 1 else None,
                actual_departure=actual_dep if has_departed else None,
                halt_minutes=s["halt"],
                day_of_journey=s["day"],
                platform=s.get("pf", "PF 1"),
                distance_km=s.get("km", 0),
                delay_minutes=delay,
                has_departed=has_departed
            ))

        curr_stop = data["stops"][current_idx]
        next_stop = data["stops"][current_idx + 1] if current_idx + 1 < stops_count else None
        prev_stop = data["stops"][current_idx - 1] if current_idx > 0 else None

        delay_status = f"Running late by {simulated_delay} mins" if simulated_delay > 0 else "Right Time"

        return RunningStatus(
            train_number=data["train_number"],
            train_name=data["train_name"],
            journey_date=j_date,
            current_status="RUNNING",
            current_station=curr_stop["code"],
            current_station_name=curr_stop["name"],
            delay_minutes=simulated_delay,
            delay_status=delay_status,
            next_station=next_stop["code"] if next_stop else None,
            next_station_name=next_stop["name"] if next_stop else None,
            previous_station=prev_stop["code"] if prev_stop else None,
            last_updated=now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
            timeline=timeline,
            stale_data=False,
            source_attribution=(
                "Verified reference simulation. Verify through official NTES (enquiry.indianrail.gov.in) / Helpline 139."
            )
        )
