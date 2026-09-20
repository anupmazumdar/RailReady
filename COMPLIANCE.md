# STATUTORY COMPLIANCE & LEGAL FRAMEWORK

## 1. Statutory and Regulatory Alignment

This software is developed strictly as a **personal offline preparation tool, journey planner, and train information assistant**. 

It is designed in full compliance with:
- **The Indian Railways Act, 1989 (Section 143)** — Prohibiting unauthorized procurement, automated ticketing, or commercial resale of railway tickets.
- **The Information Technology Act, 2000 (Section 43 & Section 66)** — Prohibiting unauthorized system access, denial of service, botting, or tampering with computer systems.
- **IRCTC Terms of Service** — Strictly prohibiting automated bots, scrapers, automated scripts, DOM injectors, or any software interacting directly with the IRCTC reservation portal.
- **Anti-Scraping Policies** — Strictly forbidding unauthorized scraping, crawling, or reverse-engineering of third-party reference services.

---

## 2. Third-Party Data Sources

> **"RailReady is independently developed and is not affiliated with IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways."**

### Data Source Classification:
* **Reference Examples (Strictly Non-Integrated & Not Scraped)**:
  * `https://trainrunningstatus.org/`: Used solely as a functional reference for the categories of information useful to passengers (station stop duration, delay metrics, platform estimates). No crawling, scraping, or automated API requests are executed against this portal.
  * `https://whereismytrain.org.in/`: Used solely as a design concept reference for train search ergonomics and route milestone tracking. No scraping, reverse engineering, or private API queries are executed against this service.
* **Authorized Sources**:
  * `MockTrainDataProvider` (Active / Default): Built-in offline high-fidelity simulator for Indian Railway routes, timetables, and running status. Operates 100% locally with zero external network connectivity.
  * `AuthorizedTrainProvider` (Pluggable): Dedicated provider abstraction ready for connection to authorized, licensed commercial or CRIS/NTES enterprise data feeds when legally established.

---

## 3. Zero-Interaction Architectural Guarantee

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

## 4. Human-in-the-Loop Mandate

All sensitive and booking-related actions reside solely with the human user:
- Opening the browser is done manually by the user.
- Authentication on IRCTC is performed directly by the user on the official portal.
- Searching for trains, selecting quotas, and reviewing availability are conducted manually.
- Passenger details are manually pasted or typed by the user from the application's local clipboard helper.
- CAPTCHAs and OTPs are read and solved manually by the user.
- Payment authorization is completed strictly through official banking / IRCTC gateways by the user.

---

## 5. Prohibited Feature Registry

The following capabilities are permanently prohibited and must never be added to this codebase:
- Automated login or credential management.
- Tatkal slot racing or automated burst requests.
- Headless browser automation or session pre-warming.
- OCR or algorithmic CAPTCHA resolution.
- Payment gateway automation.
- Direct calls to private/undocumented IRCTC APIs.
