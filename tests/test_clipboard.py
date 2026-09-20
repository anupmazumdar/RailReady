from storage.models import (
    PassengerResponse,
    JourneyResponse,
    Gender,
    BerthPreference,
    MealPreference,
    TatkalType
)
from utils.clipboard import (
    generate_full_passenger_summary,
    generate_quick_row_format
)


def test_clipboard_formatting_with_passengers():
    passengers = [
        PassengerResponse(
            id=1,
            name="Amit Kumar",
            age=35,
            gender=Gender.MALE,
            berth_preference=BerthPreference.LOWER,
            meal_preference=MealPreference.VEG
        ),
        PassengerResponse(
            id=2,
            name="Pooja Kumar",
            age=32,
            gender=Gender.FEMALE,
            berth_preference=BerthPreference.MIDDLE,
            meal_preference=MealPreference.NON_VEG
        )
    ]

    journey = JourneyResponse(
        id=1,
        from_station="NDLS",
        to_station="BCT",
        journey_date="2026-10-20",
        preferred_train="12952 TEJAS RAJ",
        preferred_class="3A",
        tatkal_type=TatkalType.AC,
        expected_opening_time="2026-10-19 10:00:00 IST",
        passengers=[],
        created_at="2026-09-20T00:00:00"
    )

    summary = generate_full_passenger_summary(passengers, journey)

    assert "TATKAL PREPARED PASSENGER DETAILS" in summary
    assert "Amit Kumar" in summary
    assert "Pooja Kumar" in summary
    assert "12952 TEJAS RAJ" in summary
    assert "https://www.irctc.co.in" in summary


def test_clipboard_empty_passengers():
    summary = generate_full_passenger_summary([])
    assert summary == "No passenger details prepared."


def test_quick_row_format():
    passengers = [
        PassengerResponse(
            id=1,
            name="Rohit Verma",
            age=28,
            gender=Gender.MALE,
            berth_preference=BerthPreference.SIDE_LOWER,
            meal_preference=MealPreference.NONE
        )
    ]
    row = generate_quick_row_format(passengers)
    assert "Rohit Verma, 28, MALE, Side Lower, None" in row
