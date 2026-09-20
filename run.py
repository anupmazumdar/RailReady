import sys
import uvicorn
from storage.db import init_db
from config.settings import HOST, PORT

def main():
    print("=================================================================")
    print("      LOCAL TATKAL BOOKING PREPARATION ASSISTANT                 ")
    print("=================================================================")
    print("  [COMPLIANCE NOTICE]                                            ")
    print("  This application is an offline personal organizer.             ")
    print("  It does NOT automate, scrape, or connect to IRCTC.             ")
    print("  All bookings must be performed manually by you on the official ")
    print("  IRCTC website (https://www.irctc.co.in).                       ")
    print("=================================================================")
    
    print("[1/2] Initializing local database...")
    init_db()
    print(f"[2/2] Starting local web server on http://{HOST}:{PORT} ...")
    print(f"Open your browser to: http://{HOST}:{PORT}\n")

    uvicorn.run("backend.app:app", host=HOST, port=PORT, reload=False, log_level="info")

if __name__ == "__main__":
    main()
