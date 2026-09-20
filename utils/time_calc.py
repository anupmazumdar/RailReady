from datetime import datetime, date, time, timedelta
from typing import Dict, Any
from zoneinfo import ZoneInfo
from config.settings import TIMEZONE_NAME, AC_TATKAL_HOUR, NON_AC_TATKAL_HOUR, TATKAL_ADVANCE_DAYS
from storage.models import TatkalType


def get_ist_now() -> datetime:
    """Returns the current datetime in Indian Standard Time (IST, UTC+05:30)."""
    try:
        ist_tz = ZoneInfo(TIMEZONE_NAME)
        return datetime.now(ist_tz)
    except Exception:
        # Fallback to fixed offset UTC+05:30 if zoneinfo database is absent
        from datetime import timezone
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        return datetime.now(ist_tz)


def get_ist_timezone():
    try:
        return ZoneInfo(TIMEZONE_NAME)
    except Exception:
        from datetime import timezone
        return timezone(timedelta(hours=5, minutes=30))


def calculate_tatkal_opening_time(journey_date_str: str, tatkal_type: TatkalType) -> datetime:
    """
    Calculates the exact Tatkal opening time in IST.
    Rule:
    - Tatkal booking opens 1 day in advance of journey date from originating station.
    - AC Tatkal (1A, 2A, 3A, 3E, CC, EC): 10:00:00 AM IST.
    - Non-AC Tatkal (SL, 2S): 11:00:00 AM IST.
    """
    # Parse journey date
    j_date = datetime.strptime(journey_date_str, "%Y-%m-%d").date()
    
    # Opening date is 1 day prior
    opening_date = j_date - timedelta(days=TATKAL_ADVANCE_DAYS)
    
    # Opening hour
    hour = AC_TATKAL_HOUR if tatkal_type == TatkalType.AC else NON_AC_TATKAL_HOUR
    opening_time = time(hour=hour, minute=0, second=0, microsecond=0)
    
    tz = get_ist_timezone()
    return datetime.combine(opening_date, opening_time, tzinfo=tz)


def get_countdown_info(opening_time_dt: datetime) -> Dict[str, Any]:
    """
    Calculates remaining time to Tatkal opening from current IST time.
    """
    now_ist = get_ist_now()
    
    # Ensure opening_time_dt has timezone info
    if opening_time_dt.tzinfo is None:
        opening_time_dt = opening_time_dt.replace(tzinfo=get_ist_timezone())
        
    diff = opening_time_dt - now_ist
    total_seconds = int(diff.total_seconds())

    if total_seconds <= 0:
        return {
            "total_seconds": 0,
            "days": 0,
            "hours": 0,
            "minutes": 0,
            "seconds": 0,
            "formatted": "00:00:00",
            "is_open": True,
            "status": "OPEN",
            "message": "Tatkal booking window should now be open. Please open/use IRCTC manually."
        }

    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    formatted = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    if days > 0:
        formatted = f"{days}d {formatted}"

    status = "UPCOMING"
    if total_seconds <= 900:  # within 15 minutes
        status = "OPENING_SOON"

    return {
        "total_seconds": total_seconds,
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "seconds": seconds,
        "formatted": formatted,
        "is_open": False,
        "status": status,
        "message": f"Tatkal opens in {formatted}."
    }
