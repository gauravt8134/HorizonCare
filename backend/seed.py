import os
import random
from datetime import date, timedelta
from core import db, new_id, now_iso, hash_password, verify_password, generate_slots, today_str

IMG = {
    "m1": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
    "f1": "https://images.pexels.com/photos/32254665/pexels-photo-32254665.jpeg?auto=compress&cs=tinysrgb&w=400",
    "f2": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
    "m2": "https://images.unsplash.com/photo-1612363584451-cd060fb62018?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
}
HOSP_IMG = "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"

SPECS = [("Cardiology", "Heart & blood vessels"), ("Orthopedics", "Bones, joints & spine"),
         ("Neurology", "Brain & nervous system"), ("Dermatology", "Skin, hair & nails"),
         ("Pediatrics", "Child health"), ("General Medicine", "Everyday illnesses & check-ups"),
         ("Gynecology", "Women's health"), ("ENT", "Ear, nose & throat")]

HOSPITALS = [
    ("Marine Drive Medical Centre", "Mumbai", "Marine Drive", "12 Netaji Subhash Rd, Marine Drive, Mumbai 400020", "+91 22 4000 1200"),
    ("Andheri Apex Hospital", "Mumbai", "Andheri West", "Plot 7, Veera Desai Rd, Andheri West, Mumbai 400053", "+91 22 4000 3400"),
    ("Koregaon Park Health Institute", "Pune", "Koregaon Park", "Lane 5, Koregaon Park, Pune 411001", "+91 20 6700 2200"),
    ("Deccan Sahyadri Clinic", "Pune", "Deccan Gymkhana", "FC Road, Deccan Gymkhana, Pune 411004", "+91 20 6700 8800"),
    ("Whitefield Horizon Hospital", "Bengaluru", "Whitefield", "ITPL Main Rd, Whitefield, Bengaluru 560066", "+91 80 4500 1100"),
    ("Bannerghatta Care Centre", "Bengaluru", "Bannerghatta Road", "Bannerghatta Main Rd, Bengaluru 560076", "+91 80 4500 7700"),
]

# (name, hospital_idx, spec_idx, exp, fee, qualification, image, rating, reviews)
DOCTORS = [
    ("Arjun Mehta", 0, 0, 18, 1200, "MBBS, MD, DM (Cardiology)", "m1", 4.8, 214),
    ("Priya Nair", 0, 4, 11, 700, "MBBS, MD (Pediatrics)", "f1", 4.7, 168),
    ("Rohan Kulkarni", 0, 5, 9, 500, "MBBS, MD (Internal Medicine)", "m2", 4.5, 96),
    ("Sneha Iyer", 1, 3, 8, 800, "MBBS, MD (Dermatology)", "f2", 4.6, 132),
    ("Vikram Desai", 1, 1, 15, 1000, "MBBS, MS (Orthopedics)", "m1", 4.7, 189),
    ("Kavita Rao", 1, 6, 13, 900, "MBBS, MS (Obs & Gyn)", "f1", 4.9, 240),
    ("Aditya Joshi", 2, 2, 16, 1300, "MBBS, MD, DM (Neurology)", "m2", 4.8, 156),
    ("Meera Deshpande", 2, 5, 7, 450, "MBBS, MD (General Medicine)", "f2", 4.4, 71),
    ("Sameer Patil", 2, 7, 12, 750, "MBBS, MS (ENT)", "m1", 4.6, 103),
    ("Anjali Kulkarni", 3, 0, 14, 1100, "MBBS, MD, DM (Cardiology)", "f1", 4.7, 145),
    ("Nikhil Bhosale", 3, 1, 10, 900, "MBBS, MS (Orthopedics)", "m2", 4.5, 88),
    ("Divya Menon", 4, 3, 9, 850, "MBBS, MD (Dermatology)", "f2", 4.8, 177),
    ("Karthik Reddy", 4, 2, 20, 1500, "MBBS, MD, DM (Neurology)", "m1", 4.9, 265),
    ("Lakshmi Krishnan", 4, 4, 12, 650, "MBBS, MD (Pediatrics)", "f1", 4.6, 121),
    ("Suresh Gowda", 5, 5, 6, 400, "MBBS, MD (General Medicine)", "m2", 4.3, 54),
    ("Ananya Shetty", 5, 6, 11, 950, "MBBS, MS (Obs & Gyn)", "f2", 4.7, 134),
    ("Rahul Verma", 5, 7, 8, 700, "MBBS, MS (ENT)", "m1", 4.5, 79),
]

PATIENTS = [("Gaurav Patient", "patient@horizoncare.com"), ("Riya Sharma", "riya.sharma@example.com"),
            ("Aman Gupta", "aman.gupta@example.com"), ("Neha Singh", "neha.singh@example.com"),
            ("Kunal Shah", "kunal.shah@example.com"), ("Pooja Jain", "pooja.jain@example.com")]

REASONS = ["Routine check-up", "Chest discomfort", "Persistent headache", "Knee pain after fall", "Skin rash",
           "Fever and cough", "Follow-up visit", "Back pain", "Ear infection", "Annual health screening"]
COMMENTS = ["Very thorough and patient. Explained everything clearly.", "Short wait time and excellent care.",
            "Highly recommend, the doctor listened carefully.", "Good experience overall.",
            "Prescribed the right treatment, recovered quickly.", "Professional and kind."]


def _availability(kind: int):
    if kind == 0:
        return [{"day": d, "start": "09:00", "end": "13:00", "slot_duration": 30} for d in range(7)]
    if kind == 1:
        return [{"day": d, "start": "10:00", "end": "14:00", "slot_duration": 20} for d in range(6)] + \
               [{"day": d, "start": "17:00", "end": "20:00", "slot_duration": 20} for d in (0, 2, 4)]
    if kind == 2:
        return [{"day": d, "start": "09:30", "end": "12:30", "slot_duration": 15} for d in range(7)] + \
               [{"day": d, "start": "16:00", "end": "19:00", "slot_duration": 15} for d in range(5)]
    return [{"day": d, "start": "11:00", "end": "15:00", "slot_duration": 30} for d in range(1, 7)] + \
           [{"day": d, "start": "18:00", "end": "20:00", "slot_duration": 30} for d in (1, 3, 5)]


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "email": email, "name": "Gaurav Thakare", "role": "admin", "phone": "",
                                   "picture": "", "password_hash": hash_password(password), "created_at": now_iso()})
    elif not existing.get("password_hash") or not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password), "role": "admin"}})


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.user_sessions.create_index("session_token")
    await db.appointments.create_index("id", unique=True)
    await db.appointments.create_index([("patient_id", 1), ("date", -1)])
    await db.appointments.create_index([("doctor_id", 1), ("date", 1), ("time", 1)], unique=True,
                                       partialFilterExpression={"status": {"$in": ["confirmed", "checked_in", "in_progress"]}})
    await db.doctors.create_index("id", unique=True)
    await db.doctors.create_index([("hospital_id", 1), ("specialization_id", 1)])
    await db.prescriptions.create_index("appointment_id")
    await db.reviews.create_index("doctor_id")
    await db.medical_records.create_index([("patient_id", 1), ("is_deleted", 1)])
    await db.cron_runs.create_index("run_id", unique=True)
    await db.notifications.create_index("appointment_id")


async def seed_data():
    if await db.hospitals.count_documents({}) > 0:
        return
    rnd = random.Random(42)
    specs = [{"id": new_id(), "name": n, "description": d} for n, d in SPECS]
    await db.specializations.insert_many([dict(s) for s in specs])
    hospitals = [{"id": new_id(), "name": n, "city": c, "area": a, "address": ad, "contact": ct, "image": HOSP_IMG,
                  "created_at": now_iso()} for n, c, a, ad, ct in HOSPITALS]
    await db.hospitals.insert_many([dict(h) for h in hospitals])

    doctors, doctor_users = [], []
    for i, (name, hi, si, exp, fee, qual, img, rating, reviews) in enumerate(DOCTORS):
        email = f"dr.{name.split()[0].lower()}@horizoncare.com"
        uid = new_id()
        doctor_users.append({"id": uid, "email": email, "name": f"Dr. {name}", "role": "doctor", "phone": "",
                             "picture": IMG[img], "password_hash": hash_password("doctor123"), "created_at": now_iso()})
        doctors.append({"id": new_id(), "user_id": uid, "name": name, "hospital_id": hospitals[hi]["id"],
                        "specialization_id": specs[si]["id"], "experience": exp, "fee": fee, "qualification": qual,
                        "bio": f"Dr. {name} is a {specs[si]['name'].lower()} specialist with {exp}+ years of experience at "
                               f"{hospitals[hi]['name']}, known for patient-first, evidence-based care.",
                        "image": IMG[img], "rating": rating, "review_count": reviews, "commission_rate": 0.7,
                        "availability": _availability(i % 4), "created_at": now_iso()})
    await db.users.insert_many([dict(u) for u in doctor_users])
    await db.doctors.insert_many([dict(d) for d in doctors])

    patients = [{"id": new_id(), "email": e, "name": n, "role": "patient", "phone": "+91 98000 0000" + str(i),
                 "picture": "", "password_hash": hash_password("patient123"), "created_at": now_iso()}
                for i, (n, e) in enumerate(PATIENTS)]
    await db.users.insert_many([dict(p) for p in patients])

    today = date.fromisoformat(today_str())
    appts, rxs, reviews = [], [], []
    counters = {}

    def add_appt(doc, pat, d, t, status, reason):
        key = f"{doc['id']}:{d}"
        counters[key] = counters.get(key, 0) + 1
        a = {"id": new_id(), "patient_id": pat["id"], "doctor_id": doc["id"], "hospital_id": doc["hospital_id"],
             "date": d, "time": t, "status": status, "reason": reason, "token_number": counters[key], "fee": doc["fee"],
             "created_at": now_iso()}
        appts.append(a)
        return a

    for back in range(1, 29):
        d = (today - timedelta(days=back)).isoformat()
        for doc in doctors:
            slots = generate_slots(doc["availability"], d)
            if not slots:
                continue
            for t in sorted(rnd.sample(slots, min(len(slots), rnd.randint(2, 6)))):
                pat = rnd.choice(patients)
                status = rnd.choices(["completed", "no_show", "cancelled"], weights=[80, 10, 10])[0]
                a = add_appt(doc, pat, d, t, status, rnd.choice(REASONS))
                if status == "completed" and rnd.random() < 0.45:
                    reviews.append({"id": new_id(), "doctor_id": doc["id"], "patient_id": pat["id"], "patient_name": pat["name"],
                                    "appointment_id": a["id"], "rating": rnd.choice([4, 5, 5, 5, 3]),
                                    "comment": rnd.choice(COMMENTS), "created_at": now_iso()})

    demo = patients[0]
    doc_today = doctors[0]
    today_slots = generate_slots(doc_today["availability"], today.isoformat())
    for i, t in enumerate(today_slots[:5]):
        pat = demo if i == 2 else patients[(i % 5) + 1]
        add_appt(doc_today, pat, today.isoformat(), t, "completed" if i == 0 else "confirmed", rnd.choice(REASONS))
    tomorrow = (today + timedelta(days=1)).isoformat()
    tslots = generate_slots(doctors[3]["availability"], tomorrow) or generate_slots(doctors[1]["availability"], tomorrow)
    if tslots:
        add_appt(doctors[3] if generate_slots(doctors[3]["availability"], tomorrow) else doctors[1], demo, tomorrow, tslots[1],
                 "confirmed", "Skin rash consultation")
    for a in [x for x in appts if x["patient_id"] == demo["id"] and x["status"] == "completed"][:3]:
        rxs.append({"id": new_id(), "appointment_id": a["id"], "doctor_id": a["doctor_id"], "patient_id": demo["id"],
                    "diagnosis": "Viral upper respiratory infection", "notes": "Rest, hydrate well, avoid cold drinks.\nReturn if fever persists beyond 3 days.",
                    "follow_up": "After 7 days", "created_at": now_iso(),
                    "medicines": [{"name": "Paracetamol 650mg", "dosage": "1 tablet", "frequency": "Twice daily", "duration": "5 days"},
                                  {"name": "Cetirizine 10mg", "dosage": "1 tablet", "frequency": "At night", "duration": "5 days"}]})

    await db.appointments.insert_many([dict(a) for a in appts])
    if reviews:
        await db.reviews.insert_many([dict(r) for r in reviews])
    if rxs:
        await db.prescriptions.insert_many([dict(r) for r in rxs])
    await db.counters.insert_many([{"_id": k, "seq": v} for k, v in counters.items()])
