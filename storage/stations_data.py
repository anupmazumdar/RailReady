"""Master dataset of Indian railway stations with code, name, city, state, and popularity status."""
from typing import List, Dict, Optional

ALL_STATIONS: List[Dict[str, any]] = [
    {"code": "NDLS", "name": "New Delhi", "city": "New Delhi", "state": "Delhi", "is_popular": True},
    {"code": "DLI", "name": "Old Delhi Junction", "city": "Delhi", "state": "Delhi", "is_popular": True},
    {"code": "NZM", "name": "Hazrat Nizamuddin", "city": "New Delhi", "state": "Delhi", "is_popular": True},
    {"code": "ANVT", "name": "Anand Vihar Terminal", "city": "Delhi", "state": "Delhi", "is_popular": True},
    {"code": "BCT", "name": "Mumbai Central", "city": "Mumbai", "state": "Maharashtra", "is_popular": True},
    {"code": "CSMT", "name": "Chhatrapati Shivaji Maharaj Terminus", "city": "Mumbai", "state": "Maharashtra", "is_popular": True},
    {"code": "BDTS", "name": "Bandra Terminus", "city": "Mumbai", "state": "Maharashtra", "is_popular": True},
    {"code": "LTT", "name": "Lokmanya Tilak Terminus", "city": "Mumbai", "state": "Maharashtra", "is_popular": True},
    {"code": "PUNE", "name": "Pune Junction", "city": "Pune", "state": "Maharashtra", "is_popular": True},
    {"code": "NGP", "name": "Nagpur Junction", "city": "Nagpur", "state": "Maharashtra", "is_popular": True},
    {"code": "HWH", "name": "Howrah Junction", "city": "Kolkata", "state": "West Bengal", "is_popular": True},
    {"code": "SDAH", "name": "Sealdah", "city": "Kolkata", "state": "West Bengal", "is_popular": True},
    {"code": "KOAA", "name": "Kolkata Terminal", "city": "Kolkata", "state": "West Bengal", "is_popular": True},
    {"code": "ASN", "name": "Asansol Junction", "city": "Asansol", "state": "West Bengal", "is_popular": True},
    {"code": "DHN", "name": "Dhanbad Junction", "city": "Dhanbad", "state": "Jharkhand", "is_popular": True},
    {"code": "PNME", "name": "Parasnath", "city": "Giridih", "state": "Jharkhand", "is_popular": True},
    {"code": "KQR", "name": "Koderma Junction", "city": "Koderma", "state": "Jharkhand", "is_popular": True},
    {"code": "CRP", "name": "Chandrapura Junction", "city": "Bokaro", "state": "Jharkhand", "is_popular": True},
    {"code": "BKSC", "name": "Bokaro Steel City", "city": "Bokaro", "state": "Jharkhand", "is_popular": True},
    {"code": "RNC", "name": "Ranchi Junction", "city": "Ranchi", "state": "Jharkhand", "is_popular": True},
    {"code": "GAYA", "name": "Gaya Junction", "city": "Gaya", "state": "Bihar", "is_popular": True},
    {"code": "PNBE", "name": "Patna Junction", "city": "Patna", "state": "Bihar", "is_popular": True},
    {"code": "DDU", "name": "Pt. Deen Dayal Upadhyaya Junction", "city": "Mughalsarai", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "PRYJ", "name": "Prayagraj Junction", "city": "Prayagraj", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "CNB", "name": "Kanpur Central", "city": "Kanpur", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "LKO", "name": "Lucknow Charbagh", "city": "Lucknow", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "BSB", "name": "Varanasi Junction", "city": "Varanasi", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "AGC", "name": "Agra Cantt", "city": "Agra", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "AF", "name": "Agra Fort", "city": "Agra", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "GKP", "name": "Gorakhpur Junction", "city": "Gorakhpur", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "JHS", "name": "Virangana Lakshmibai Jhansi", "city": "Jhansi", "state": "Uttar Pradesh", "is_popular": True},
    {"code": "JP", "name": "Jaipur Junction", "city": "Jaipur", "state": "Rajasthan", "is_popular": True},
    {"code": "KWP", "name": "Khatipura", "city": "Jaipur", "state": "Rajasthan", "is_popular": True},
    {"code": "AII", "name": "Ajmer Junction", "city": "Ajmer", "state": "Rajasthan", "is_popular": True},
    {"code": "JU", "name": "Jodhpur Junction", "city": "Jodhpur", "state": "Rajasthan", "is_popular": True},
    {"code": "BKN", "name": "Bikaner Junction", "city": "Bikaner", "state": "Rajasthan", "is_popular": True},
    {"code": "KOTA", "name": "Kota Junction", "city": "Kota", "state": "Rajasthan", "is_popular": True},
    {"code": "ADI", "name": "Ahmedabad Junction", "city": "Ahmedabad", "state": "Gujarat", "is_popular": True},
    {"code": "BRC", "name": "Vadodara Junction", "city": "Vadodara", "state": "Gujarat", "is_popular": True},
    {"code": "ST", "name": "Surat", "city": "Surat", "state": "Gujarat", "is_popular": True},
    {"code": "BPL", "name": "Bhopal Junction", "city": "Bhopal", "state": "Madhya Pradesh", "is_popular": True},
    {"code": "RKMP", "name": "Rani Kamlapati", "city": "Bhopal", "state": "Madhya Pradesh", "is_popular": True},
    {"code": "GWL", "name": "Gwalior Junction", "city": "Gwalior", "state": "Madhya Pradesh", "is_popular": True},
    {"code": "ET", "name": "Itarsi Junction", "city": "Itarsi", "state": "Madhya Pradesh", "is_popular": True},
    {"code": "MAS", "name": "Chennai Central", "city": "Chennai", "state": "Tamil Nadu", "is_popular": True},
    {"code": "MS", "name": "Chennai Egmore", "city": "Chennai", "state": "Tamil Nadu", "is_popular": True},
    {"code": "SBC", "name": "KSR Bengaluru City", "city": "Bengaluru", "state": "Karnataka", "is_popular": True},
    {"code": "YPR", "name": "Yesvantpur Junction", "city": "Bengaluru", "state": "Karnataka", "is_popular": True},
    {"code": "HYB", "name": "Hyderabad Deccan", "city": "Hyderabad", "state": "Telangana", "is_popular": True},
    {"code": "SC", "name": "Secunderabad Junction", "city": "Secunderabad", "state": "Telangana", "is_popular": True},
    {"code": "BZA", "name": "Vijayawada Junction", "city": "Vijayawada", "state": "Andhra Pradesh", "is_popular": True},
    {"code": "BBS", "name": "Bhubaneswar", "city": "Bhubaneswar", "state": "Odisha", "is_popular": True},
    {"code": "R", "name": "Raipur Junction", "city": "Raipur", "state": "Chhattisgarh", "is_popular": True},
    {"code": "GHY", "name": "Guwahati", "city": "Guwahati", "state": "Assam", "is_popular": True},
    {"code": "CDG", "name": "Chandigarh Junction", "city": "Chandigarh", "state": "Chandigarh", "is_popular": True},
    {"code": "ASR", "name": "Amritsar Junction", "city": "Amritsar", "state": "Punjab", "is_popular": True},
    {"code": "JAT", "name": "Jammu Tawi", "city": "Jammu", "state": "Jammu and Kashmir", "is_popular": True},
    {"code": "SVDK", "name": "Shri Mata Vaishno Devi Katra", "city": "Katra", "state": "Jammu and Kashmir", "is_popular": True},
    {"code": "TVC", "name": "Thiruvananthapuram Central", "city": "Thiruvananthapuram", "state": "Kerala", "is_popular": True},
    {"code": "ERS", "name": "Ernakulam Junction", "city": "Kochi", "state": "Kerala", "is_popular": True},
    {"code": "CHTS", "name": "Cochin Harbour Terminus", "city": "Kochi", "state": "Kerala", "is_popular": False}
]

STATIONS_BY_CODE = {s["code"]: s for s in ALL_STATIONS}


def search_stations(query: Optional[str] = None, limit: int = 20) -> List[Dict[str, any]]:
    """
    Search stations by code, station name, or city.
    Ranks exact code match highest, then starts-with, then popular stations.
    """
    if not query:
        # Return popular stations
        popular = [s for s in ALL_STATIONS if s["is_popular"]]
        return popular[:limit]

    q = query.strip().upper()
    exact_matches = []
    prefix_code_matches = []
    prefix_name_matches = []
    contains_matches = []

    for s in ALL_STATIONS:
        code = s["code"].upper()
        name = s["name"].upper()
        city = (s["city"] or "").upper()

        if code == q:
            exact_matches.append(s)
        elif code.startswith(q):
            prefix_code_matches.append(s)
        elif name.startswith(q) or city.startswith(q):
            prefix_name_matches.append(s)
        elif q in name or q in city or q in code:
            contains_matches.append(s)

    combined = exact_matches + prefix_code_matches + prefix_name_matches + contains_matches
    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for s in combined:
        if s["code"] not in seen:
            seen.add(s["code"])
            deduped.append(s)

    return deduped[:limit]


def get_station_by_code(code: str) -> Optional[Dict[str, any]]:
    """Retrieve station metadata by code."""
    if not code:
        return None
    return STATIONS_BY_CODE.get(code.strip().upper())
