# SECURITY POLICY & ARCHITECTURE: LOCAL TATKAL ASSISTANT

## 1. Zero-Trust Security Philosophy

The Local Tatkal Booking Preparation Assistant is engineered around a core principle: **Complete isolation from sensitive credentials and external systems**.

### Core Guarantees:
1. **Zero Credential Collection**: The application will **NEVER** request, receive, or persist:
   - IRCTC login passwords or security questions
   - One-Time Passwords (OTPs)
   - UPI PINs or Net Banking passwords
   - Credit / Debit card numbers or CVVs
2. **Local Payload Inspection**: The `security/validator.py` middleware proactively inspects all inbound requests. Any attempt to supply fields matching credential patterns results in an immediate HTTP 400 rejection.
3. **Loopback Binding**: The backend exclusively binds to `127.0.0.1`. It does not listen on public interfaces (`0.0.0.0`), preventing unintended local network exposure.
4. **No External Network Egress**: The application contains no analytics, telemetry, remote font fetches, or third-party web trackers.

---

## 2. Threat Model

| Threat | Risk Level | Mitigation in Application |
|---|---|---|
| **Credential Theft** | CRITICAL | Credentials are strictly prohibited by code, rejected at API boundary, and never requested. |
| **Accidental Botting / Legal Exposure** | HIGH | Complete absence of automation libraries (no Selenium, Playwright, or HTTP clients pointing to IRCTC). |
| **Local Network Snooping** | MEDIUM | Bound solely to `127.0.0.1` (localhost). |
| **Stored XSS in Local DB** | LOW | Input sanitization stripping HTML/script tags before storing or rendering passenger and station details. |
| **Data Exfiltration** | NONE | Application makes zero external outbound requests. |

---

## 3. Vulnerability Reporting

If you discover any security concerns, improper credential handling, or potential vulnerabilities, please report them to the local system administrator. All code is open for review in the local workspace.
