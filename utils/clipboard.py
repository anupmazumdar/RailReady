from typing import List, Optional
from storage.models import PassengerResponse, JourneyResponse


def generate_full_passenger_summary(
    passengers: List[PassengerResponse],
    journey: Optional[JourneyResponse] = None
) -> str:
    """
    Formats all passengers into a clean, human-readable summary
    for quick reference and clipboard copying.
    """
    if not passengers:
        return "No passenger details prepared."

    lines = [
        "=== TATKAL PREPARED PASSENGER DETAILS ==="
    ]

    if journey:
        lines.append(f"Route: {journey.from_station} -> {journey.to_station}")
        lines.append(f"Date: {journey.journey_date} | Train: {journey.preferred_train} ({journey.preferred_class})")
        lines.append(f"Quota: Tatkal ({journey.tatkal_type.value})")
        lines.append("------------------------------------------")

    for idx, p in enumerate(passengers, start=1):
        lines.append(f"Passenger {idx}:")
        lines.append(f"  Name:  {p.name}")
        lines.append(f"  Age:   {p.age} | Gender: {p.gender.value.capitalize()}")
        lines.append(f"  Berth: {p.berth_preference.value} | Meal: {p.meal_preference.value}")
        if p.senior_citizen_opt:
            lines.append("  Option: Senior Citizen Concession Requested")
        lines.append("")

    lines.append("==========================================")
    lines.append("Instructions: Use these details to manually fill the passenger fields")
    lines.append("on the official IRCTC website (https://www.irctc.co.in).")
    
    return "\n".join(lines).strip()


def generate_quick_row_format(passengers: List[PassengerResponse]) -> str:
    """
    Generates a concise tab-separated or comma-separated table format.
    """
    if not passengers:
        return ""
    rows = ["Name, Age, Gender, Berth, Meal"]
    for p in passengers:
        rows.append(f"{p.name}, {p.age}, {p.gender.value}, {p.berth_preference.value}, {p.meal_preference.value}")
    return "\n".join(rows)


def generate_irctc_quick_format(passengers: List[PassengerResponse]) -> str:
    """
    Generates an IRCTC form-aligned pipe-separated fast entry string.
    """
    if not passengers:
        return ""
    lines = []
    for idx, p in enumerate(passengers, start=1):
        sr = " [Senior Citizen]" if p.senior_citizen_opt else ""
        lines.append(f"{idx}. {p.name} | {p.age}y | {p.gender.value} | {p.berth_preference.value} | {p.meal_preference.value}{sr}")
    return "\n".join(lines)

