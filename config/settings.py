import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
FRONTEND_DIR = BASE_DIR / "frontend"

# Ensure storage directory exists
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Database file path
DB_PATH = STORAGE_DIR / "tatkal_assistant.db"

# Local Server Configuration
HOST = "127.0.0.1"  # Strict localhost binding
PORT = 8000

# Tatkal Time Rules (Indian Standard Time: UTC+05:30)
TIMEZONE_NAME = "Asia/Kolkata"
AC_TATKAL_HOUR = 10     # 10:00 AM IST
NON_AC_TATKAL_HOUR = 11  # 11:00 AM IST
TATKAL_ADVANCE_DAYS = 1 # 1 day prior to journey date from train origin
MAX_PASSENGERS_TATKAL = 4 # Maximum passengers permitted per Tatkal PNR
