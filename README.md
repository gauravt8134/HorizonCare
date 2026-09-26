# Here are your Instructions
# HorizonCare

**A multi-hospital patient management platform** — discover doctors across hospitals by location and specialization, book real-time appointments, track live queue status, manage prescriptions, and securely store medical records.

![Status](https://img.shields.io/badge/status-active%20development-yellow)
![Backend](https://img.shields.io/badge/backend-FastAPI-teal)
![Frontend](https://img.shields.io/badge/frontend-React-blue)
![Database](https://img.shields.io/badge/database-MongoDB-green)

---

## Overview

HorizonCare solves a problem most single-clinic booking tools don't: **finding the right doctor across multiple hospitals**, not just one. A patient filters by location → specialization → hospital → doctor, books a real-time slot, and tracks their position in a live queue on the day of the visit. Doctors get a dashboard to manage their daily patient queue, issue prescriptions, and view consultation history. Admins get visibility into appointments, revenue, and doctor performance across the network.

The project is built as a full-stack application with a clear separation between a FastAPI backend (REST API + business logic) and a React frontend (patient, doctor, and admin experiences on a single codebase, gated by role).

---

## Core Features

### Patient
- **Doctor discovery** — filter chain: Location → Specialization → Hospital → Doctor, with ratings, experience, and consultation fees shown upfront
- **Real-time appointment booking** with conflict-free slot management (no double-booking)
- **Live queue tracking** — see your token number, who's being served now, and estimated wait time
- **Check-in flow** for the day of the appointment
- **Reschedule / cancel** appointments
- **Prescription history** — view past prescriptions issued by any doctor on the platform
- **Medical records** — upload lab reports, scans, and discharge summaries (AES-encrypted at rest, access is audit-logged)

### Doctor
- **Daily queue dashboard** — token, patient, time, reason for visit, status, and one-click "Call next"
- **Consultation lifecycle** — start, complete, and issue a prescription in the same flow
- **Availability management** — set weekly working hours per hospital
- **Performance stats** — today's patients, all-time consultations, revenue generated, rating

### Admin
- Hospital and doctor roster management
- Appointment and revenue analytics across the network

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Tailwind CSS, CRACO |
| Backend | FastAPI (Python) |
| Database | MongoDB (Atlas) via Motor (async driver) |
| Auth | JWT (access + refresh tokens, httpOnly cookies), bcrypt password hashing |
| File Storage | AWS S3 (medical records, AES/Fernet-encrypted before upload) |
| Security | Field-level encryption for sensitive data, per-action audit logging, role-based access control |

---

## Architecture

```
┌─────────────┐       REST API (JWT auth)       ┌──────────────┐
│   React     │ ───────────────────────────────▶ │   FastAPI    │
│  Frontend   │ ◀─────────────────────────────── │   Backend    │
└─────────────┘                                   └──────┬───────┘
                                                          │
                              ┌───────────────────────────┼───────────────────────┐
                              ▼                            ▼                       ▼
                       ┌─────────────┐            ┌────────────────┐      ┌──────────────┐
                       │  MongoDB    │            │   AWS S3        │      │  Audit Logs  │
                       │  (Atlas)    │            │  (encrypted     │      │  (Mongo      │
                       │             │            │   file storage) │      │   collection)│
                       └─────────────┘            └────────────────┘      └──────────────┘
```

Role-based routing (`patient` / `doctor` / `admin`) is enforced server-side on every protected endpoint via a `require_role()` dependency, and the frontend redirects each role to its own dashboard after login — all on the same domain and codebase.

---

## Data Model (high-level)

- `users` — id, role, name, email, password_hash
- `patients` — user_id, dob, blood_group, allergies
- `doctors` — id, user_id, hospital_id, specialization_id, experience, fees, rating
- `hospitals` — id, name, location, address, contact
- `specializations` — id, name
- `doctor_availability` — doctor_id, day, start_time, end_time, slot_duration
- `appointments` — id, patient_id, doctor_id, hospital_id, slot_time, status, reason
- `prescriptions` — id, appointment_id, medicines[], notes, pdf_url
- `medical_records` — id, patient_id, record_type, storage_path, filename_enc, notes_enc
- `audit_logs` — id, user_id, action, resource, resource_id, timestamp

---

## Security Notes

- Passwords hashed with **bcrypt**, never stored in plaintext
- JWT access tokens (12h) and refresh tokens (7d) delivered as httpOnly, secure cookies
- Medical record files are **encrypted client-side with Fernet (AES)** before they ever reach storage, and decrypted only on authorized download
- Every read, upload, download, and delete on a medical record is written to an **audit log** (who, what, when)
- Access control checks (`can_access()`) ensure a doctor can only view a patient's records if there's an actual appointment between them — not open access across the platform

---

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- A MongoDB Atlas cluster (or local MongoDB instance)
- An AWS S3 bucket (for medical records storage)

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
MONGO_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=Cluster0
DB_NAME=horizoncare
JWT_SECRET=<a long random string>
RECORDS_ENCRYPTION_KEY=<generate with the command below>
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ADMIN_EMAIL=admin@horizoncare.com
ADMIN_PASSWORD=<your choice>
AWS_ACCESS_KEY_ID=<your AWS access key>
AWS_SECRET_ACCESS_KEY=<your AWS secret key>
AWS_S3_BUCKET=<your bucket name>
AWS_REGION=ap-south-1
```

Generate an encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Run the backend:
```bash
uvicorn server:app --reload
```
API docs available at `http://127.0.0.1:8000/api/docs`.

### Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
```

Create a `.env` file in `frontend/`:
```env
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
```

Run the frontend:
```bash
npm start
```
App available at `http://localhost:3000`.

---

## Roadmap / Known Limitations

The following were deliberately scoped out of the current build to ship a working core flow first:

- **Payments** — consultation fee collection (Razorpay/Stripe) not yet wired in; booking currently completes without a payment step
- **Two-factor authentication** — planned for doctor/admin accounts, not yet implemented
- **Real-time queue via WebSockets** — current queue view is polling-based; WebSocket upgrade planned
- **AI features** — symptom-to-specialization suggestion and FAQ chatbot are scoped for a later phase, kept strictly assistive (never diagnostic)
- **SMS / WhatsApp reminders** — email reminder scaffolding exists in code but is gated behind an email provider key; currently a no-op if unconfigured
- **Deployment pipeline** — Docker, CI/CD, and cloud hosting intentionally deferred; local dev environment is fully functional

---

## License

This is a personal/educational project built for portfolio purposes.