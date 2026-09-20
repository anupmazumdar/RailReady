# DATA SOURCES & THIRD-PARTY INTEGRATION POLICY

## 1. Third-Party Data Sources

> **"RailReady is independently developed and is not affiliated with IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways."**

This document details the operational evaluation of external reference services, data licensing terms, anti-scraping compliance rules, and RailReady's architectural policy regarding train schedule and running status data.

---

## 2. Evaluation of Reference Services

### A. trainrunningstatus.org
* **Source URL**: `https://trainrunningstatus.org/`
* **Official API Availability**: None published or publicly documented for third-party automated access.
* **Terms of Service & Robot Policy**:
  * Prohibits automated harvesting, scraping, crawling, and unauthorized bulk data extraction.
  * Disallows commercial redistribution, framing, or automated queries without explicit consent.
* **RailReady Policy**:
  * **Reference Example Only**: RailReady will **NOT** scrape, crawl, reverse-engineer, or query `trainrunningstatus.org`.
  * Used solely as a functional reference for the categories of information (e.g. station halt duration, delay metrics, platform estimates) that an end-user needs during journey planning.

### B. whereismytrain.org.in / Where Is My Train
* **Source URL**: `https://whereismytrain.org.in/`
* **Official API Availability**: Proprietary consumer application. No public third-party REST API or developer program is provided.
* **Terms of Service & Copyright**:
  * Protected under intellectual property laws.
  * Explicit prohibition against copying UI assets, reverse engineering private internal communication, or bypassing mobile/web endpoints.
* **RailReady Policy**:
  * **Reference Example Only**: RailReady will **NOT** decompile, sniff network traffic, scrape, or extract internal data from Where Is My Train.
  * RailReady uses a completely original UI design built on its own glassmorphic design system.

---

## 3. RailReady Provider Abstraction Architecture

To decouple the application from any single data provider and guarantee zero legal or security exposure, RailReady implements an abstract provider interface:

```
+-------------------------------------------------------------+
|                      RAILREADY CORE                         |
|   (UI, Journey Planner, Tatkal Prep, Route Timeline)        |
+------------------------------+------------------------------+
                               |
                               v
               +-------------------------------+
               |    TrainDataProvider (ABC)    |
               | - search_trains()             |
               | - get_train_details()         |
               | - get_train_route()           |
               | - get_running_status()        |
               +---------------+---------------+
                               |
        +----------------------+----------------------+
        |                                             |
        v                                             v
+-------------------------------+             +-------------------------------+
|     MockTrainDataProvider     |             |    AuthorizedTrainProvider    |
| (Default Development/Testing) |             |  (Licensed B2B / CRIS Feed)   |
| - 100% Offline Simulation     |             | - Plugged via config / env    |
| - Zero network dependency     |             | - Requires commercial API key |
| - High-fidelity corridors     |             | - Respects rate limits / TTL  |
+-------------------------------+             +-------------------------------+
```

### Registered Providers:

| Provider Name | Type | Status | License / Terms | Attribution / Notice |
|---|---|---|---|---|
| **MockTrainDataProvider** | Offline Mock | **Active (Default)** | Open Source (RailReady MIT/Apache) | "Offline high-fidelity schedule and status simulation." |
| **AuthorizedTrainProvider** | Licensed Feed | Inactive (Stub) | Commercial / Authorized B2B API | Displays official provider attribution as required by vendor. |

---

## 4. Operational Requirements for External Providers

If an authorized B2B provider API (e.g. official CRIS or licensed commercial data vendor) is configured via environment variables:

1. **Caching & TTL**:
   * Timetables and station sequences must be cached locally for at least **24 hours** (`CACHE_TTL_ROUTE_SECONDS = 86400`).
   * Live running status must be cached for a minimum of **3 to 5 minutes** (`CACHE_TTL_STATUS_SECONDS = 300`) to prevent excessive querying.
2. **Rate Limiting & Timeouts**:
   * Requests must timeout after a maximum of **8.0 seconds** (`PROVIDER_TIMEOUT_SECONDS = 8.0`).
   * No aggressive automated retry loops. Exponential backoff with a maximum of 2 retries.
3. **Graceful Fallback**:
   * If an external provider is unreachable or returns HTTP errors, the system must seamlessly fall back to cached data or the offline timetable provider without crashing.
4. **Data Accuracy Banner**:
   * Every live status response must clearly state:
     > *"Last updated: <timestamp> — Data may be delayed or unavailable. Verify critical travel information through official railway sources."*
5. **Zero Passenger Data Egress**:
   * Passenger names, ages, or travel records must **NEVER** be sent to train data providers. Only train numbers, dates, and station codes are queried.
