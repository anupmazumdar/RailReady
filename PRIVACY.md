# PRIVACY STATEMENT: LOCAL TATKAL PREPARATION ASSISTANT

## 1. Data Ownership & Storage

- **100% On-Device**: All journey plans, passenger names, ages, and checklist states entered into this application are stored exclusively on your local computer in an SQLite database located at `storage/tatkal_assistant.db`.
- **Zero Cloud Synchronization**: There is no cloud sync, remote backup, or external database.
- **Zero Analytics / Telemetry**: No usage metrics, tracking pixels, crash logs, or IP data are collected or sent anywhere.

---

## 2. What Data is Handled

The application only handles travel preference data intended for your personal reference:
- Origin and Destination Station Names
- Journey Date
- Train Name / Number & Class
- Passenger Names, Ages, Genders, Berth Preferences, and Meal Preferences
- Checklist checkboxes

---

## 3. What Data is Never Handled

The application **never** collects:
- Government ID numbers (Aadhaar, Passport, PAN)
- Payment card details or CVVs
- Bank account details or UPI PINs
- IRCTC account passwords or security questions
- Two-factor authentication (2FA) / SMS OTPs

---

## 4. How to Delete Your Data

Because all information is kept locally, you have total control over your data:
- To reset or delete all saved journeys and passengers, simply delete the file:
  `storage/tatkal_assistant.db`
- Or use the "Clear Data" option directly from the application settings/dashboard.
