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
    MealPreference,
    SearchHistoryCreate,
    SearchHistoryItem,
    AlertCreate,
    AlertItem
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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        train_number TEXT,
        train_name TEXT,
        from_station TEXT NOT NULL,
        to_station TEXT NOT NULL,
        journey_date TEXT,
        searched_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL,
        train_number TEXT,
        train_name TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        trigger_time TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
    );
    """)

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


# ================= SEARCH HISTORY =================
def add_search_history(item: SearchHistoryCreate) -> SearchHistoryItem:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    # Deduplicate: check if identical from/to exists recently and update timestamp
    cursor.execute("""
        SELECT id FROM search_history
        WHERE from_station = ? AND to_station = ?
        ORDER BY id DESC LIMIT 1
    """, (item.from_station, item.to_station))
    existing = cursor.fetchone()

    if existing:
        cursor.execute("""
            UPDATE search_history
            SET searched_at = ?, train_number = ?, train_name = ?, journey_date = ?
            WHERE id = ?
        """, (now_str, item.train_number, item.train_name, item.journey_date, existing["id"]))
        rec_id = existing["id"]
    else:
        cursor.execute("""
            INSERT INTO search_history (train_number, train_name, from_station, to_station, journey_date, searched_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (item.train_number, item.train_name, item.from_station, item.to_station, item.journey_date, now_str))
        rec_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return SearchHistoryItem(
        id=rec_id,
        train_number=item.train_number,
        train_name=item.train_name,
        from_station=item.from_station,
        to_station=item.to_station,
        journey_date=item.journey_date,
        searched_at=now_str
    )


def get_search_history(limit: int = 30) -> List[SearchHistoryItem]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM search_history ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [
        SearchHistoryItem(
            id=r["id"],
            train_number=r["train_number"],
            train_name=r["train_name"],
            from_station=r["from_station"],
            to_station=r["to_station"],
            journey_date=r["journey_date"],
            searched_at=r["searched_at"]
        ) for r in rows
    ]


def delete_search_history_item(item_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM search_history WHERE id = ?", (item_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def clear_search_history() -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM search_history")
    conn.commit()
    conn.close()
    return True


# ================= ALERTS =================
def add_alert(alert: AlertCreate) -> AlertItem:
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO alerts (alert_type, train_number, train_name, title, message, trigger_time, enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        alert.alert_type,
        alert.train_number,
        alert.train_name,
        alert.title,
        alert.message,
        alert.trigger_time,
        1 if alert.enabled else 0,
        now_str
    ))
    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return AlertItem(
        id=alert_id,
        alert_type=alert.alert_type,
        train_number=alert.train_number,
        train_name=alert.train_name,
        title=alert.title,
        message=alert.message,
        trigger_time=alert.trigger_time,
        enabled=alert.enabled,
        created_at=now_str
    )


def get_alerts() -> List[AlertItem]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [
        AlertItem(
            id=r["id"],
            alert_type=r["alert_type"],
            train_number=r["train_number"],
            train_name=r["train_name"],
            title=r["title"],
            message=r["message"],
            trigger_time=r["trigger_time"],
            enabled=bool(r["enabled"]),
            created_at=r["created_at"]
        ) for r in rows
    ]


def delete_alert(alert_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def toggle_alert(alert_id: int, enabled: Optional[bool] = None) -> Optional[AlertItem]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    new_val = (1 if enabled else 0) if enabled is not None else (0 if row["enabled"] else 1)
    cursor.execute("UPDATE alerts SET enabled = ? WHERE id = ?", (new_val, alert_id))
    conn.commit()

    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    updated_row = cursor.fetchone()
    conn.close()

    return AlertItem(
        id=updated_row["id"],
        alert_type=updated_row["alert_type"],
        train_number=updated_row["train_number"],
        train_name=updated_row["train_name"],
        title=updated_row["title"],
        message=updated_row["message"],
        trigger_time=updated_row["trigger_time"],
        enabled=bool(updated_row["enabled"]),
        created_at=updated_row["created_at"]
    )

