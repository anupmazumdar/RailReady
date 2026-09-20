# RailReady — Railway Journey, Train Information & Tatkal Assistant

RailReady is a comprehensive, offline-first personal railway assistant designed for Indian railway travelers. It provides train search, station-by-station route timelines, live running status simulation, multi-train journey planning (Primary + Alternative trains), passenger management with instant clipboard helpers, and Tatkal quota countdowns with local audio/browser notifications.

---

## 🛡️ Third-Party Data Sources & Statutory Disclaimers

> **"RailReady is independently developed and is not affiliated with IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways."**

### External Source Classification & Policy:

1. **Reference Sources (Strictly NOT Queried or Scraped)**:
   * **`https://trainrunningstatus.org/`**: Reference example only for functional information concepts (station sequence, halt duration, delay metrics, platform estimates). RailReady does **NOT** scrape, crawl, reverse-engineer, or query this portal.
   * **`https://whereismytrain.org.in/`**: Reference example only for search workflows and milestone tracking concepts. RailReady does **NOT** scrape, decompile, reverse-engineer, or access its internal application endpoints.
   * All RailReady interfaces, CSS, and styling are original implementations built upon RailReady's proprietary glassmorphic design system.

2. **Authorized Data Sources**:
   * **`MockTrainDataProvider` (Default / Active)**: Built-in, high-fidelity offline simulation engine covering major Indian Railway corridors, train routes, timetables, and delay metrics. Operates with zero network dependency, ensuring 100% privacy and legal compliance.
   * **`AuthorizedTrainProvider` (Pluggable)**: Architecture interface ready for officially licensed, commercial B2B, or authorized public railway data feeds. Configured purely through environment variables without altering UI or business logic.

---

## ⚡ Core Compliance Guarantees

* **Absolute IRCTC Air Gap**: RailReady does **NOT** interact with, automate, or scrape `irctc.co.in`.
* **Zero Autonomous Actions**: No automated login, no CAPTCHA solving, no OTP reading, and no payment processing.
* **Zero Credential Collection**: Passwords, OTPs, UPI PINs, CVVs, and banking secrets are strictly rejected at the API boundary and never stored.
* **Full Regulatory Compliance**: In strict compliance with **Section 143 of the Indian Railways Act, 1989** and **Sections 43 & 66 of the Information Technology Act, 2000**.
* **Human-in-the-Loop Mandate**: All ticket reservations, CAPTCHA inputs, and payments must be completed manually by the user on the official IRCTC portal.

---

## 🚀 Key Features

### 1. Train Search & Timetables (`/train-search`)
* Search trains by 5-digit train number, train name, or station pair (e.g. `NDLS` to `BCT`).
* Comprehensive train cards displaying departure/arrival times, duration, running days, class availability, and train type (Rajdhani, Shatabdi, Vande Bharat, Superfast, Mail/Express).
* One-click direct assignment to **Primary Train**, **Alternative Train 1**, or **Alternative Train 2** in the Journey Planner.

### 2. Station Route Timelines (`/route`)
* Interactive station progression tree showing complete halt sequences from origin to destination.
* Detailed timetable metrics: scheduled arrival, scheduled departure, halt duration (mins), distance, day of journey, and estimated platform number.

### 3. Live Running Status (`/running-status`)
* Dynamic station-by-station tracking with delay calculation, current location, previous station departed, next station upcoming, and estimated timings.
* Statutory accuracy notice on every live tracking query:
  > *"Last updated: <timestamp> — Data may be delayed or unavailable. Verify critical travel information through official railway sources."*

### 4. Detailed Train Overview (`/train-details`)
* Comprehensive train dashboard consolidating basic specifications, rake composition, running days, route timeline, and live status.

### 5. Multi-Train Journey Planner (`/journey-planner`)
* Configure origin, destination, journey date, and preferred class.
* Multi-slot train tracking: Save a **Primary Train** plus **Alternative Train 1** and **Alternative Train 2** to prepare contingency options for peak travel rush.
* Split-route discovery for finding connecting trains via intermediate railway junctions.

### 6. Tatkal Preparation & Opening Countdown (`/tatkal-prep`)
* Precise Tatkal opening window calculation:
  * **AC Classes (1A, 2A, 3A, 3E, CC, EC)**: Opens at **10:00:00 AM IST** on the day prior to departure from origin.
  * **Non-AC Classes (SL, 2S)**: Opens at **11:00:00 AM IST** on the day prior to departure from origin.
* Live countdown in `Days : Hours : Mins : Secs` with visual states (`UPCOMING`, `OPENING SOON`, `WINDOW OPEN`).
* Interactive 8-point pre-booking checklist persisted locally in SQLite.

### 7. Passenger Preparation & Quick Clipboard (`/passengers`)
* Manage up to 4 passengers (official IRCTC Tatkal quota limit).
* Validates name (letters only, max 16 chars), age (1-125), gender, berth preference, and meal choice.
* One-click bulk copy or individual field copy for rapid manual entry into official booking forms.

### 8. Local Milestone Alerts & Notifications (`/notifications`)
* Audio chime milestones (15m, 10m, 5m, 1m, and 0m) synthesized locally via Web Audio API.
* Browser desktop push notifications when minimized or working in another tab.

### 9. Settings & Data Governance (`/settings`)
* Inspect active train data provider (`MockTrainDataProvider` vs `AuthorizedTrainProvider`).
* View statutory declarations, data safety guarantees, and clear local SQLite database storage.

---

## 💻 Prerequisites & Installation

* **Python 3.10+** (Tested on Python 3.10, 3.11, 3.12, 3.13, 3.14)

```bash
# Clone the repository
git clone https://github.com/anupmazumdar/RailReady.git
cd RailReady

# Install dependencies (FastAPI, Uvicorn, Pydantic, Pytest)
pip install -r requirements.txt
```

---

## 🏃 Running RailReady

Launch the application with the one-click runner:

```bash
python run.py
```

Then open your browser at:
```
http://127.0.0.1:8000
```

---

## 🧪 Running Automated Tests

RailReady includes a comprehensive test suite of 39 automated tests covering provider abstractions, route parsing, delay calculations, cache TTL, journey persistence, time calculations, and security boundaries:

```bash
python -m pytest -v backend/train_info/tests/ tests/
```

---

## 📂 Project Structure

```
RailReady/
├── backend/
│   ├── app.py                     # FastAPI application & static route mounting
│   ├── routes.py                  # Core REST API (journey, passengers, checklist)
│   └── train_info/                # Train Information & Running Status Module
│       ├── models/                # Domain models
│       ├── schemas/               # Pydantic validation schemas
│       ├── providers/             # TrainDataProvider abstraction & mock/authorized implementations
│       │   ├── base.py            # Abstract Base Class (TrainDataProvider)
│       │   ├── mock_provider.py   # High-fidelity offline simulation provider
│       │   └── factory.py         # Provider factory & config resolution
│       ├── services/              # Business logic & in-memory TTL caching
│       │   ├── cache_service.py   # TTL cache with stale-data grace periods
│       │   └── train_service.py   # Query coordination & input sanitization
│       ├── routes/                # Train info endpoints (/api/trains/search, /{num}, /route, /status)
│       └── tests/                 # Dedicated unit & integration tests
├── config/
│   ├── __init__.py
│   └── settings.py                # Provider selection, cache TTLs, timeouts
├── docs/
│   ├── architecture.md            # Architectural design specifications
│   ├── DATA_SOURCES.md            # Third-party data sources & legal terms evaluation
│   └── connecting_pnr_rules.md    # Connecting PNR guidelines
├── frontend/
│   ├── index.html                 # 10-view glassmorphism interface
│   ├── css/
│   │   └── styles.css             # Glassmorphism dark-mode styles, timeline & meters
│   └── js/
│       ├── app.js                 # Unified SPA controller & tab navigator
│       └── stations.js            # Offline railway station directory
├── notifications/
│   └── service.py                 # Milestone chime & alert definitions
├── security/
│   └── validator.py               # Zero-credential inspection & anti-bot boundary
├── storage/
│   ├── db.py                      # SQLite manager with automatic schema migration
│   └── models.py                  # Journey & Passenger models (primary + alt trains)
├── utils/
│   ├── time_calc.py               # Tatkal window & timezone calculation engine
│   └── clipboard.py               # Formatting helper for manual copy-paste
├── tests/                         # Integration, security, and storage tests
├── run.py                         # Single-command launcher
├── ARCHITECTURE.md                # System architecture documentation
├── COMPLIANCE.md                  # Statutory compliance document
├── SECURITY.md                    # Security policy & threat model
├── PRIVACY.md                     # Privacy statement & data minimization
└── requirements.txt               # Project dependencies
```

---

## ⚖️ License & Statutory Disclaimer

RailReady is open-source software licensed for personal, educational, and preparation purposes. It is **NOT** affiliated with, endorsed by, or sponsored by IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways.
