"""
Offline Indian Railways major corridors and train timetable dataset.
Provides schedules, intermediate stops, and timings for route-splitting and direct search.
"""

from typing import List, Dict, Any

# Primary Railway Stations & Transit Junctions
STATION_NAMES = {
    "NDLS": "New Delhi",
    "DLI": "Old Delhi",
    "NZM": "Hazrat Nizamuddin",
    "CNB": "Kanpur Central",
    "PRYJ": "Prayagraj Junction",
    "DDU": "Pt. Deen Dayal Upadhyaya Junction",
    "PNBE": "Patna Junction",
    "HWH": "Howrah Junction",
    "SDAH": "Sealdah",
    "LKO": "Lucknow Charbagh",
    "BCT": "Mumbai Central",
    "CSMT": "Mumbai CSMT",
    "BDTS": "Bandra Terminus",
    "BRC": "Vadodara Junction",
    "ST": "Surat",
    "KOTA": "Kota Junction",
    "ADI": "Ahmedabad Junction",
    "JP": "Jaipur Junction",
    "BPL": "Bhopal Junction",
    "ET": "Itarsi Junction",
    "NGP": "Nagpur Junction",
    "BZA": "Vijayawada Junction",
    "SC": "Secunderabad Junction",
    "HYB": "Hyderabad Deccan",
    "MAS": "Chennai Central",
    "SBC": "KSR Bengaluru City",
    "GHY": "Guwahati",
    "PUNE": "Pune Junction"
}

# Major Trains with intermediate stop schedules
TRAINS_DATABASE: List[Dict[str, Any]] = [
    # New Delhi - Howrah / Eastern Corridor
    {
        "train_number": "12302",
        "train_name": "Howrah Rajdhani Express",
        "type": "Rajdhani",
        "origin": "NDLS",
        "destination": "HWH",
        "departure_time": "16:50",
        "arrival_time": "09:55",
        "duration_hours": 17.08,
        "classes": ["1A", "2A", "3A"],
        "stops": [
            {"station": "NDLS", "arr": "16:50", "dep": "16:50", "day": 1},
            {"station": "CNB", "arr": "21:32", "dep": "21:37", "day": 1},
            {"station": "PRYJ", "arr": "23:43", "dep": "23:45", "day": 1},
            {"station": "DDU", "arr": "01:47", "dep": "01:57", "day": 2},
            {"station": "HWH", "arr": "09:55", "dep": "09:55", "day": 2},
        ]
    },
    {
        "train_number": "12301",
        "train_name": "Howrah - New Delhi Rajdhani Express",
        "type": "Rajdhani",
        "origin": "HWH",
        "destination": "NDLS",
        "departure_time": "16:50",
        "arrival_time": "10:05",
        "duration_hours": 17.25,
        "classes": ["1A", "2A", "3A"],
        "stops": [
            {"station": "HWH", "arr": "16:50", "dep": "16:50", "day": 1},
            {"station": "DDU", "arr": "00:45", "dep": "00:55", "day": 2},
            {"station": "PRYJ", "arr": "02:43", "dep": "02:45", "day": 2},
            {"station": "CNB", "arr": "04:50", "dep": "04:55", "day": 2},
            {"station": "NDLS", "arr": "10:05", "dep": "10:05", "day": 2},
        ]
    },
    {
        "train_number": "12304",
        "train_name": "Poorva Express",
        "type": "Superfast",
        "origin": "NDLS",
        "destination": "HWH",
        "departure_time": "17:40",
        "arrival_time": "17:00",
        "duration_hours": 23.33,
        "classes": ["1A", "2A", "3A", "SL"],
        "stops": [
            {"station": "NDLS", "arr": "17:40", "dep": "17:40", "day": 1},
            {"station": "CNB", "arr": "22:55", "dep": "23:05", "day": 1},
            {"station": "PRYJ", "arr": "01:15", "dep": "01:20", "day": 2},
            {"station": "DDU", "arr": "03:50", "dep": "04:00", "day": 2},
            {"station": "PNBE", "arr": "06:50", "dep": "07:00", "day": 2},
            {"station": "HWH", "arr": "17:00", "dep": "17:00", "day": 2},
        ]
    },
    {
        "train_number": "12004",
        "train_name": "Lucknow Shatabdi Express",
        "type": "Shatabdi",
        "origin": "NDLS",
        "destination": "LKO",
        "departure_time": "06:10",
        "arrival_time": "12:40",
        "duration_hours": 6.5,
        "classes": ["CC", "EC"],
        "stops": [
            {"station": "NDLS", "arr": "06:10", "dep": "06:10", "day": 1},
            {"station": "CNB", "arr": "11:20", "dep": "11:25", "day": 1},
            {"station": "LKO", "arr": "12:40", "dep": "12:40", "day": 1},
        ]
    },
    {
        "train_number": "12424",
        "train_name": "Dibrugarh Rajdhani Express",
        "type": "Rajdhani",
        "origin": "NDLS",
        "destination": "GHY",
        "departure_time": "16:20",
        "arrival_time": "19:30",
        "duration_hours": 27.16,
        "classes": ["1A", "2A", "3A"],
        "stops": [
            {"station": "NDLS", "arr": "16:20", "dep": "16:20", "day": 1},
            {"station": "CNB", "arr": "21:02", "dep": "21:07", "day": 1},
            {"station": "DDU", "arr": "01:23", "dep": "01:33", "day": 2},
            {"station": "PNBE", "arr": "04:10", "dep": "04:20", "day": 2},
            {"station": "GHY", "arr": "19:30", "dep": "19:30", "day": 2},
        ]
    },
    # Western Corridor (Delhi - Mumbai / Ahmedabad)
    {
        "train_number": "12952",
        "train_name": "Mumbai Tejas Rajdhani",
        "type": "Rajdhani",
        "origin": "NDLS",
        "destination": "BCT",
        "departure_time": "16:55",
        "arrival_time": "08:35",
        "duration_hours": 15.66,
        "classes": ["1A", "2A", "3A", "3E"],
        "stops": [
            {"station": "NDLS", "arr": "16:55", "dep": "16:55", "day": 1},
            {"station": "KOTA", "arr": "21:30", "dep": "21:40", "day": 1},
            {"station": "BRC", "arr": "03:40", "dep": "03:50", "day": 2},
            {"station": "BCT", "arr": "08:35", "dep": "08:35", "day": 2},
        ]
    },
    {
        "train_number": "12951",
        "train_name": "New Delhi Tejas Rajdhani",
        "type": "Rajdhani",
        "origin": "BCT",
        "destination": "NDLS",
        "departure_time": "17:00",
        "arrival_time": "08:32",
        "duration_hours": 15.53,
        "classes": ["1A", "2A", "3A", "3E"],
        "stops": [
            {"station": "BCT", "arr": "17:00", "dep": "17:00", "day": 1},
            {"station": "BRC", "arr": "21:06", "dep": "21:16", "day": 1},
            {"station": "KOTA", "arr": "03:15", "dep": "03:25", "day": 2},
            {"station": "NDLS", "arr": "08:32", "dep": "08:32", "day": 2},
        ]
    },
    {
        "train_number": "12954",
        "train_name": "August Kranti Tejas Rajdhani",
        "type": "Rajdhani",
        "origin": "NZM",
        "destination": "BCT",
        "departure_time": "17:15",
        "arrival_time": "10:05",
        "duration_hours": 16.83,
        "classes": ["1A", "2A", "3A"],
        "stops": [
            {"station": "NZM", "arr": "17:15", "dep": "17:15", "day": 1},
            {"station": "KOTA", "arr": "22:50", "dep": "23:00", "day": 1},
            {"station": "BRC", "arr": "05:10", "dep": "05:20", "day": 2},
            {"station": "ST", "arr": "06:40", "dep": "06:45", "day": 2},
            {"station": "BCT", "arr": "10:05", "dep": "10:05", "day": 2},
        ]
    },
    {
        "train_number": "12009",
        "train_name": "Mumbai - Ahmedabad Shatabdi",
        "type": "Shatabdi",
        "origin": "BCT",
        "destination": "ADI",
        "departure_time": "06:20",
        "arrival_time": "12:45",
        "duration_hours": 6.41,
        "classes": ["CC", "EC"],
        "stops": [
            {"station": "BCT", "arr": "06:20", "dep": "06:20", "day": 1},
            {"station": "ST", "arr": "09:15", "dep": "09:18", "day": 1},
            {"station": "BRC", "arr": "10:45", "dep": "10:48", "day": 1},
            {"station": "ADI", "arr": "12:45", "dep": "12:45", "day": 1},
        ]
    },
    # Central & Southern Corridor (Delhi - Bhopal - Nagpur - Hyderabad - Bangalore - Chennai)
    {
        "train_number": "12626",
        "train_name": "Kerala Superfast Express",
        "type": "Superfast",
        "origin": "NDLS",
        "destination": "MAS",
        "departure_time": "20:10",
        "arrival_time": "04:30",
        "duration_hours": 32.33,
        "classes": ["2A", "3A", "SL"],
        "stops": [
            {"station": "NDLS", "arr": "20:10", "dep": "20:10", "day": 1},
            {"station": "BPL", "arr": "05:20", "dep": "05:25", "day": 2},
            {"station": "ET", "arr": "07:05", "dep": "07:10", "day": 2},
            {"station": "NGP", "arr": "11:45", "dep": "11:50", "day": 2},
            {"station": "BZA", "arr": "22:15", "dep": "22:25", "day": 2},
            {"station": "MAS", "arr": "04:30", "dep": "04:30", "day": 3},
        ]
    },
    {
        "train_number": "22692",
        "train_name": "Bengaluru Rajdhani Express",
        "type": "Rajdhani",
        "origin": "NZM",
        "destination": "SBC",
        "departure_time": "19:50",
        "arrival_time": "05:20",
        "duration_hours": 33.5,
        "classes": ["1A", "2A", "3A"],
        "stops": [
            {"station": "NZM", "arr": "19:50", "dep": "19:50", "day": 1},
            {"station": "BPL", "arr": "03:45", "dep": "03:55", "day": 2},
            {"station": "NGP", "arr": "09:25", "dep": "09:30", "day": 2},
            {"station": "SC", "arr": "17:10", "dep": "17:25", "day": 2},
            {"station": "SBC", "arr": "05:20", "dep": "05:20", "day": 3},
        ]
    },
    {
        "train_number": "12622",
        "train_name": "Tamil Nadu Express",
        "type": "Superfast",
        "origin": "NDLS",
        "destination": "MAS",
        "departure_time": "21:05",
        "arrival_time": "06:15",
        "duration_hours": 33.16,
        "classes": ["1A", "2A", "3A", "SL"],
        "stops": [
            {"station": "NDLS", "arr": "21:05", "dep": "21:05", "day": 1},
            {"station": "BPL", "arr": "06:45", "dep": "06:50", "day": 2},
            {"station": "NGP", "arr": "13:05", "dep": "13:10", "day": 2},
            {"station": "BZA", "arr": "23:25", "dep": "23:35", "day": 2},
            {"station": "MAS", "arr": "06:15", "dep": "06:15", "day": 3},
        ]
    },
    # Intermediate Shuttle / Connecting Link Trains
    {
        "train_number": "12034",
        "train_name": "Kanpur - New Delhi Shatabdi",
        "type": "Shatabdi",
        "origin": "CNB",
        "destination": "NDLS",
        "departure_time": "06:00",
        "arrival_time": "11:05",
        "duration_hours": 5.08,
        "classes": ["CC", "EC"],
        "stops": [
            {"station": "CNB", "arr": "06:00", "dep": "06:00", "day": 1},
            {"station": "NDLS", "arr": "11:05", "dep": "11:05", "day": 1},
        ]
    },
    {
        "train_number": "12306",
        "train_name": "Kolkata Rajdhani (Via Patna)",
        "type": "Rajdhani",
        "origin": "NDLS",
        "destination": "HWH",
        "departure_time": "16:50",
        "arrival_time": "12:25",
        "duration_hours": 19.58,
        "classes": ["1A", "2A", "3A"],
        "stops": [
            {"station": "NDLS", "arr": "16:50", "dep": "16:50", "day": 1},
            {"station": "CNB", "arr": "21:32", "dep": "21:37", "day": 1},
            {"station": "DDU", "arr": "01:47", "dep": "01:57", "day": 2},
            {"station": "PNBE", "arr": "04:15", "dep": "04:25", "day": 2},
            {"station": "HWH", "arr": "12:25", "dep": "12:25", "day": 2},
        ]
    },
    {
        "train_number": "12002",
        "train_name": "Bhopal Shatabdi Express",
        "type": "Shatabdi",
        "origin": "NDLS",
        "destination": "BPL",
        "departure_time": "06:00",
        "arrival_time": "14:40",
        "duration_hours": 8.66,
        "classes": ["CC", "EC"],
        "stops": [
            {"station": "NDLS", "arr": "06:00", "dep": "06:00", "day": 1},
            {"station": "BPL", "arr": "14:40", "dep": "14:40", "day": 1},
        ]
    },
    {
        "train_number": "12724",
        "train_name": "Telangana Express",
        "type": "Superfast",
        "origin": "NDLS",
        "destination": "HYB",
        "departure_time": "16:00",
        "arrival_time": "17:10",
        "duration_hours": 25.16,
        "classes": ["1A", "2A", "3A", "SL"],
        "stops": [
            {"station": "NDLS", "arr": "16:00", "dep": "16:00", "day": 1},
            {"station": "BPL", "arr": "01:20", "dep": "01:30", "day": 2},
            {"station": "NGP", "arr": "07:10", "dep": "07:15", "day": 2},
            {"station": "SC", "arr": "15:55", "dep": "16:00", "day": 2},
            {"station": "HYB", "arr": "17:10", "dep": "17:10", "day": 2},
        ]
    }
]
