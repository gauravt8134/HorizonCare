import csv
from io import StringIO
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from core import db, new_id, now_iso, require_role, hash_password, today_str, DAY_NAMES
from routers.appointments import enrich_appointments

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role("admin"))])


class DoctorIn(BaseModel):
    name: str
    email: EmailStr
    password: str = "doctor123"
    hospital_id: str
    specialization_id: str
    experience: int = 5
    fee: int = 500
    qualification: str = "MBBS, MD"
    bio: str = ""
    image: str = ""


class DoctorUpdate(BaseModel):
    name: str | None = None
    hospital_id: str | None = None
    specialization_id: str | None = None
    experience: int | None = None
    fee: int | None = None
    qualification: str | None = None
    bio: str | None = None
    image: str | None = None


class HospitalIn(BaseModel):
    name: str
    city: str
    area: str = ""
    address: str = ""
    contact: str = ""
    image: str = ""


@router.get("/analytics")
async def analytics(days: int = 14):
    today = date.fromisoformat(today_str())
    start = (today - timedelta(days=days - 1)).isoformat()
    appts = await db.appointments.find({}, {"_id": 0}).to_list(50000)
    docs = {d["id"]: d for d in await db.doctors.find({}, {"_id": 0}).to_list(1000)}
    hs = {h["id"]: h for h in await db.hospitals.find({}, {"_id": 0}).to_list(1000)}
    ss = {s["id"]: s for s in await db.specializations.find({}, {"_id": 0}).to_list(100)}

    window = [a for a in appts if start <= a["date"] <= today.isoformat()]
    completed = [a for a in appts if a["status"] == "completed"]
    finished = [a for a in appts if a["status"] in ("completed", "no_show")]
    revenue = sum(a.get("fee", 0) for a in completed)
    no_show_rate = round(100 * len([a for a in finished if a["status"] == "no_show"]) / len(finished), 1) if finished else 0

    per_day = []
    for i in range(days):
        d = (today - timedelta(days=days - 1 - i)).isoformat()
        day_appts = [a for a in window if a["date"] == d]
        per_day.append({"date": d, "label": d[5:], "appointments": len(day_appts),
                        "completed": len([a for a in day_appts if a["status"] == "completed"]),
                        "revenue": sum(a.get("fee", 0) for a in day_appts if a["status"] == "completed")})

    heat = [[0] * 12 for _ in range(7)]
    for a in appts:
        if a["status"] == "cancelled":
            continue
        wd = date.fromisoformat(a["date"]).weekday()
        hour = int(a["time"][:2])
        if 8 <= hour < 20:
            heat[wd][hour - 8] += 1
    heatmap = [{"day": DAY_NAMES[i], "values": heat[i]} for i in range(7)]

    spec_counts, hosp_counts = {}, {}
    for a in appts:
        if a["status"] == "cancelled":
            continue
        d = docs.get(a["doctor_id"])
        if d:
            spec_counts[d["specialization_id"]] = spec_counts.get(d["specialization_id"], 0) + 1
        hosp_counts[a["hospital_id"]] = hosp_counts.get(a["hospital_id"], 0) + 1
    spec_demand = sorted([{"name": ss[k]["name"], "count": v} for k, v in spec_counts.items() if k in ss],
                         key=lambda x: -x["count"])
    hosp_demand = sorted([{"name": hs[k]["name"], "city": hs[k]["city"], "count": v} for k, v in hosp_counts.items() if k in hs],
                         key=lambda x: -x["count"])

    perf = []
    for d in docs.values():
        mine = [a for a in appts if a["doctor_id"] == d["id"]]
        comp = [a for a in mine if a["status"] == "completed"]
        ns = [a for a in mine if a["status"] == "no_show"]
        rev = sum(a.get("fee", 0) for a in comp)
        perf.append({"doctor_id": d["id"], "name": d["name"], "specialization": ss.get(d["specialization_id"], {}).get("name", ""),
                     "hospital": hs.get(d["hospital_id"], {}).get("name", ""), "consultations": len(comp),
                     "no_shows": len(ns), "rating": d.get("rating", 0), "review_count": d.get("review_count", 0),
                     "revenue": rev, "commission": round(rev * d.get("commission_rate", 0.7)),
                     "upcoming": len([a for a in mine if a["date"] >= today.isoformat() and a["status"] in ("confirmed", "checked_in")])})
    perf.sort(key=lambda x: -x["revenue"])

    today_appts = [a for a in appts if a["date"] == today.isoformat()]
    return {"kpis": {"total_appointments": len(appts), "today_appointments": len(today_appts),
                     "today_waiting": len([a for a in today_appts if a["status"] in ("confirmed", "checked_in")]),
                     "revenue": revenue, "no_show_rate": no_show_rate, "doctors": len(docs), "hospitals": len(hs),
                     "patients": await db.users.count_documents({"role": "patient"}),
                     "window_appointments": len(window), "window_revenue": sum(p["revenue"] for p in per_day)},
            "per_day": per_day, "heatmap": heatmap, "hours": [f"{h}:00" for h in range(8, 20)],
            "specialization_demand": spec_demand, "hospital_demand": hosp_demand, "doctor_performance": perf}


@router.get("/appointments")
async def all_appointments(date: str | None = None, status: str | None = None, limit: int = 200):
    q = {}
    if date:
        q["date"] = date
    if status:
        q["status"] = status
    appts = await db.appointments.find(q, {"_id": 0}).sort([("date", -1), ("time", -1)]).to_list(limit)
    return await enrich_appointments(appts)


@router.get("/export/appointments.csv")
async def export_csv():
    appts = await enrich_appointments(await db.appointments.find({}, {"_id": 0}).sort([("date", -1)]).to_list(50000))
    buf = StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "date", "time", "token", "status", "patient", "doctor", "specialization", "hospital", "fee"])
    for a in appts:
        writer.writerow([a["id"], a["date"], a["time"], a["token_number"], a["status"], a["patient_name"],
                         a["doctor_name"], a["specialization_name"], a["hospital_name"], a.get("fee", 0)])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": 'attachment; filename="appointments.csv"'})


@router.get("/doctors")
async def list_doctors():
    docs = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    users = {u["id"]: u for u in await db.users.find({"role": "doctor"}, {"_id": 0, "password_hash": 0}).to_list(1000)}
    hs = {h["id"]: h for h in await db.hospitals.find({}, {"_id": 0}).to_list(1000)}
    ss = {s["id"]: s for s in await db.specializations.find({}, {"_id": 0}).to_list(100)}
    return [{**d, "email": users.get(d["user_id"], {}).get("email", ""), "hospital_name": hs.get(d["hospital_id"], {}).get("name", ""),
             "specialization_name": ss.get(d["specialization_id"], {}).get("name", "")} for d in docs]


@router.post("/doctors", status_code=201)
async def create_doctor(body: DoctorIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already in use")
    if not await db.hospitals.find_one({"id": body.hospital_id}) or not await db.specializations.find_one({"id": body.specialization_id}):
        raise HTTPException(status_code=400, detail="Invalid hospital or specialization")
    user = {"id": new_id(), "email": email, "name": body.name.strip(), "role": "doctor", "phone": "", "picture": body.image,
            "password_hash": hash_password(body.password), "created_at": now_iso()}
    await db.users.insert_one(user)
    doctor = {"id": new_id(), "user_id": user["id"], "name": body.name.strip(), "hospital_id": body.hospital_id,
              "specialization_id": body.specialization_id, "experience": body.experience, "fee": body.fee,
              "qualification": body.qualification, "bio": body.bio, "image": body.image, "rating": 0, "review_count": 0,
              "commission_rate": 0.7, "created_at": now_iso(),
              "availability": [{"day": d, "start": "09:00", "end": "13:00", "slot_duration": 30} for d in range(5)]}
    await db.doctors.insert_one(doctor)
    doctor.pop("_id", None)
    return {**doctor, "email": email}


@router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, body: DoctorUpdate):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    res = await db.doctors.update_one({"id": doctor_id}, {"$set": {**updates, "updated_at": now_iso()}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if "name" in updates:
        doc = await db.doctors.find_one({"id": doctor_id}, {"_id": 0, "user_id": 1})
        await db.users.update_one({"id": doc["user_id"]}, {"$set": {"name": updates["name"]}})
    return {"ok": True}


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str):
    doc = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    await db.doctors.delete_one({"id": doctor_id})
    await db.users.delete_one({"id": doc["user_id"]})
    return {"ok": True}


@router.post("/hospitals", status_code=201)
async def create_hospital(body: HospitalIn):
    h = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.hospitals.insert_one(h)
    h.pop("_id", None)
    return h


@router.get("/audit-logs")
async def audit_logs(limit: int = 100):
    return await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
