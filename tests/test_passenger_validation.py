import pytest
from pydantic import ValidationError
from storage.models import (
    PassengerCreate,
    Gender,
    BerthPreference,
    MealPreference
)


def test_valid_passenger():
    """Verify standard valid passenger schema."""
    p = PassengerCreate(
        name="Rahul Sharma",
        age=34,
        gender=Gender.MALE,
        berth_preference=BerthPreference.LOWER,
        meal_preference=MealPreference.VEG
    )
    assert p.name == "Rahul Sharma"
    assert p.age == 34
    assert p.gender == Gender.MALE


def test_invalid_name_too_long():
    """Verify name exceeding IRCTC 16-character limit fails validation."""
    with pytest.raises(ValidationError):
        PassengerCreate(
            name="Alexander The Great Long Name",
            age=30,
            gender=Gender.MALE
        )


def test_invalid_name_special_characters():
    """Verify name with disallowed characters (e.g. numbers/symbols) fails validation."""
    with pytest.raises(ValidationError):
        PassengerCreate(
            name="Rahul123",
            age=25,
            gender=Gender.MALE
        )


def test_invalid_age_bounds():
    """Verify ages below 1 or above 125 are rejected."""
    with pytest.raises(ValidationError):
        PassengerCreate(name="Baby", age=0, gender=Gender.FEMALE)

    with pytest.raises(ValidationError):
        PassengerCreate(name="Ancient", age=130, gender=Gender.FEMALE)


def test_valid_senior_citizen_toggle():
    """Verify optional senior citizen flag."""
    p = PassengerCreate(
        name="Sita Devi",
        age=68,
        gender=Gender.FEMALE,
        senior_citizen_opt=True
    )
    assert p.senior_citizen_opt is True
