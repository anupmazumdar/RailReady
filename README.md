# Tatkal Booking Preparation Assistant

A local, offline-first personal assistant for organizing travel details, managing passenger records, tracking Tatkal opening countdowns, and providing reminder notifications before manually booking on the official IRCTC portal.

---

## 🛡️ Statutory & Legal Compliance Notice

> **IMPORTANT**: This application operates with an **absolute air gap** from the live IRCTC reservation system.
> - **NO** connection, scraping, or automation of IRCTC (`irctc.co.in`).
> - **NO** Playwright, Selenium, Puppeteer, or browser automation libraries.
> - **NO** CAPTCHA solving or detection.
> - **NO** credential, OTP, CVV, or PIN storage.
> - In full compliance with **Section 143 of the Indian Railways Act, 1989** and **Section 43 & 66 of the Information Technology Act, 2000**.
> - The user is solely responsible for manually opening the official IRCTC portal and completing their own booking.

---

## 🚀 Features

1. **Journey Planner**:
   - Source & Destination station selection with built-in offline autocompletion.
   - Calculates the exact Tatkal opening window based on journey date and quota type:
     - **AC Classes (1A, 2A, 3A, 3E, CC, EC)**: Opens at **10:00:00 AM IST** on the day prior to journey date from train origin.
     - **Non-AC Classes (SL, 2S)**: Opens at **11:00:00 AM IST** on the day prior to journey date from train origin.
   - Clearly labeled: *"Expected opening time — verify current IRCTC rules before booking."*

2. **Passenger Preparation**:
   - Manage up to 4 passengers (official Indian Railways Tatkal quota limit).
   - Validates name (max 16 characters), age (1-125), gender, berth preference, and meal options.
   - **One-Click Quick Copy**:
     - Bulk copy formatted summary for rapid reference.
     - Individual field copy buttons (Name, Age) for swift manual entry.

3. **Live Countdown & Reminders**:
   - Real-time precision countdown in `Days : Hours : Mins : Secs`.
   - Visual badges: `UPCOMING`, `OPENING SOON` (within 15 mins), `WINDOW OPEN`.
   - Audio chime and local browser notifications at key milestones: 15m, 10m, 5m, 1m, and 0m.
   - Opening notification: *"Tatkal booking window should now be open. Please open/use IRCTC manually."*

4. **Pre-Booking Readiness Checklist**:
   - Interactive 8-point checklist covering credentials, payment methods, and train verification.
   - Saved locally to SQLite database and persisted across refreshes.

5. **Manual IRCTC Access Guide**:
   - Dedicated modal showing the official IRCTC URL (`https://www.irctc.co.in/`) with a "Copy Link" utility.
   - Explicit instructions on how to manually log in and book safely.

6. **100% Offline & Private**:
   - All data saved locally on your computer in `storage/tatkal_assistant.db`.
   - Zero telemetry, zero analytics, zero external network requests.

---

## 💻 Prerequisites & Installation

- **Python 3.10+**

```bash
# Clone or navigate to the directory
cd d:/Tatkal

# Install dependencies (FastAPI, Uvicorn, Pydantic, Pytest)
pip install -r requirements.txt
```

---

## 🏃 Running the Application

Start the local server with one command:

```bash
python run.py
```

Then open your browser to:
```
http://127.0.0.1:8000
```

---

## 🧪 Running Automated Tests

A comprehensive test suite covers time calculations, timezone handling, passenger validation, local SQLite persistence, and security boundaries:

```bash
pytest -v tests/
```

---

## 📂 Project Architecture

```
d:/Tatkal/
├── backend/
│   ├── __init__.py
│   ├── app.py                 # FastAPI application & static asset mounting
│   └── routes.py              # REST API endpoints (journey, passengers, checklist)
├── frontend/
│   ├── index.html             # Dashboard interface
│   ├── css/
│   │   └── styles.css         # Glassmorphism dark-mode styles
│   └── js/
│       ├── app.js             # UI controller & countdown engine
│       └── stations.js        # Offline railway station directory
├── storage/
│   ├── __init__.py
│   ├── db.py                  # Local SQLite database manager
│   └── models.py              # Pydantic models & validation schemas
├── notifications/
│   ├── __init__.py
│   └── service.py             # Milestone alert configurations
├── utils/
│   ├── __init__.py
│   ├── time_calc.py           # Tatkal opening time & IST calculation
│   └── clipboard.py           # Clipboard formatting engine
├── security/
│   ├── __init__.py
│   └── validator.py           # Strict zero-credential inspection engine
├── tests/
│   ├── __init__.py
│   ├── test_time_calc.py
│   ├── test_passenger_validation.py
│   ├── test_clipboard.py
│   ├── test_storage.py
│   └── test_security_boundaries.py
├── docs/
│   └── architecture.md        # Detailed system design
├── config/
│   ├── __init__.py
│   └── settings.py            # Local configuration
├── run.py                     # One-click launcher
├── README.md
├── SECURITY.md
├── PRIVACY.md
├── COMPLIANCE.md
└── requirements.txt
```

---

## ⚖️ License & Disclaimer

This software is for personal educational and preparation use only. It is not affiliated with, endorsed by, or sponsored by the Indian Railway Catering and Tourism Corporation (IRCTC) or the Ministry of Railways, Government of India.
