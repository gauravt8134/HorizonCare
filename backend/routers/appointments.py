from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from core import (db, new_id, now_iso, get_current_user, require_role, ACTIVE_STATUSES, generate_slots,
                  is_past_slot, slot_duration_for, today_str, audit)

router = APIRouter(tags=["appointments"])


class BookIn(BaseModel):
    doctor_id: str
    date: str
    time: str
    reason: str = ""


class RescheduleIn(BaseModel):
    date: str
    time: str


class StatusIn(BaseModel):
    status: str


class ReviewIn(BaseModel):
    appointment_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""


async def _next_token(doctor_id: str, date_: str) -> int:
    rec = await db.counters.find_one_and_update({"_id": f"{doctor_id}:{date_}"}, {"$inc": {"seq": 1}},
                                                upsert=True, return_document=ReturnDocument.AFTER)
    return int(rec["seq"])


async def enrich_appointments(appts: list) -> list:
    if not appts:
        return []
    doc_ids = list({a["doctor_id"] for a in appts})
    pat_ids = list({a["patient_id"] for a in appts})
    docs = {d["id"]: d for d in await db.doctors.find({"id": {"$in": doc_ids}}, {"_id": 0}).to_list(1000)}
    hs = {h["id"]: h for h in await db.hospitals.find({}, {"_id": 0}).to_list(1000)}
    ss = {s["id"]: s for s in await db.specializations.find({}, {"_id": 0}).to_list(100)}
    pats = {p["id"]: p for p in await db.users.find({"id": {"$in": pat_ids}}, {"_id": 0, "password_hash": 0}).to_list(5000)}
    rx = {r["appointment_id"]: r["id"] for r in await db.prescriptions.find(
        {"appointment_id": {"$in": [a["id"] for a in appts]}}, {"_id": 0, "appointment_id": 1, "id": 1}).to_list(5000)}
    rv = {r["appointment_id"] for r in await db.reviews.find(
        {"appointment_id": {"$in": [a["id"] for a in appts]}}, {"_id": 0, "appointment_id": 1}).to_list(5000)}
    out = []
    for a in appts:
        d = docs.get(a["doctor_id"], {})
        p = pats.get(a["patient_id"], {})
        out.append({**a, "doctor_name": d.get("name", ""), "doctor_image": d.get("image", ""),
                    "specialization_name": ss.get(d.get("specialization_id"), {}).get("name", ""),
                    "hospital_name": hs.get(a["hospital_id"], {}).get("name", ""),
                    "patient_name": p.get("name", ""), "patient_email": p.get("email", ""),
                    "prescription_id": rx.get(a["id"]), "reviewed": a["id"] in rv})
    return out


@router.post("/appointments", status_code=201)
async def book(body: BookIn, user: dict = Depends(require_role("patient"))):
    doctor = await db.doctors.find_one({"id": body.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if body.time not in generate_slots(doctor.get("availability", []), body.date):
        raise HTTPException(status_code=400, detail="Doctor is not available at this slot")
    if is_past_slot(body.date, body.time):
        raise HTTPException(status_code=400, detail="Cannot book a slot in the past")
    token = await _next_token(body.doctor_id, body.date)
    appt = {"id": new_id(), "patient_id": user["id"], "doctor_id": body.doctor_id, "hospital_id": doctor["hospital_id"],
            "date": body.date, "time": body.time, "status": "confirmed", "reason": body.reason.strip(),
            "token_number": token, "fee": doctor["fee"], "created_at": now_iso()}
    try:
        await db.appointments.insert_one(appt)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="This slot was just booked by someone else. Please pick another.")
    await audit(user["id"], "book", "appointment", appt["id"])
    appt.pop("_id", None)
    return (await enrich_appointments([appt]))[0]


@router.get("/appointments/me")
async def my_appointments(user: dict = Depends(require_role("patient"))):
    appts = await db.appointments.find({"patient_id": user["id"]}, {"_id": 0}).sort([("date", -1), ("time", -1)]).to_list(500)
    return await enrich_appointments(appts)


@router.get("/appointments/doctor")
async def doctor_appointments(date: str | None = None, user: dict = Depends(require_role("doctor"))):
    doctor = await db.doctors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    query = {"doctor_id": doctor["id"]}
    if date:
        query["date"] = date
    appts = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("token_number", 1)]).to_list(1000)
    return await enrich_appointments(appts)


async def _load_appt(appt_id: str, user: dict) -> dict:
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if user["role"] == "patient" and appt["patient_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if user["role"] == "doctor":
        doctor = await db.doctors.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not doctor or doctor["id"] != appt["doctor_id"]:
            raise HTTPException(status_code=403, detail="Not your appointment")
    return appt


@router.patch("/appointments/{appt_id}/cancel")
async def cancel(appt_id: str, user: dict = Depends(get_current_user)):
    appt = await _load_appt(appt_id, user)
    if appt["status"] not in ACTIVE_STATUSES:
        raise HTTPException(status_code=400, detail="Appointment cannot be cancelled")
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": "cancelled", "cancelled_by": user["role"],
                                                                 "updated_at": now_iso()}})
    await audit(user["id"], "cancel", "appointment", appt_id)
    return {"ok": True, "status": "cancelled"}


@router.patch("/appointments/{appt_id}/reschedule")
async def reschedule(appt_id: str, body: RescheduleIn, user: dict = Depends(get_current_user)):
    appt = await _load_appt(appt_id, user)
    if appt["status"] not in ACTIVE_STATUSES:
        raise HTTPException(status_code=400, detail="Appointment cannot be rescheduled")
    doctor = await db.doctors.find_one({"id": appt["doctor_id"]}, {"_id": 0})
    if body.time not in generate_slots(doctor.get("availability", []), body.date):
        raise HTTPException(status_code=400, detail="Doctor is not available at this slot")
    if is_past_slot(body.date, body.time):
        raise HTTPException(status_code=400, detail="Cannot reschedule to the past")
    token = await _next_token(appt["doctor_id"], body.date)
    try:
        await db.appointments.update_one({"id": appt_id}, {"$set": {"date": body.date, "time": body.time,
                                                                     "token_number": token, "status": "confirmed",
                                                                     "rescheduled_by": user["role"], "updated_at": now_iso()}})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Slot already booked")
    await audit(user["id"], "reschedule", "appointment", appt_id)
    return {"ok": True, "date": body.date, "time": body.time, "token_number": token}


@router.patch("/appointments/{appt_id}/status")
async def set_status(appt_id: str, body: StatusIn, user: dict = Depends(require_role("doctor", "admin"))):
    if body.status not in ["checked_in", "in_progress", "completed", "no_show", "confirmed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    appt = await _load_appt(appt_id, user)
    if body.status == "in_progress":
        await db.appointments.update_many({"doctor_id": appt["doctor_id"], "date": appt["date"], "status": "in_progress"},
                                          {"$set": {"status": "completed", "updated_at": now_iso()}})
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    await audit(user["id"], f"status:{body.status}", "appointment", appt_id)
    return {"ok": True, "status": body.status}


@router.post("/appointments/{appt_id}/checkin")
async def checkin(appt_id: str, user: dict = Depends(require_role("patient"))):
    appt = await _load_appt(appt_id, user)
    if appt["status"] != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed appointments can be checked in")
    await db.appointments.update_one({"id": appt_id}, {"$set": {"status": "checked_in", "checked_in_at": now_iso()}})
    return {"ok": True, "status": "checked_in"}


async def queue_snapshot(doctor_id: str, date_: str) -> dict:
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    appts = await db.appointments.find({"doctor_id": doctor_id, "date": date_,
                                        "status": {"$in": ACTIVE_STATUSES + ["completed"]}},
                                       {"_id": 0}).sort("token_number", 1).to_list(500)
    serving = next((a for a in appts if a["status"] == "in_progress"), None)
    completed = [a for a in appts if a["status"] == "completed"]
    now_serving = serving["token_number"] if serving else (max(a["token_number"] for a in completed) if completed else 0)
    waiting = [a for a in appts if a["status"] in ("confirmed", "checked_in")]
    return {"doctor_id": doctor_id, "date": date_, "now_serving": now_serving, "waiting_count": len(waiting),
            "completed_count": len(completed), "slot_duration": slot_duration_for(doctor.get("availability", []), date_),
            "appointments": appts}


@router.get("/appointments/{appt_id}/queue")
async def appointment_queue(appt_id: str, user: dict = Depends(get_current_user)):
    appt = await _load_appt(appt_id, user)
    snap = await queue_snapshot(appt["doctor_id"], appt["date"])
    ahead = [a for a in snap["appointments"] if a["token_number"] < appt["token_number"]
             and a["status"] in ACTIVE_STATUSES]
    return {"appointment_id": appt_id, "token_number": appt["token_number"], "status": appt["status"],
            "now_serving": snap["now_serving"], "position": len(ahead),
            "estimated_wait_minutes": len(ahead) * snap["slot_duration"], "date": appt["date"], "time": appt["time"]}


@router.get("/queue/doctor/{doctor_id}")
async def doctor_queue(doctor_id: str, date: str | None = None, user: dict = Depends(get_current_user)):
    snap = await queue_snapshot(doctor_id, date or today_str())
    snap["appointments"] = await enrich_appointments(snap["appointments"])
    return snap


@router.post("/reviews", status_code=201)
async def add_review(body: ReviewIn, user: dict = Depends(require_role("patient"))):
    appt = await _load_appt(body.appointment_id, user)
    if appt["status"] != "completed":
        raise HTTPException(status_code=400, detail="You can review only after the consultation is completed")
    if await db.reviews.find_one({"appointment_id": appt["id"]}):
        raise HTTPException(status_code=400, detail="Already reviewed")
    review = {"id": new_id(), "doctor_id": appt["doctor_id"], "patient_id": user["id"], "patient_name": user["name"],
              "appointment_id": appt["id"], "rating": body.rating, "comment": body.comment.strip(), "created_at": now_iso()}
    await db.reviews.insert_one(review)
    all_reviews = await db.reviews.find({"doctor_id": appt["doctor_id"]}, {"_id": 0, "rating": 1}).to_list(10000)
    avg = round(sum(r["rating"] for r in all_reviews) / len(all_reviews), 1)
    await db.doctors.update_one({"id": appt["doctor_id"]}, {"$set": {"rating": avg, "review_count": len(all_reviews)}})
    review.pop("_id", None)
    return review
