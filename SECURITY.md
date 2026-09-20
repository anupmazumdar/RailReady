# SECURITY POLICY & ARCHITECTURE: RAILREADY PLATFORM

## 1. Zero-Trust Security Philosophy

RailReady is engineered around a core principle: **Complete isolation from sensitive credentials, external scraping, and unauthorized automated actions**.

### Core Guarantees:
1. **Zero Credential Collection**: The application will **NEVER** request, receive, or persist:
   - IRCTC login passwords or security questions
   - One-Time Passwords (OTPs)
   - UPI PINs or Net Banking passwords
   - Credit / Debit card numbers or CVVs
2. **Local Payload Inspection**: The `security/validator.py` middleware proactively inspects all inbound requests. Any attempt to supply fields matching credential patterns results in an immediate HTTP 400 rejection.
3. **Loopback Binding**: The backend exclusively binds to `127.0.0.1`. It does not listen on public interfaces (`0.0.0.0`), preventing unintended local network exposure.
4. **No External Network Egress**: The default configuration makes zero unauthorized outbound network requests.
5. **Provider Data Isolation**: Train Information and Running Status queries only transmit train numbers and station codes. Passenger details, travel profiles, and checklist states are never exposed or transmitted to any external data provider.

---

## 2. Third-Party Data Sources

> **"RailReady is independently developed and is not affiliated with IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways."**

### Data Source Classification:
* **Reference Examples (Strictly Non-Integrated & Not Scraped)**:
  * `https://trainrunningstatus.org/`: Used solely as an informational reference for timetable and halt concepts. RailReady does **NOT** scrape, crawl, or reverse-engineer this website.
  * `https://whereismytrain.org.in/`: Used solely as a conceptual reference for train search ergonomics. RailReady does **NOT** query private mobile or web backend APIs.
* **Authorized Sources**:
  * `MockTrainDataProvider` (Active / Default): Built-in offline high-fidelity simulator for Indian Railway routes, timetables, and running status. Operates 100% locally with zero external network connectivity.
  * `AuthorizedTrainProvider` (Pluggable): Standardized provider contract ready for connection to authorized, licensed commercial or CRIS/NTES enterprise data feeds when legally established.

---

## 3. Threat Model

| Threat | Risk Level | Mitigation in Application |
|---|---|---|
| **Credential Theft** | CRITICAL | Credentials are strictly prohibited by code, rejected at API boundary, and never requested. |
| **Accidental Botting / Legal Exposure** | HIGH | Complete absence of automation libraries (no Selenium, Playwright, or HTTP clients pointing to IRCTC). |
| **Local Network Snooping** | MEDIUM | Bound solely to `127.0.0.1` (localhost). |
| **Stored XSS in Local DB** | LOW | Input sanitization stripping HTML/script tags before storing or rendering passenger and station details. |
| **Data Exfiltration** | NONE | Passenger data never leaves local machine; train queries strictly decoupled. |

---

## 4. Vulnerability Reporting

If you discover any security concerns, improper credential handling, or potential vulnerabilities, please report them to the repository maintainers. All code is open for review in the local workspace.
