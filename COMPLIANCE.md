# COMPLIANCE DECLARATION: LOCAL TATKAL PREPARATION ASSISTANT

## 1. Statutory and Regulatory Alignment

This software is developed strictly as a **personal offline preparation tool and checklist organizer**. 

It is designed in full compliance with:
- **The Indian Railways Act, 1989 (Section 143)** — Prohibiting unauthorized procurement or automated booking of tickets.
- **The Information Technology Act, 2000 (Section 43 & Section 66)** — Prohibiting unauthorized access, denial of service, or tampering with computer systems.
- **IRCTC Terms of Service** — Strictly prohibiting automated bots, scrapers, automated scripts, DOM injectors, or any software interacting directly with the IRCTC reservation portal.

---

## 2. Zero-Interaction Architectural Guarantee

This application maintains a permanent, deliberate technological barrier between itself and the IRCTC infrastructure:

1. **No Network Traffic to IRCTC**:
   - Zero HTTP/HTTPS requests to `irctc.co.in`, `cris.org.in`, or any affiliated endpoint.
   - Zero WebSocket connections.
   - Zero background polling or pinging.

2. **No Browser Automation**:
   - Contains NO Playwright, Selenium, Puppeteer, WebDriver, or browser automation libraries.
   - Does NOT launch, control, or attach to any browser instance.
   - Does NOT inject scripts, content scripts, or userscripts into any webpage.

3. **No Credential Interception**:
   - The application does not solicit, accept, transmit, or store IRCTC usernames, passwords, OTPs, PINs, CVVs, or payment data.
   - Any attempt to submit such data to local endpoints is explicitly rejected by the security validation layer.

4. **No Autonomous Actions**:
   - The application does not click buttons on external websites.
   - The application does not solve, detect, or bypass CAPTCHAs.
   - The user must manually navigate to the official website and perform all booking and payment actions independently.

---

## 3. Human-in-the-Loop Mandate

All sensitive and booking-related actions reside solely with the human user:
- Opening the browser is done manually by the user.
- Authentication on IRCTC is performed directly by the user on the official portal.
- Searching for trains, selecting quotas, and reviewing availability are conducted manually.
- Passenger details are manually pasted or typed by the user from the application's local clipboard helper.
- CAPTCHAs and OTPs are read and solved manually by the user.
- Payment authorization is completed strictly through official banking / IRCTC gateways by the user.

---

## 4. Prohibited Feature Registry

The following capabilities are permanently prohibited and must never be added to this codebase:
- Automated login or credential management.
- Tatkal slot racing or automated burst requests.
- Headless browser automation or session pre-warming.
- OCR or algorithmic CAPTCHA resolution.
- Payment gateway automation.
- Direct calls to private/undocumented IRCTC APIs.
