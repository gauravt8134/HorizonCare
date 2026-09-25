"""HorizonCare API tests - runs against public REACT_APP_BACKEND_URL."""
import os
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("thakaregaurav0911@gmail.com", "Admin@123")
DOCTOR = ("dr.arjun@horizoncare.com", "doctor123")
PATIENT = ("patient@horizoncare.com", "patient123")
PATIENT2 = ("riya.sharma@example.com", "patient123")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200

    def test_login_patient(self):
        r = requests.post(f"{API}/auth/login", json={"email": PATIENT[0], "password": PATIENT[1]}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "patient"
        assert d["access_token"]

    def test_login_doctor(self):
        r = requests.post(f"{API}/auth/login", json={"email": DOCTOR[0], "password": DOCTOR[1]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "doctor"

    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": PATIENT[0], "password": "wrong-xyz"}, timeout=15)
        assert r.status_code == 401

    def test_me_bearer(self):
        tok = _login(*PATIENT)
        r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == PATIENT[0]

    def test_role_protected(self):
        tok = _login(*PATIENT)
        r = requests.get(f"{API}/admin/analytics", headers=_hdr(tok), timeout=15)
        assert r.status_code == 403

    def test_register_new_patient(self):
        import uuid
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"name": "Test User", "email": email, "password": "secret1"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "patient"


# ---------------- Catalog chain ----------------
class TestCatalog:
    def test_locations(self):
        r = requests.get(f"{API}/locations", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert "city" in data[0]

    def test_specializations_by_location(self):
        r = requests.get(f"{API}/specializations", params={"location": "Mumbai"}, timeout=15)
        assert r.status_code == 200
        specs = r.json()
        assert len(specs) > 0
        assert all(s["doctor_count"] > 0 for s in specs)

    def test_hospitals_by_location(self):
        r = requests.get(f"{API}/hospitals", params={"location": "Mumbai"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_doctors_and_next_available(self):
        r = requests.get(f"{API}/doctors", timeout=15)
        assert r.status_code == 200
        docs = r.json()
        assert len(docs) >= 10
        d0 = docs[0]
        assert "next_available" in d0
        r2 = requests.get(f"{API}/doctors/{d0['id']}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["id"] == d0["id"]

    def test_doctor_slots(self):
        docs = requests.get(f"{API}/doctors", timeout=15).json()
        arjun = next((d for d in docs if "Arjun" in d["name"]), docs[0])
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        r = requests.get(f"{API}/doctors/{arjun['id']}/slots", params={"date": tomorrow}, timeout=15)
        assert r.status_code == 200
        slots = r.json()["slots"]
        assert len(slots) > 0
        assert "available" in slots[0]


# ---------------- Booking ----------------
class TestBooking:
    def _find_available_slot(self, tok):
        docs = requests.get(f"{API}/doctors", timeout=15).json()
        arjun = next((d for d in docs if "Arjun" in d["name"]), docs[0])
        for offset in range(1, 8):
            d = (date.today() + timedelta(days=offset)).isoformat()
            slots = requests.get(f"{API}/doctors/{arjun['id']}/slots",
                                 params={"date": d}, timeout=15).json()["slots"]
            for s in slots:
                if s["available"]:
                    return arjun["id"], d, s["time"]
        pytest.skip("No available slot found")

    def test_booking_flow(self):
        # patient2 to avoid disturbing patient@'s seeded today appointment
        tok = _login(*PATIENT2)
        doc_id, d, t = self._find_available_slot(tok)
        payload = {"doctor_id": doc_id, "date": d, "time": t, "reason": "TEST booking"}
        r = requests.post(f"{API}/appointments", json=payload, headers=_hdr(tok), timeout=20)
        assert r.status_code == 201, r.text
        appt = r.json()
        assert appt["token_number"] > 0
        assert appt["status"] == "confirmed"
        appt_id = appt["id"]

        # Duplicate booking -> 409 (unique index) OR 400 depending on race
        r2 = requests.post(f"{API}/appointments", json=payload, headers=_hdr(tok), timeout=20)
        assert r2.status_code in (400, 409), r2.text

        # my appointments
        r3 = requests.get(f"{API}/appointments/me", headers=_hdr(tok), timeout=15)
        assert r3.status_code == 200
        assert any(a["id"] == appt_id for a in r3.json())

        # queue
        rq = requests.get(f"{API}/appointments/{appt_id}/queue", headers=_hdr(tok), timeout=15)
        assert rq.status_code == 200
        assert "position" in rq.json()

        # Reschedule to another available slot
        for offset in range(1, 8):
            d2 = (date.today() + timedelta(days=offset)).isoformat()
            if d2 == d:
                continue
            slots = requests.get(f"{API}/doctors/{doc_id}/slots",
                                 params={"date": d2}, timeout=15).json()["slots"]
            new_slot = next((s for s in slots if s["available"]), None)
            if new_slot:
                rr = requests.patch(f"{API}/appointments/{appt_id}/reschedule",
                                    json={"date": d2, "time": new_slot["time"]},
                                    headers=_hdr(tok), timeout=15)
                assert rr.status_code == 200
                break

        # Cancel
        rc = requests.patch(f"{API}/appointments/{appt_id}/cancel", headers=_hdr(tok), timeout=15)
        assert rc.status_code == 200

    def test_booking_past_slot(self):
        tok = _login(*PATIENT2)
        docs = requests.get(f"{API}/doctors", timeout=15).json()
        arjun = next((d for d in docs if "Arjun" in d["name"]), docs[0])
        yday = (date.today() - timedelta(days=1)).isoformat()
        payload = {"doctor_id": arjun["id"], "date": yday, "time": "09:00", "reason": "past"}
        r = requests.post(f"{API}/appointments", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 400

    def test_booking_unavailable(self):
        tok = _login(*PATIENT2)
        docs = requests.get(f"{API}/doctors", timeout=15).json()
        arjun = next((d for d in docs if "Arjun" in d["name"]), docs[0])
        d = (date.today() + timedelta(days=1)).isoformat()
        payload = {"doctor_id": arjun["id"], "date": d, "time": "23:45", "reason": "bad"}
        r = requests.post(f"{API}/appointments", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 400


# ---------------- Doctor flow ----------------
class TestDoctorFlow:
    def test_doctor_profile_and_stats(self):
        tok = _login(*DOCTOR)
        r = requests.get(f"{API}/doctor/me", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        assert "hospital" in r.json()
        r2 = requests.get(f"{API}/doctor/me/stats", headers=_hdr(tok), timeout=15)
        assert r2.status_code == 200
        assert "today_total" in r2.json()

    def test_doctor_queue_and_prescription(self):
        tok = _login(*DOCTOR)
        today = date.today().isoformat()
        r = requests.get(f"{API}/appointments/doctor", params={"date": today},
                         headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        appts = r.json()
        # Find an active appointment (confirmed/checked_in)
        active = [a for a in appts if a["status"] in ("confirmed", "checked_in")]
        if not active:
            pytest.skip("No active appointment for doctor today")
        appt = active[0]
        # Set in_progress
        rs = requests.patch(f"{API}/appointments/{appt['id']}/status",
                            json={"status": "in_progress"}, headers=_hdr(tok), timeout=15)
        assert rs.status_code == 200
        # Prescription
        rx_payload = {"appointment_id": appt["id"], "diagnosis": "TEST diagnosis",
                      "medicines": [{"name": "TEST-Med", "dosage": "1 tab", "frequency": "2x", "duration": "5d"}],
                      "notes": "Rest well", "follow_up": ""}
        rp = requests.post(f"{API}/prescriptions", json=rx_payload, headers=_hdr(tok), timeout=20)
        assert rp.status_code == 201, rp.text
        rx_id = rp.json()["id"]
        # PDF
        rpdf = requests.get(f"{API}/prescriptions/{rx_id}/pdf", headers=_hdr(tok), timeout=20)
        assert rpdf.status_code == 200
        assert "application/pdf" in rpdf.headers.get("Content-Type", "")
        # Confirm appointment is completed now
        ra = requests.get(f"{API}/appointments/doctor", params={"date": today},
                          headers=_hdr(tok), timeout=15).json()
        a = next((x for x in ra if x["id"] == appt["id"]), None)
        assert a and a["status"] == "completed"

    def test_availability_update(self):
        tok = _login(*DOCTOR)
        original = requests.get(f"{API}/doctor/me", headers=_hdr(tok), timeout=15).json()["availability"]
        # Restore same availability
        payload = {"availability": [{"day": a["day"], "start": a["start"], "end": a["end"],
                                     "slot_duration": a.get("slot_duration", 30)} for a in original]}
        r = requests.put(f"{API}/doctor/me/availability", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 200


# ---------------- Admin ----------------
class TestAdmin:
    def test_analytics(self):
        tok = _login(*ADMIN)
        r = requests.get(f"{API}/admin/analytics", headers=_hdr(tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        for key in ("kpis", "per_day", "heatmap", "specialization_demand", "doctor_performance"):
            assert key in d

    def test_list_and_create_delete_doctor(self):
        tok = _login(*ADMIN)
        r = requests.get(f"{API}/admin/doctors", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        existing = r.json()
        assert len(existing) > 0
        hosp_id = existing[0]["hospital_id"]
        spec_id = existing[0]["specialization_id"]
        import uuid
        email = f"TEST_dr_{uuid.uuid4().hex[:6]}@horizoncare.com"
        payload = {"name": "TEST Doctor", "email": email, "password": "testpass1",
                   "hospital_id": hosp_id, "specialization_id": spec_id,
                   "experience": 3, "fee": 400, "qualification": "MBBS"}
        rc = requests.post(f"{API}/admin/doctors", json=payload, headers=_hdr(tok), timeout=15)
        assert rc.status_code == 201, rc.text
        new_id = rc.json()["id"]
        # Login as new doctor
        rl = requests.post(f"{API}/auth/login",
                           json={"email": email, "password": "testpass1"}, timeout=15)
        assert rl.status_code == 200
        # Delete
        rd = requests.delete(f"{API}/admin/doctors/{new_id}", headers=_hdr(tok), timeout=15)
        assert rd.status_code == 200

    def test_export_csv(self):
        tok = _login(*ADMIN)
        r = requests.get(f"{API}/admin/export/appointments.csv", headers=_hdr(tok), timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("Content-Type", "")
        assert "id,date,time" in r.text[:50]


# ---------------- AI ----------------
class TestAI:
    def test_symptom_check(self):
        r = requests.post(f"{API}/ai/symptom-check",
                          json={"symptoms": "sharp chest pain and breathlessness"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "suggestions" in d
        assert len(d["suggestions"]) > 0
        assert d["suggestions"][0].get("specialization_id")


# ---------------- Reviews ----------------
class TestReview:
    def test_review_completed_appointment(self):
        # Find a completed appointment for demo patient with no review
        tok = _login(*PATIENT)
        r = requests.get(f"{API}/appointments/me", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        completed = [a for a in r.json() if a["status"] == "completed" and not a.get("reviewed")]
        if not completed:
            pytest.skip("No unreviewed completed appointment")
        appt = completed[0]
        rr = requests.post(f"{API}/reviews",
                           json={"appointment_id": appt["id"], "rating": 5, "comment": "TEST great"},
                           headers=_hdr(tok), timeout=15)
        assert rr.status_code == 201
        # duplicate
        rr2 = requests.post(f"{API}/reviews",
                            json={"appointment_id": appt["id"], "rating": 4, "comment": "again"},
                            headers=_hdr(tok), timeout=15)
        assert rr2.status_code == 400
