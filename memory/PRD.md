# HorizonCare — Multi-Hospital Patient Management System

## Original Problem Statement
Build a web-based PMS letting patients discover and book doctors across multiple hospitals (Location → Specialization → Hospital → Doctor), with appointment lifecycle, prescriptions (PDF), medical records, real-time queue, payments, admin analytics, AI-assisted features, notifications, reviews, localization. Full PRD provided by user (Gaurav Thakare).

## User Choices (Phase 1)
- Scope: Core (auth, discovery chain, slot booking, prescriptions PDF, queue, reviews, admin analytics, seeded data) + AI symptom-to-specialization (Claude Sonnet 4.6 via Emergent key)
- Auth: JWT email/password (patient/doctor/admin) + Emergent-managed Google login for patients; 2FA deferred
- Payments: skipped for now
- Design: clean clinical light theme, teal/emerald accents (Plus Jakarta Sans + DM Sans)
- DB: MongoDB (environment stack) instead of PostgreSQL/Redis

## Architecture
- Backend: FastAPI, `/app/backend/server.py` + `core.py` (db, auth helpers, slot generation, IST time) + `routers/{auth,catalog,appointments,prescriptions,doctor,admin,ai}.py` + `seed.py`
- DB: MongoDB collections: users, doctors, hospitals, specializations, appointments, prescriptions, reviews, counters (token seq), user_sessions, login_attempts, audit_logs, ai_queries
- No double booking: partial unique index on appointments (doctor_id, date, time) for active statuses → 409
- Frontend: React + Tailwind + shadcn + recharts; pages Landing, Doctors, DoctorProfile, Login, Register, PatientDashboard, DoctorDashboard, AdminDashboard
- Auth: httpOnly cookies (access/refresh JWT, or session_token for Google) with Bearer fallback; axios refresh interceptor

## User Personas
Patient (discover/book/queue/prescriptions/reviews), Doctor (availability/queue/prescriptions/patient history), Admin (analytics/roster/appointments/CSV export)

## Implemented (2026-06 / iteration 1)
- JWT auth with brute-force lockout, role guards, admin seeding (thakaregaurav0911@gmail.com), Google login (Emergent) for patients
- Catalog chain APIs with dynamic narrowing + next-available slot computation
- Booking, reschedule, cancel, check-in, live queue (token / now serving / position / ETA, 8s polling)
- Doctor dashboard: stats, queue table, call next / start / no-show, prescription builder (marks visit complete), availability editor, patient history
- Prescriptions with PDF export (reportlab)
- Reviews with doctor rating aggregation
- Admin: KPIs, appointments/day, revenue, peak-hour heatmap, specialization & hospital demand, doctor performance + commission (70%), roster CRUD, appointments table, CSV export, audit logs endpoint
- AI symptom → specialization (Claude Sonnet 4.6) with disclaimer
- Seeded: 3 cities, 6 hospitals, 8 specializations, 17 doctors, 6 patients, ~1700 historical appointments, reviews, prescriptions
- Testing: iteration_1 — backend 24/24, frontend flows all passing

## Backlog (prioritized)
- P0: Notifications (email via Resend; reminders 24h/1h — scheduled task), payments (Stripe test mode + refund policy)
- P1: Medical records upload (Emergent object storage) + field-level AES encryption, WebSocket queue (replace polling), 2FA TOTP for doctor/admin, cancellation/refund policy logic, FAQ chatbot, report summarization
- P2: Hindi/English toggle, pytest coverage badge, Postman collection, ER diagram doc, hospital self-onboarding

## Next Tasks
1. Stripe payments at booking + refund on cancel
2. Email/SMS reminders via scheduled cron
3. Medical records upload with encryption & audit
