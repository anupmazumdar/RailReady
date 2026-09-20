# SYSTEM ARCHITECTURE: LOCAL TATKAL PREPARATION ASSISTANT

## 1. High-Level Architectural Diagram

```
+-------------------------------------------------------------------------+
|                              LOCAL HOST ONLY                            |
|                                                                         |
|  +------------------------+             +----------------------------+  |
|  |       FRONTEND         |  HTTP/JSON  |          BACKEND           |  |
|  |   (HTML5, CSS3, JS)    |<----------->|      (FastAPI, Python)     |  |
|  | - Journey Form         |             | - REST API Endpoints       |  |
|  | - Passenger Manager    |             | - Request Validation       |  |
|  | - Live Countdown Timer |             | - Security Guardrails      |  |
|  | - Pre-Booking Checklist|             +--------------+-------------+  |
|  | - Clipboard Helper     |                            |                |
|  | - Offline Stations     |                            |                |
|  +------------------------+             +--------------v-------------+  |
|                                         |       STORAGE LAYER        |  |
|                                         |   (SQLite / Local DB)      |  |
|                                         | - Journey Plans            |  |
|                                         | - Prepared Passengers      |  |
|                                         | - Checklist Progress       |  |
|                                         +----------------------------+  |
+-------------------------------------------------------------------------+
                                    ||
                 ABSOLUTE AIR GAP / ZERO CONNECTION
                                    ||
+-------------------------------------------------------------------------+
|                           EXTERNAL SYSTEMS                              |
|                                                                         |
|           Official IRCTC Portal (https://www.irctc.co.in)               |
|      [Operated strictly and manually by the human user in their         |
|                       own personal web browser]                         |
+-------------------------------------------------------------------------+
```

## 2. Component Boundaries & Ownership

| Component | Directory | Owner | Responsibilities |
|---|---|---|---|
| **Architecture & Governance** | `docs/`, root | Agent 1 (Architect) | Contracts, boundaries, Tatkal opening rules |
| **Backend & Routing** | `backend/`, `utils/`, `notifications/` | Agent 2 (Backend) | Opening calculation, clipboard stringify, API handlers |
| **Frontend & UI** | `frontend/` | Agent 3 (Frontend) | Glassmorphic UI, live timer, clipboard interactions |
| **Storage & Infrastructure** | `storage/`, `config/`, root | Agent 4 (Database) | SQLite schemas, persistence, local launcher |
| **Security & Guardrails** | `security/` | Agent 5 (Security) | Zero-credential validator, anti-malware verification |
| **QA & Verification** | `tests/` | Agent 6 (QA) | Test suite, timezone tests, validation tests |

## 3. Data Flow & State Transitions

1. **Journey Configuration**:
   - User inputs Source (`from_station`), Destination (`to_station`), `journey_date`, `preferred_train`, `preferred_class`, and `tatkal_type` (`AC` vs `NON_AC`).
   - Backend calculates `expected_opening_time` in Asia/Kolkata (IST) timezone.
     - AC Tatkal: `Journey Date - 1 day` at `10:00:00 IST`.
     - Non-AC Tatkal: `Journey Date - 1 day` at `11:00:00 IST`.
   - Data is stored in local SQLite database.

2. **Passenger Preparation**:
   - Up to 4 passengers (Tatkal max).
   - Validated: `name` (1-16 chars), `age` (1-125), `gender` (`M`/`F`/`T`), `berth_preference`, `meal_preference`.
   - Copied to clipboard on user demand. Never transmitted externally.

3. **Countdown & Reminders**:
   - Client calculates remaining milliseconds against `expected_opening_time`.
   - Alerts user at milestones: 15m, 5m, 1m, 0m.
   - At 0m: "Tatkal booking window should now be open. Please open/use IRCTC manually."

4. **Booking Checklist**:
   - User marks pre-requisite preparation steps.
   - Persisted locally across page refreshes.
