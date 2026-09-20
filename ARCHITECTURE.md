# SYSTEM ARCHITECTURE: RAILREADY PLATFORM

## 1. High-Level Architectural Diagram

```
+--------------------------------------------------------------------------------------------------+
|                                          LOCAL ENVIRONMENT                                       |
|                                                                                                  |
|  +-------------------------------------+             +----------------------------------------+  |
|  |             FRONTEND                |  HTTP/JSON  |               BACKEND                  |  |
|  |        (HTML5, CSS3, JS SPA)        |<----------->|           (FastAPI, Python)            |  |
|  |                                     |             |                                        |  |
|  | - View 1: Dashboard                 |             |  CORE REST APIS:                       |  |
|  | - View 2: Train Search              |             |  - /api/journey                        |  |
|  | - View 3: Train Details             |             |  - /api/passengers                     |  |
|  | - View 4: Running Status            |             |  - /api/checklist                      |  |
|  | - View 5: Route Timeline            |             |  - /api/status                         |  |
|  | - View 6: Coach Layout              |             |  - /api/stations/search                |  |
|  | - View 7: PNR Status Enquiry        |             |  - /api/pnr/{pnr}                      |  |
|  | - View 8: Tickets & Saved Bookings  |             |  - /api/history                        |  |
|  | - View 9: Search History            |             |  - /api/alerts                         |  |
|  | - View 10: Journey Planner          |             |                                        |  |
|  |   (Primary, Alt 1, Alt 2)           |             |  TRAIN INFO & STATUS MODULE:           |  |
|  | - View 11: Tatkal Preparation       |             |  - /api/trains/search                  |  |
|  | - View 12: Passenger Details        |             |  - /api/trains/{train_number}          |  |
|  | - View 13: Split Routes             |             |  - /api/trains/{train_number}/route    |  |
|  | - View 14: Notifications & Alerts   |             |  - /api/trains/{train_number}/status   |  |
|  | - View 15: Settings & Theme         |             |  - /api/trains/{train_number}/coaches  |  |
|  +-------------------------------------+             +-------------------+--------------------+  |
|                                                                          |                       |
|                                                                          v                       |
|                                                      +-------------------+--------------------+  |
|                                                      |         TRAIN DATA PROVIDER LAYER      |  |
|                                                      |         TrainDataProvider (ABC)        |  |
|                                                      +-------------------+--------------------+  |
|                                                                          |                       |
|                                                  +-----------------------+--------------------+  |
|                                                  |                                            |  |
|                                                  v                                            v  |
|                                  +-------------------------------+            +-------------------------------+
|                                  |     MockTrainDataProvider     |            |    AuthorizedTrainProvider    |
|                                  |   (Default / 100% Offline)    |            |  (Licensed B2B / CRIS API)    |
|                                  | - Built-in realistic data     |            | - Configured via ENV          |
|                                  | - Zero network egress         |            | - Strict rate limits & TTL    |
|                                  +-------------------------------+            +-------------------------------+
|                                                                                                  |
|  +-------------------------------------+                                                         |
|  |           STORAGE LAYER             |                                                         |
|  |        (SQLite / Local DB)          |<--------------------------------------------------------+
|  | - Journey Plans (Primary + Alt 1/2) |
|  | - Prepared Passengers (Max 4)       |
|  | - Checklist Progress (8 Points)     |
|  | - Search History (Recent Queries)   |
|  | - Alerts & Reminders                |
|  +-------------------------------------+
+--------------------------------------------------------------------------------------------------+
                                                ||
                               ABSOLUTE AIR GAP / ZERO AUTOMATION
                                                ||
+--------------------------------------------------------------------------------------------------+
|                                       EXTERNAL SYSTEMS                                           |
|                                                                                                  |
|                    Official IRCTC Portal (https://www.irctc.co.in)                               |
|          [Operated strictly and manually by the human user in their own web browser]             |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Third-Party Data Sources

> **"RailReady is independently developed and is not affiliated with IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways."**

### External Source Classification:

1. **Reference Sources (Non-Integrated, Prohibited from Direct Scraping)**:
   * **`https://trainrunningstatus.org/`**: Serves solely as a functional reference for the categories of information useful to passengers (station sequence, halt duration, delay metrics, platform estimates). RailReady does **NOT** scrape, crawl, reverse-engineer, or query this portal.
   * **`https://whereismytrain.org.in/`**: Serves solely as a conceptual reference for train search ergonomics and route milestone visualization. RailReady does **NOT** scrape, reverse-engineer private endpoints, or decompile any associated mobile applications.
   * All UI layouts, styling, icons, and components in RailReady are completely original and follow RailReady's design tokens.

2. **Authorized Data Sources**:
   * **`MockTrainDataProvider` (Active / Default)**: A high-fidelity, local in-memory simulation engine for Indian Railways schedules, running statuses, platforms, and delay calculations. Guarantees 100% offline availability, zero legal risk, and complete data privacy.
   * **`AuthorizedTrainProvider` (Pluggable)**: Standardized provider contract ready for integration with official government APIs (CRIS/NTES B2B enterprise feeds) or authorized licensed third-party data partners, activated strictly when lawful commercial terms and API keys are configured.

---

## 3. Component Boundaries & Ownership

| Component | Directory | Owner | Responsibilities |
|---|---|---|---|
| **Architecture & Governance** | `docs/`, root | Agent 1 (Architect) | Contracts, boundaries, Tatkal rules, DATA_SOURCES policy |
| **Train Info & Providers** | `backend/train_info/` | Agent 2 (Backend) | Provider abstraction, Mock provider, route timeline, live status |
| **Backend & Routing** | `backend/`, `utils/`, `notifications/` | Agent 2 (Backend) | Opening calculation, clipboard stringify, API handlers |
| **Frontend & UI** | `frontend/` | Agent 3 (Frontend) | 10-view SPA, Train Search, Live Timeline, Tatkal prep, styles |
| **Storage & Infrastructure** | `storage/`, `config/`, root | Agent 4 (Database) | SQLite schemas, alternate trains persistence, local launcher |
| **Security & Guardrails** | `security/` | Agent 5 (Security) | Zero-credential validator, anti-malware, cache security |
| **QA & Verification** | `tests/`, `backend/train_info/tests/` | Agent 6 (QA) | 39 test suite, provider tests, route parsing, regression |

---

## 4. Multi-Train Journey Planning Architecture

To assist travelers during high-demand booking periods where seats vanish rapidly, RailReady supports a multi-train contingency model:
* **Primary Train**: Preferred journey choice.
* **Alternative Train 1**: First contingency option (e.g. adjacent departure time or alternate route).
* **Alternative Train 2**: Second contingency option.

Each slot stores:
* Train Number & Train Name
* Source & Destination Stations
* Departure & Arrival Timings
* Journey Duration & Class Availability

Users can inspect live status and route timelines for any of these 3 trains independently and seamlessly switch between them during pre-booking preparation.

---

## 5. Caching, Reliability & Data Freshness

* **Timetable & Route Caching**: Static schedules and station halt sequences are cached in-memory for **24 hours** (`CACHE_TTL_ROUTE_SECONDS = 86400`).
* **Live Running Status Caching**: Real-time status queries are cached for **5 minutes** (`CACHE_TTL_STATUS_SECONDS = 300`) with a 15-minute stale-data fallback grace period.
* **Rate Limiting & Safety**: All network requests to external authorized providers are capped with an **8.0s timeout** (`PROVIDER_TIMEOUT_SECONDS = 8.0`) and non-aggressive exponential backoff (max 2 retries).
* **Statutory Notice Requirement**: Every live status response contains:
  > *"Last updated: <timestamp> — Data may be delayed or unavailable. Verify critical travel information through official railway sources."*
