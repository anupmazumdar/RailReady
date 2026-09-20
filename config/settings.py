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

# Train Information Data Provider Configuration
# Options: 'MOCK', 'AUTHORIZED'
TRAIN_DATA_PROVIDER = os.getenv("TRAIN_DATA_PROVIDER", "MOCK")
CACHE_TTL_STATUS_SECONDS = 300   # 5 minutes for live running status
CACHE_TTL_ROUTE_SECONDS = 86400  # 24 hours for train routes
REQUEST_TIMEOUT_SECONDS = 8.0    # 8.0s timeout for external providers
