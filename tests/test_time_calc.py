import pytest
from datetime import datetime, date, timedelta
from utils.time_calc import (
    calculate_tatkal_opening_time,
    get_countdown_info,
    get_ist_now,
    get_ist_timezone
)
from storage.models import TatkalType


def test_ac_tatkal_opening_time():
    """Verify AC Tatkal opens at 10:00:00 AM IST on the day prior to journey."""
    journey_date = "2026-10-15"
    opening_dt = calculate_tatkal_opening_time(journey_date, TatkalType.AC)

    assert opening_dt.year == 2026
    assert opening_dt.month == 10
    assert opening_dt.day == 14
    assert opening_dt.hour == 10
    assert opening_dt.minute == 0
    assert opening_dt.second == 0
    # Check IST offset (+05:30 = 19800 seconds)
    offset = opening_dt.utcoffset()
    assert offset == timedelta(hours=5, minutes=30)


def test_non_ac_tatkal_opening_time():
    """Verify Non-AC Tatkal opens at 11:00:00 AM IST on the day prior to journey."""
    journey_date = "2026-10-15"
    opening_dt = calculate_tatkal_opening_time(journey_date, TatkalType.NON_AC)

    assert opening_dt.year == 2026
    assert opening_dt.month == 10
    assert opening_dt.day == 14
    assert opening_dt.hour == 11
    assert opening_dt.minute == 0
    assert opening_dt.second == 0


def test_leap_year_boundary():
    """Verify opening date calculation correctly handles leap year February 29."""
    journey_date = "2028-03-01"  # 2028 is a leap year
    opening_dt = calculate_tatkal_opening_time(journey_date, TatkalType.AC)

    assert opening_dt.year == 2028
    assert opening_dt.month == 2
    assert opening_dt.day == 29
    assert opening_dt.hour == 10


def test_countdown_past_opening():
    """Verify that an opening time in the past reports is_open=True."""
    past_opening = get_ist_now() - timedelta(minutes=10)
    info = get_countdown_info(past_opening)

    assert info["is_open"] is True
    assert info["total_seconds"] == 0
    assert "Tatkal booking window should now be open" in info["message"]


def test_countdown_future_opening():
    """Verify that a future opening time returns positive seconds and status."""
    future_opening = get_ist_now() + timedelta(hours=2, minutes=30, seconds=15)
    info = get_countdown_info(future_opening)

    assert info["is_open"] is False
    assert info["hours"] == 2
    assert info["minutes"] == 30
    assert info["seconds"] in [14, 15]
    assert info["status"] == "UPCOMING"


def test_countdown_opening_soon():
    """Verify that an opening time within 15 minutes is labeled OPENING_SOON."""
    soon_opening = get_ist_now() + timedelta(minutes=8)
    info = get_countdown_info(soon_opening)

    assert info["is_open"] is False
    assert info["status"] == "OPENING_SOON"
