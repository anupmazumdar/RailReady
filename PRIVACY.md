# PRIVACY STATEMENT: RAILREADY PLATFORM

## 1. Data Ownership & Storage

- **100% On-Device**: All journey plans, passenger names, ages, and checklist states entered into this application are stored exclusively on your local computer in an SQLite database located at `storage/tatkal_assistant.db`.
- **Zero Cloud Synchronization**: There is no cloud sync, remote telemetry, or external database.
- **Zero Analytics / Trackers**: No usage metrics, tracking pixels, crash logs, or IP data are collected or transmitted anywhere.

---

## 2. Third-Party Data Sources

> **"RailReady is independently developed and is not affiliated with IRCTC, Where Is My Train, Train Running Status, Google, or Indian Railways."**

### Data Source Policy & Privacy Safeguards:
* **Reference Examples (Non-Integrated)**:
  * Reference services (`trainrunningstatus.org` and `whereismytrain.org.in`) are not scraped, queried, or connected to. Zero user or travel data is ever shared with them.
* **Authorized Providers**:
  * **`MockTrainDataProvider` (Default)**: Runs 100% on your local machine with zero external network connectivity.
  * **`AuthorizedTrainProvider` (Pluggable)**: In any external provider configuration, the system guarantees **zero passenger data egress**. Train search and status queries only send train numbers, station codes, and journey dates. Passenger identities, names, ages, and quotas are kept strictly local.

---

## 3. What Data is Handled

The application only handles travel preference data intended for your personal reference:
- Origin and Destination Station Names
- Journey Date
- Train Name / Number & Class
- Passenger Names, Ages, Genders, Berth Preferences, and Meal Preferences
- Checklist checkboxes
- Alternate train preferences (Primary, Alt 1, Alt 2)

---

## 4. What Data is Never Handled

The application **never** collects, stores, or transmits:
- Government ID numbers (Aadhaar, Passport, PAN)
- Payment card details or CVVs
- Bank account details or UPI PINs
- IRCTC account passwords or security questions
- Two-factor authentication (2FA) / SMS OTPs

---

## 5. How to Delete Your Data

Because all information is kept locally, you have total control over your data:
- To reset or delete all saved journeys and passengers, simply delete the file:
  `storage/tatkal_assistant.db`
- Or use the "Clear Passenger Data" button directly in the Settings view (`#view-settings`) or Dashboard.
