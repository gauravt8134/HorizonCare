from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query
from core import db, ACTIVE_STATUSES, generate_slots, today_str, is_past_slot

router = APIRouter(tags=["catalog"])


@router.get("/locations")
async def locations():
    hospitals = await db.hospitals.find({}, {"_id": 0, "city": 1}).to_list(1000)
    counts = {}
    for h in hospitals:
        counts[h["city"]] = counts.get(h["city"], 0) + 1
    return [{"city": c, "hospital_count": n} for c, n in sorted(counts.items())]


@router.get("/specializations")
async def specializations(location: str | None = None):
    specs = await db.specializations.find({}, {"_id": 0}).to_list(100)
    query = {}
    if location:
        hospital_ids = [h["id"] for h in await db.hospitals.find({"city": location}, {"_id": 0, "id": 1}).to_list(1000)]
        query["hospital_id"] = {"$in": hospital_ids}
    docs = await db.doctors.find(query, {"_id": 0, "specialization_id": 1}).to_list(5000)
    counts = {}
    for d in docs:
        counts[d["specialization_id"]] = counts.get(d["specialization_id"], 0) + 1
    result = [{**s, "doctor_count": counts.get(s["id"], 0)} for s in specs]
    if location:
        result = [s for s in result if s["doctor_count"] > 0]
    return result


@router.get("/hospitals")
async def hospitals(location: str | None = None, specialization: str | None = None):
    query = {"city": location} if location else {}
    hs = await db.hospitals.find(query, {"_id": 0}).to_list(1000)
    dq = {"hospital_id": {"$in": [h["id"] for h in hs]}}
    if specialization:
        dq["specialization_id"] = specialization
    docs = await db.doctors.find(dq, {"_id": 0, "hospital_id": 1}).to_list(5000)
    counts = {}
    for d in docs:
        counts[d["hospital_id"]] = counts.get(d["hospital_id"], 0) + 1
    result = [{**h, "doctor_count": counts.get(h["id"], 0)} for h in hs]
    if specialization:
        result = [h for h in result if h["doctor_count"] > 0]
    return result


async def _lookup_maps():
    hs = {h["id"]: h for h in await db.hospitals.find({}, {"_id": 0}).to_list(1000)}
    ss = {s["id"]: s for s in await db.specializations.find({}, {"_id": 0}).to_list(100)}
    return hs, ss


def _next_available(doctor: dict, booked: set):
    start = date.fromisoformat(today_str())
    for i in range(14):
        d = (start + timedelta(days=i)).isoformat()
        for t in generate_slots(doctor.get("availability", []), d):
            if (d, t) in booked or is_past_slot(d, t):
                continue
            return {"date": d, "time": t}
    return None


async def enrich_doctors(docs: list) -> list:
    hs, ss = await _lookup_maps()
    ids = [d["id"] for d in docs]
    appts = await db.appointments.find({"doctor_id": {"$in": ids}, "date": {"$gte": today_str()},
                                        "status": {"$in": ACTIVE_STATUSES}},
                                       {"_id": 0, "doctor_id": 1, "date": 1, "time": 1}).to_list(10000)
    booked = {}
    for a in appts:
        booked.setdefault(a["doctor_id"], set()).add((a["date"], a["time"]))
    out = []
    for d in docs:
        h = hs.get(d["hospital_id"], {})
        s = ss.get(d["specialization_id"], {})
        out.append({**d, "hospital_name": h.get("name", ""), "city": h.get("city", ""),
                    "hospital_area": h.get("area", ""), "specialization_name": s.get("name", ""),
                    "next_available": _next_available(d, booked.get(d["id"], set()))})
    return out


@router.get("/doctors")
async def list_doctors(location: str | None = None, specialization: str | None = None,
                       hospital: str | None = None, sort: str = "rating", q: str | None = None):
    query = {}
    if hospital:
        query["hospital_id"] = hospital
    elif location:
        ids = [h["id"] for h in await db.hospitals.find({"city": location}, {"_id": 0, "id": 1}).to_list(1000)]
        query["hospital_id"] = {"$in": ids}
    if specialization:
        query["specialization_id"] = specialization
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.doctors.find(query, {"_id": 0}).to_list(500)
    enriched = await enrich_doctors(docs)
    if sort == "fee_asc":
        enriched.sort(key=lambda d: d["fee"])
    elif sort == "experience":
        enriched.sort(key=lambda d: -d["experience"])
    else:
        enriched.sort(key=lambda d: (-d.get("rating", 0), -d.get("review_count", 0)))
    return enriched


@router.get("/doctors/{doctor_id}")
async def get_doctor(doctor_id: str):
    doc = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    enriched = (await enrich_doctors([doc]))[0]
    reviews = await db.reviews.find({"doctor_id": doctor_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    hospital = await db.hospitals.find_one({"id": doc["hospital_id"]}, {"_id": 0})
    return {**enriched, "reviews": reviews, "hospital": hospital}


@router.get("/doctors/{doctor_id}/slots")
async def doctor_slots(doctor_id: str, date_: str = Query(alias="date")):
    doc = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    booked = {a["time"] for a in await db.appointments.find(
        {"doctor_id": doctor_id, "date": date_, "status": {"$in": ACTIVE_STATUSES}}, {"_id": 0, "time": 1}).to_list(500)}
    slots = [{"time": t, "available": t not in booked and not is_past_slot(date_, t)}
             for t in generate_slots(doc.get("availability", []), date_)]
    return {"date": date_, "slots": slots}
