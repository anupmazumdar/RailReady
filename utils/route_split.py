from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from storage.routes_data import TRAINS_DATABASE, STATION_NAMES


def extract_station_code(text: str) -> str:
    """Extract 2-5 letter station code from inputs like 'NDLS - New Delhi' or 'ndls'."""
    clean = text.strip().upper()
    if " - " in clean:
        clean = clean.split(" - ")[0].strip()
    return clean


def parse_time_to_minutes(time_str: str, day: int = 1) -> int:
    """Convert HH:MM and day offset to total minutes from Day 1 00:00."""
    hh, mm = map(int, time_str.split(":"))
    return (day - 1) * 1440 + hh * 60 + mm


def format_minutes_to_hours_mins(total_mins: int) -> str:
    h = total_mins // 60
    m = total_mins % 60
    if h > 0 and m > 0:
        return f"{h}h {m}m"
    elif h > 0:
        return f"{h}h"
    return f"{m}m"


def find_direct_trains(src_input: str, dst_input: str) -> List[Dict[str, Any]]:
    """Find all direct trains stopping at src before dst."""
    src = extract_station_code(src_input)
    dst = extract_station_code(dst_input)
    results = []

    for train in TRAINS_DATABASE:
        stops = train["stops"]
        src_idx = -1
        dst_idx = -1
        src_stop = None
        dst_stop = None

        for idx, s in enumerate(stops):
            if s["station"] == src and src_idx == -1:
                src_idx = idx
                src_stop = s
            elif s["station"] == dst and src_idx != -1:
                dst_idx = idx
                dst_stop = s
                break

        if src_idx != -1 and dst_idx != -1 and src_idx < dst_idx:
            dep_mins = parse_time_to_minutes(src_stop["dep"], src_stop["day"])
            arr_mins = parse_time_to_minutes(dst_stop["arr"], dst_stop["day"])
            duration_mins = arr_mins - dep_mins

            results.append({
                "train_number": train["train_number"],
                "train_name": train["train_name"],
                "type": train["type"],
                "classes": train["classes"],
                "from_station": src,
                "from_station_name": STATION_NAMES.get(src, src),
                "departure_time": src_stop["dep"],
                "departure_day": src_stop["day"],
                "to_station": dst,
                "to_station_name": STATION_NAMES.get(dst, dst),
                "arrival_time": dst_stop["arr"],
                "arrival_day": dst_stop["day"],
                "duration": format_minutes_to_hours_mins(duration_mins),
                "duration_minutes": duration_mins
            })

    # Sort by duration
    results.sort(key=lambda x: x["duration_minutes"])
    return results


def find_split_routes(
    src_input: str,
    dst_input: str,
    min_layover_hours: float = 1.0,
    max_layover_hours: float = 8.0
) -> List[Dict[str, Any]]:
    """
    Identifies 2-leg split journey alternatives via intermediate transit junctions.
    Calculates transfer layover time and ensures connection validity.
    """
    src = extract_station_code(src_input)
    dst = extract_station_code(dst_input)
    min_layover_mins = int(min_layover_hours * 60)
    max_layover_mins = int(max_layover_hours * 60)

    # Candidate intermediate junctions
    candidate_junctions = [code for code in STATION_NAMES if code not in (src, dst)]
    split_options = []

    for junction in candidate_junctions:
        leg1_trains = find_direct_trains(src, junction)
        leg2_trains = find_direct_trains(junction, dst)

        if not leg1_trains or not leg2_trains:
            continue

        for t1 in leg1_trains:
            for t2 in leg2_trains:
                # Disallow same train looping
                if t1["train_number"] == t2["train_number"]:
                    continue

                t1_arr_mins = parse_time_to_minutes(t1["arrival_time"], t1["arrival_day"])
                t2_dep_mins = parse_time_to_minutes(t2["departure_time"], t2["departure_day"])

                # Handle day rollover if t2 leaves after t1
                layover_mins = t2_dep_mins - t1_arr_mins
                if layover_mins < 0:
                    layover_mins += 1440  # next day departure

                if min_layover_mins <= layover_mins <= max_layover_mins:
                    total_travel_mins = t1["duration_minutes"] + layover_mins + t2["duration_minutes"]
                    split_options.append({
                        "junction_code": junction,
                        "junction_name": STATION_NAMES.get(junction, junction),
                        "layover_time": format_minutes_to_hours_mins(layover_mins),
                        "layover_minutes": layover_mins,
                        "total_duration": format_minutes_to_hours_mins(total_travel_mins),
                        "total_duration_minutes": total_travel_mins,
                        "leg1": {
                            "train_number": t1["train_number"],
                            "train_name": t1["train_name"],
                            "from": t1["from_station"],
                            "to": junction,
                            "departure": t1["departure_time"],
                            "arrival": t1["arrival_time"],
                            "duration": t1["duration"],
                            "classes": t1["classes"]
                        },
                        "leg2": {
                            "train_number": t2["train_number"],
                            "train_name": t2["train_name"],
                            "from": junction,
                            "to": t2["to_station"],
                            "departure": t2["departure_time"],
                            "arrival": t2["arrival_time"],
                            "duration": t2["duration"],
                            "classes": t2["classes"]
                        },
                        "connecting_pnr_eligible": layover_mins >= 60,
                        "booking_tip": (
                            f"Book Leg 1 ({t1['train_number']}) and Leg 2 ({t2['train_number']}) "
                            f"via IRCTC's 'Connecting Journey Booking' feature for 100% delay refund protection."
                        )
                    })

    # Sort by total duration
    split_options.sort(key=lambda x: x["total_duration_minutes"])
    return split_options[:10]  # Return top 10 best options


def get_live_status_guide(train_number: Optional[str] = None) -> Dict[str, Any]:
    """Generates verified official NTES live enquiry methods."""
    train = train_number.strip() if train_number else "YOUR_TRAIN_NO"
    return {
        "official_web_portal": {
            "name": "National Train Enquiry System (NTES)",
            "url": "https://enquiry.indianrail.gov.in/mntes/",
            "direct_search_url": f"https://enquiry.indianrail.gov.in/mntes/q?opt=TrainRunning&subOpt=ShowRunC&trainNo={train}",
            "description": "Official Ministry of Railways live train tracking portal."
        },
        "official_sms_service": {
            "number": "139",
            "syntax": f"SPOT {train}",
            "instruction": f"Send SMS 'SPOT {train}' to 139 from your mobile phone to receive real-time location and delay status."
        },
        "official_helpline": {
            "number": "139",
            "description": "Indian Railways Unified Passenger Helpline (24x7, Multilingual)."
        },
        "statutory_note": (
            "Live train tracking data is managed by CRIS via GPS-enabled RTIS devices installed on locomotives. "
            "Use official NTES or Railway Helpline 139 for verified running status."
        )
    }
