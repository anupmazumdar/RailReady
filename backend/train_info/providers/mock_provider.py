from datetime import datetime, timedelta
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from backend.train_info.providers.base import TrainDataProvider
from backend.train_info.schemas.train_schemas import (
    TrainSummary, TrainDetails, StationStop, RunningStatus
)
from utils.time_calc import get_ist_now
from utils.route_split import extract_station_code
from storage.routes_data import STATION_NAMES

# Load realistic high-fidelity train dataset
_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "mock_trains.json"
with open(_DATA_FILE, "r", encoding="utf-8") as _f:
    MOCK_TRAINS_DATA: Dict[str, Dict[str, Any]] = json.load(_f)


def _get_station_display_name(code: str) -> str:
    clean = code.strip().upper()
    return STATION_NAMES.get(clean, clean)


def _ensure_corridor_trains(src_code: str, dst_code: str):
    """Synthesizes realistic trains for any corridor missing key categories."""
    src_name, dst_name = _get_station_display_name(src_code), _get_station_display_name(dst_code)
    h = abs(hash(f"{src_code}_{dst_code}")) % 900 + 100

    categories = [
        {"num": f"12{h}", "name": f"{src_name} - {dst_name} Rajdhani Express", "type": "Rajdhani", "dep": "17:00", "arr": "08:30", "dur": "15h 30m", "classes": ["1A", "2A", "3A"], "dist": 1250, "pantry": True},
        {"num": f"09{h}", "name": f"{src_name} - {dst_name} Tatkal Festival Special", "type": "Special", "dep": "19:15", "arr": "12:45", "dur": "17h 30m", "classes": ["2A", "3A", "3E", "SL"], "dist": 1250, "pantry": True},
        {"num": f"13{h}", "name": f"{src_name} - {dst_name} Superfast Mail", "type": "Mail/Express", "dep": "11:30", "arr": "07:15", "dur": "19h 45m", "classes": ["1A", "2A", "3A", "SL", "2S"], "dist": 1250, "pantry": True},
        {"num": f"54{h}", "name": f"{src_name} - {dst_name} Intercity Fast Passenger", "type": "Passenger", "dep": "06:30", "arr": "14:15", "dur": "7h 45m", "classes": ["SL", "2S"], "dist": 480, "pantry": False},
    ]

    for cat in categories:
        num = cat["num"]
        if num not in MOCK_TRAINS_DATA:
            MOCK_TRAINS_DATA[num] = {
                "train_number": num, "train_name": cat["name"], "train_type": cat["type"],
                "source_code": src_code, "source_name": src_name, "dest_code": dst_code, "dest_name": dst_name,
                "departure_time": cat["dep"], "arrival_time": cat["arr"], "duration": cat["dur"],
                "running_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "classes": cat["classes"], "total_distance_km": cat["dist"], "pantry": cat["pantry"],
                "stops": [
                    {"code": src_code, "name": src_name, "arr": cat["dep"], "dep": cat["dep"], "halt": 0, "day": 1, "pf": "PF 1", "km": 0},
                    {"code": dst_code, "name": dst_name, "arr": cat["arr"], "dep": cat["arr"], "halt": 0, "day": 1 if "h" in cat["dur"] and int(cat["dur"].split("h")[0]) < 18 else 2, "pf": "PF 2", "km": cat["dist"]}
                ]
            }


class MockTrainDataProvider(TrainDataProvider):
    """High-fidelity offline mock data provider."""

    def search_trains(
        self,
        query: Optional[str] = None,
        from_station: Optional[str] = None,
        to_station: Optional[str] = None,
        journey_date: Optional[str] = None,
        train_type: Optional[str] = None
    ) -> List[TrainSummary]:
        src_code = extract_station_code(from_station) if from_station else None
        dst_code = extract_station_code(to_station) if to_station else None
        q = query.strip().lower() if query else None
        tt = train_type.strip().lower() if train_type else None

        if src_code and dst_code and src_code != dst_code:
            _ensure_corridor_trains(src_code, dst_code)

        results = []
        for t in MOCK_TRAINS_DATA.values():
            match = True

            # Direct train_type filter
            if tt:
                t_lower = t["train_type"].lower()
                if tt in ["rajdhani", "raj"] and "rajdhani" not in t_lower:
                    match = False
                elif tt in ["special", "tatkal special", "fest"] and "special" not in t_lower:
                    match = False
                elif tt in ["passenger", "local", "memu", "intercity"] and not any(k in t_lower for k in ["passenger", "local", "memu"]):
                    match = False
                elif tt in ["mail/express", "mail", "express", "superfast", "sf"] and not any(k in t_lower for k in ["mail", "express", "superfast"]):
                    match = False
                elif tt not in ["all", "any"] and tt not in t_lower:
                    match = False

            # Query filter (number, name, or train type category)
            if match and q:
                n_m, name_m, type_m = q in t["train_number"].lower(), q in t["train_name"].lower(), q in t["train_type"].lower()
                if q in ["special", "tatkal special", "fest"]:
                    type_m = type_m or t["train_type"] == "Special"
                elif q in ["rajdhani", "raj"]:
                    type_m = type_m or t["train_type"] == "Rajdhani"
                elif q in ["passenger", "local", "memu", "intercity"]:
                    type_m = type_m or t["train_type"] == "Passenger"
                elif q in ["mail", "express", "superfast", "sf"]:
                    type_m = type_m or t["train_type"] in ["Mail/Express", "Superfast"]
                if not (n_m or name_m or type_m):
                    match = False

            # Station pair filter
            if match and src_code and dst_code:
                codes = [s["code"] for s in t["stops"]]
                if src_code in codes and dst_code in codes:
                    if codes.index(src_code) >= codes.index(dst_code):
                        match = False
                elif not (t["source_code"] == src_code and t["dest_code"] == dst_code):
                    match = False
            elif match and src_code:
                codes = [s["code"] for s in t["stops"]]
                if src_code not in codes and t["source_code"] != src_code:
                    match = False
            elif match and dst_code:
                codes = [s["code"] for s in t["stops"]]
                if dst_code not in codes and t["dest_code"] != dst_code:
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

        type_priority = {"Rajdhani": 1, "Shatabdi": 2, "Vande Bharat": 3, "Special": 4, "Superfast": 5, "Mail/Express": 6, "Passenger": 7}
        if src_code == "JP" and dst_code == "BCT":
            results.sort(key=lambda x: 0 if x.train_number == "12956" else type_priority.get(x.train_type, 9))
        else:
            results.sort(key=lambda x: type_priority.get(x.train_type, 9))

        return results

    def get_train_details(self, train_number: str) -> Optional[TrainDetails]:
        data = MOCK_TRAINS_DATA.get(train_number.strip())
        if not data:
            return None

        stops = [
            StationStop(
                station_code=s["code"], station_name=s["name"], scheduled_arrival=s["arr"],
                scheduled_departure=s["dep"], halt_minutes=s["halt"], day_of_journey=s["day"],
                platform=s.get("pf", "PF 1"), distance_km=s.get("km", 0), delay_minutes=0
            ) for s in data["stops"]
        ]
        return TrainDetails(
            train_number=data["train_number"], train_name=data["train_name"], train_type=data["train_type"],
            source_code=data["source_code"], source_name=data["source_name"], dest_code=data["dest_code"],
            dest_name=data["dest_name"], departure_time=data["departure_time"], arrival_time=data["arrival_time"],
            duration=data["duration"], running_days=data["running_days"], classes=data["classes"],
            pantry=data.get("pantry", True), total_distance_km=data.get("total_distance_km", 0), stops=stops
        )

    def get_train_route(self, train_number: str) -> List[StationStop]:
        details = self.get_train_details(train_number)
        return details.stops if details else []

    def get_running_status(self, train_number: str, journey_date: Optional[str] = None) -> Optional[RunningStatus]:
        data = MOCK_TRAINS_DATA.get(train_number.strip())
        if not data:
            return None

        now_ist = get_ist_now()
        j_date = journey_date or now_ist.strftime("%Y-%m-%d")
        delay = 12

        stops_count = len(data["stops"])
        current_idx = min(1, stops_count - 1) if stops_count <= 2 else min(2, stops_count - 1)

        def add_mins(time_str: str, mins: int) -> str:
            h, m = map(int, time_str.split(":"))
            total = m + mins
            return f"{(h + total // 60) % 24:02d}:{total % 60:02d}"

        timeline = [
            StationStop(
                station_code=s["code"], station_name=s["name"], scheduled_arrival=s["arr"],
                scheduled_departure=s["dep"],
                actual_arrival=add_mins(s["arr"], delay) if idx <= current_idx or idx == current_idx + 1 else None,
                actual_departure=add_mins(s["dep"], delay) if idx <= current_idx else None,
                halt_minutes=s["halt"], day_of_journey=s["day"], platform=s.get("pf", "PF 1"),
                distance_km=s.get("km", 0), delay_minutes=delay if idx >= 1 else 0, has_departed=(idx <= current_idx)
            ) for idx, s in enumerate(data["stops"])
        ]

        curr_stop = data["stops"][current_idx]
        next_stop = data["stops"][current_idx + 1] if current_idx + 1 < stops_count else None
        prev_stop = data["stops"][current_idx - 1] if current_idx > 0 else None

        return RunningStatus(
            train_number=data["train_number"], train_name=data["train_name"], journey_date=j_date,
            current_status="RUNNING", current_station=curr_stop["code"], current_station_name=curr_stop["name"],
            delay_minutes=delay, delay_status=f"Running late by {delay} mins",
            next_station=next_stop["code"] if next_stop else None,
            next_station_name=next_stop["name"] if next_stop else None,
            previous_station=prev_stop["code"] if prev_stop else None,
            last_updated=now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
            timeline=timeline, stale_data=False,
            source_attribution="Verified reference simulation. Verify through official NTES (enquiry.indianrail.gov.in) / Helpline 139."
        )

    def get_pnr_status(self, pnr: str) -> Optional[Any]:
        """Deterministic high-fidelity offline simulated PNR response."""
        from storage.models import PNRResponse, PNRPassenger
        clean_pnr = pnr.strip()
        if len(clean_pnr) != 10 or not clean_pnr.isdigit():
            return None

        # Deterministic generation from PNR digits
        seed = sum(int(digit) * (idx + 7) for idx, digit in enumerate(clean_pnr))

        train_pool = [
            {"num": "12307", "name": "Jodhpur Superfast Express", "from": "DHN", "from_name": "Dhanbad Junction", "to": "JP", "to_name": "Jaipur Junction", "cls": "3A", "coach_prefix": "B"},
            {"num": "12987", "name": "Ajmer SF Express", "from": "DHN", "from_name": "Dhanbad Junction", "to": "AII", "to_name": "Ajmer Junction", "cls": "SL", "coach_prefix": "S"},
            {"num": "12952", "name": "Mumbai Tejas Rajdhani Express", "from": "NDLS", "from_name": "New Delhi", "to": "BCT", "to_name": "Mumbai Central", "cls": "2A", "coach_prefix": "A"},
            {"num": "12302", "name": "Howrah Rajdhani Express", "from": "NDLS", "from_name": "New Delhi", "to": "HWH", "to_name": "Howrah Junction", "cls": "3A", "coach_prefix": "B"},
            {"num": "12004", "name": "Lucknow Shatabdi Express", "from": "NDLS", "from_name": "New Delhi", "to": "LKO", "to_name": "Lucknow Charbagh", "cls": "CC", "coach_prefix": "C"}
        ]
        selected_train = train_pool[seed % len(train_pool)]

        # Date calculation (today + 1..5 days)
        now_ist = get_ist_now()
        j_date = (now_ist + timedelta(days=(seed % 5) + 1)).strftime("%d-%b-%Y")

        # Charting state
        chart_status = "CHART PREPARED" if (seed % 3 == 0) else "CHART NOT PREPARED"

        # Passenger counts (1 to 3 passengers)
        p_count = (seed % 3) + 1
        passengers = []
        berth_types = ["Lower Berth (LB)", "Middle Berth (MB)", "Upper Berth (UB)", "Side Lower (SL)", "Side Upper (SU)"]

        for i in range(1, p_count + 1):
            p_seed = seed + i * 17
            coach_num = (p_seed % 4) + 1
            coach_code = f"{selected_train['coach_prefix']}{coach_num}"
            berth_num = (p_seed % 64) + 1
            b_type = berth_types[p_seed % len(berth_types)]

            if seed % 7 == 0:
                bk_status = f"WL {(p_seed % 15) + 5}"
                curr_status = f"RAC {(p_seed % 5) + 1}"
            elif seed % 7 == 1:
                bk_status = f"RAC {(p_seed % 10) + 1}"
                curr_status = "CNF"
            elif seed % 7 == 2:
                bk_status = f"WL {(p_seed % 30) + 10}"
                curr_status = f"WL {(p_seed % 10) + 1}"
            else:
                bk_status = "CNF"
                curr_status = "CNF"

            passengers.append(PNRPassenger(
                number=i,
                booking_status=f"{bk_status}/{coach_code}/{berth_num}" if "CNF" in bk_status else bk_status,
                current_status=f"{curr_status}/{coach_code}/{berth_num}" if "CNF" in curr_status else curr_status,
                coach=coach_code if "CNF" in curr_status else "WL",
                berth=berth_num if "CNF" in curr_status else 0,
                berth_type=b_type if "CNF" in curr_status else "None"
            ))

        return PNRResponse(
            pnr_number=clean_pnr,
            train_number=selected_train["num"],
            train_name=selected_train["name"],
            journey_date=j_date,
            from_station=selected_train["from"],
            from_station_name=selected_train["from_name"],
            to_station=selected_train["to"],
            to_station_name=selected_train["to_name"],
            boarding_station=f"{selected_train['from']} - {selected_train['from_name']}",
            reservation_upto=f"{selected_train['to']} - {selected_train['to_name']}",
            booking_class=selected_train["cls"],
            quota="TQ (Tatkal)" if (seed % 4 == 0) else "GN (General)",
            chart_status=chart_status,
            passengers=passengers,
            is_mock=True,
            notice="Demo PNR Record (Offline Simulation). RailReady does not connect directly to PRS/IRCTC."
        )

    def get_coach_composition(self, train_number: str) -> Optional[Any]:
        """Provides realistic rake and coach composition layout."""
        from storage.models import CoachCompositionResponse, CoachInfo
        clean_no = train_number.strip()
        data = MOCK_TRAINS_DATA.get(clean_no)
        train_name = data["train_name"] if data else f"Express Train {clean_no}"
        t_type = data["train_type"] if data else "Superfast"

        coaches = []
        if "Rajdhani" in t_type:
            rake_type = "LHB Tejas / Rajdhani Rake"
            coaches.append(CoachInfo(coach_code="EOG", coach_type="End On Generation / Generator Car", class_code="EOG", total_berths=0, berth_layout="Power Car"))
            coaches.append(CoachInfo(coach_code="H1", coach_type="AC First Class (1A)", class_code="1A", total_berths=24, berth_layout="Coupe & Cabin (1-24)"))
            for i in range(1, 4):
                coaches.append(CoachInfo(coach_code=f"A{i}", coach_type="AC 2-Tier (2A)", class_code="2A", total_berths=54, berth_layout="LB, UB, SL, SU (1-54)"))
            coaches.append(CoachInfo(coach_code="PC", coach_type="Pantry Car", class_code="PC", total_berths=0, berth_layout="Kitchen & Dining Storage"))
            for i in range(1, 9):
                coaches.append(CoachInfo(coach_code=f"B{i}", coach_type="AC 3-Tier (3A)", class_code="3A", total_berths=72, berth_layout="LB, MB, UB, SL, SU (1-72)"))
            coaches.append(CoachInfo(coach_code="EOG", coach_type="End On Generation / Luggage", class_code="EOG", total_berths=0, berth_layout="Power Car"))
        elif "Shatabdi" in t_type:
            rake_type = "LHB Shatabdi Day Express"
            coaches.append(CoachInfo(coach_code="EOG", coach_type="End On Generation", class_code="EOG", total_berths=0, berth_layout="Power Car"))
            coaches.append(CoachInfo(coach_code="E1", coach_type="Executive Chair Car (EC)", class_code="EC", total_berths=56, berth_layout="2x2 Reclining (1-56)"))
            for i in range(1, 11):
                coaches.append(CoachInfo(coach_code=f"C{i}", coach_type="AC Chair Car (CC)", class_code="CC", total_berths=78, berth_layout="3x2 Seating (1-78)"))
            coaches.append(CoachInfo(coach_code="EOG", coach_type="End On Generation", class_code="EOG", total_berths=0, berth_layout="Power Car"))
        elif "Passenger" in t_type or "MEMU" in t_type:
            rake_type = "MEMU / Passenger Rake"
            coaches.append(CoachInfo(coach_code="DMC", coach_type="Driving Motor Coach", class_code="GEN", total_berths=80, berth_layout="Unreserved High-Capacity (1-80)"))
            for i in range(1, 7):
                coaches.append(CoachInfo(coach_code=f"TC{i}", coach_type="Trailer Coach (General)", class_code="GEN", total_berths=100, berth_layout="Unreserved Commuter (1-100)"))
            coaches.append(CoachInfo(coach_code="DMC", coach_type="Driving Motor Coach", class_code="GEN", total_berths=80, berth_layout="Unreserved High-Capacity (1-80)"))
        else:
            rake_type = "Standard 22-Coach LHB Express"
            coaches.append(CoachInfo(coach_code="SLR", coach_type="Seating cum Luggage Rake", class_code="SLR", total_berths=30, berth_layout="Guard & Disabled Friendly (1-30)"))
            coaches.append(CoachInfo(coach_code="GEN1", coach_type="General Unreserved", class_code="GEN", total_berths=90, berth_layout="Unreserved 2S (1-90)"))
            coaches.append(CoachInfo(coach_code="GEN2", coach_type="General Unreserved", class_code="GEN", total_berths=90, berth_layout="Unreserved 2S (1-90)"))
            for i in range(1, 7):
                coaches.append(CoachInfo(coach_code=f"S{i}", coach_type="Sleeper Class (SL)", class_code="SL", total_berths=80, berth_layout="LB, MB, UB, SL, SU (1-80)"))
            coaches.append(CoachInfo(coach_code="PC", coach_type="Pantry Car", class_code="PC", total_berths=0, berth_layout="Hot Food & Catering"))
            for i in range(1, 7):
                coaches.append(CoachInfo(coach_code=f"B{i}", coach_type="AC 3-Tier (3A)", class_code="3A", total_berths=72, berth_layout="LB, MB, UB, SL, SU (1-72)"))
            coaches.append(CoachInfo(coach_code="A1", coach_type="AC 2-Tier (2A)", class_code="2A", total_berths=54, berth_layout="LB, UB, SL, SU (1-54)"))
            coaches.append(CoachInfo(coach_code="A2", coach_type="AC 2-Tier (2A)", class_code="2A", total_berths=54, berth_layout="LB, UB, SL, SU (1-54)"))
            coaches.append(CoachInfo(coach_code="H1", coach_type="AC First Class (1A)", class_code="1A", total_berths=24, berth_layout="Coupe & Cabin (1-24)"))
            coaches.append(CoachInfo(coach_code="GEN3", coach_type="General Unreserved", class_code="GEN", total_berths=90, berth_layout="Unreserved 2S (1-90)"))
            coaches.append(CoachInfo(coach_code="SLR", coach_type="Seating cum Luggage Rake", class_code="SLR", total_berths=30, berth_layout="Guard & Luggage"))

        return CoachCompositionResponse(
            train_number=clean_no,
            train_name=train_name,
            total_coaches=len(coaches),
            coaches=coaches,
            rake_type=rake_type
        )
