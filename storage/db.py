import sqlite3
from typing import List, Optional, Dict, Any
from datetime import datetime
from config.settings import DB_PATH
from storage.models import (
    JourneyCreate,
    JourneyResponse,
    PassengerCreate,
    PassengerResponse,
    TatkalType,
    Gender,
    BerthPreference,
    MealPreference
)


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize local SQLite database tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS journeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_station TEXT NOT NULL,
        to_station TEXT NOT NULL,
        journey_date TEXT NOT NULL,
        preferred_train TEXT NOT NULL,
        preferred_class TEXT NOT NULL,
        tatkal_type TEXT NOT NULL,
        expected_opening_time TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS passengers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journey_id INTEGER,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        berth_preference TEXT NOT NULL,
        meal_preference TEXT NOT NULL,
        senior_citizen_opt INTEGER DEFAULT 0,
        FOREIGN KEY (journey_id) REFERENCES journeys(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS checklist (
        item_key TEXT PRIMARY KEY,
        item_text TEXT NOT NULL,
        checked INTEGER DEFAULT 0
    );
    """)

    # Seed default checklist items if empty
    default_items = [
        ("irctc_account", "IRCTC account credentials ready in mind (never enter into any app)", 0),
        ("journey_confirmed", "Journey details confirmed (Source, Destination, Date)", 0),
        ("train_confirmed", "Train number and schedule verified", 0),
        ("class_confirmed", "Class quota confirmed (AC at 10:00 AM / Non-AC at 11:00 AM)", 0),
        ("passengers_prepared", "Passenger details prepared and reviewed (max 4 for Tatkal)", 0),
        ("payment_ready", "Payment method ready (e.g. IRCTC eWallet, UPI, NetBanking)", 0),
        ("manual_site_open", "Official IRCTC website opened manually in personal browser", 0),
        ("rules_verified", "Verified current Indian Railways Tatkal quota guidelines", 0),
    ]

    for key, text, checked in default_items:
        cursor.execute(
            "INSERT OR IGNORE INTO checklist (item_key, item_text, checked) VALUES (?, ?, ?);",
            (key, text, checked)
        )

    # Automatic migration for alternate train slots
    cursor.execute("PRAGMA table_info(journeys);")
    existing_cols = [row["name"] for row in cursor.fetchall()]
    if "primary_train" not in existing_cols:
        cursor.execute("ALTER TABLE journeys ADD COLUMN primary_train TEXT;")
    if "alt_train_1" not in existing_cols:
        cursor.execute("ALTER TABLE journeys ADD COLUMN alt_train_1 TEXT;")
    if "alt_train_2" not in existing_cols:
        cursor.execute("ALTER TABLE journeys ADD COLUMN alt_train_2 TEXT;")

    conn.commit()
    conn.close()


def save_journey(journey: JourneyCreate, opening_time: str) -> JourneyResponse:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO journeys (from_station, to_station, journey_date, preferred_train, preferred_class, tatkal_type, primary_train, alt_train_1, alt_train_2, expected_opening_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        journey.from_station,
        journey.to_station,
        journey.journey_date,
        journey.preferred_train,
        journey.preferred_class,
        journey.tatkal_type.value,
        journey.primary_train or journey.preferred_train,
        journey.alt_train_1,
        journey.alt_train_2,
        opening_time,
        now_str
    ))
    journey_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return get_journey(journey_id)


def get_journey(journey_id: int) -> Optional[JourneyResponse]:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM journeys WHERE id = ?", (journey_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    cursor.execute("SELECT * FROM passengers WHERE journey_id = ?", (journey_id,))
    passenger_rows = cursor.fetchall()

    passengers = [
        PassengerResponse(
            id=p["id"],
            journey_id=p["journey_id"],
            name=p["name"],
            age=p["age"],
            gender=Gender(p["gender"]),
            berth_preference=BerthPreference(p["berth_preference"]),
            meal_preference=MealPreference(p["meal_preference"]),
            senior_citizen_opt=bool(p["senior_citizen_opt"])
        )
        for p in passenger_rows
    ]

    conn.close()
    return JourneyResponse(
        id=row["id"],
        from_station=row["from_station"],
        to_station=row["to_station"],
        journey_date=row["journey_date"],
        preferred_train=row["preferred_train"],
        preferred_class=row["preferred_class"],
        tatkal_type=TatkalType(row["tatkal_type"]),
        primary_train=row["primary_train"] if "primary_train" in row.keys() and row["primary_train"] else row["preferred_train"],
        alt_train_1=row["alt_train_1"] if "alt_train_1" in row.keys() else None,
        alt_train_2=row["alt_train_2"] if "alt_train_2" in row.keys() else None,
        expected_opening_time=row["expected_opening_time"],
        passengers=passengers,
        created_at=row["created_at"]
    )


def get_latest_journey() -> Optional[JourneyResponse]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM journeys ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return get_journey(row["id"])


def add_passenger(passenger: PassengerCreate, journey_id: Optional[int] = None) -> PassengerResponse:
    conn = get_db_connection()
    cursor = conn.cursor()

    # If journey_id is not specified, associate with the latest journey
    if journey_id is None:
        cursor.execute("SELECT id FROM journeys ORDER BY id DESC LIMIT 1")
        latest = cursor.fetchone()
        if latest:
            journey_id = latest["id"]

    cursor.execute("""
        INSERT INTO passengers (journey_id, name, age, gender, berth_preference, meal_preference, senior_citizen_opt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        journey_id,
        passenger.name,
        passenger.age,
        passenger.gender.value,
        passenger.berth_preference.value,
        passenger.meal_preference.value,
        1 if passenger.senior_citizen_opt else 0
    ))
    passenger_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return PassengerResponse(
        id=passenger_id,
        journey_id=journey_id,
        name=passenger.name,
        age=passenger.age,
        gender=passenger.gender,
        berth_preference=passenger.berth_preference,
        meal_preference=passenger.meal_preference,
        senior_citizen_opt=passenger.senior_citizen_opt
    )


def list_passengers(journey_id: Optional[int] = None) -> List[PassengerResponse]:
    conn = get_db_connection()
    cursor = conn.cursor()

    if journey_id is not None:
        cursor.execute("SELECT * FROM passengers WHERE journey_id = ?", (journey_id,))
    else:
        # Fetch passengers for the latest journey, or all unattached
        cursor.execute("SELECT id FROM journeys ORDER BY id DESC LIMIT 1")
        latest = cursor.fetchone()
        if latest:
            cursor.execute("SELECT * FROM passengers WHERE journey_id = ? OR journey_id IS NULL", (latest["id"],))
        else:
            cursor.execute("SELECT * FROM passengers")

    rows = cursor.fetchall()
    conn.close()

    return [
        PassengerResponse(
            id=p["id"],
            journey_id=p["journey_id"],
            name=p["name"],
            age=p["age"],
            gender=Gender(p["gender"]),
            berth_preference=BerthPreference(p["berth_preference"]),
            meal_preference=MealPreference(p["meal_preference"]),
            senior_citizen_opt=bool(p["senior_citizen_opt"])
        )
        for p in rows
    ]


def delete_passenger(passenger_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM passengers WHERE id = ?", (passenger_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def clear_passengers(journey_id: Optional[int] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if journey_id:
        cursor.execute("DELETE FROM passengers WHERE journey_id = ?", (journey_id,))
    else:
        cursor.execute("DELETE FROM passengers")
    conn.commit()
    conn.close()


def get_checklist() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT item_key, item_text, checked FROM checklist ORDER BY rowid ASC")
    rows = cursor.fetchall()
    conn.close()
    return [{"item_key": r["item_key"], "item_text": r["item_text"], "checked": bool(r["checked"])} for r in rows]


def update_checklist_item(item_key: str, checked: bool) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE checklist SET checked = ? WHERE item_key = ?", (1 if checked else 0, item_key))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated


def reset_checklist():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE checklist SET checked = 0")
    conn.commit()
    conn.close()
