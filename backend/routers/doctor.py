from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from core import db, require_role, today_str, now_iso
from routers.appointments import enrich_appointments

router = APIRouter(prefix="/doctor", tags=["doctor"])


class Availability(BaseModel):
    day: int = Field(ge=0, le=6)
    start: str
    end: str
    slot_duration: int = Field(default=30, ge=10, le=120)


class AvailabilityIn(BaseModel):
    availability: list[Availability]


async def _me(user: dict) -> dict:
    doctor = await db.doctors.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return doctor


@router.get("/me")
async def profile(user: dict = Depends(require_role("doctor"))):
    doctor = await _me(user)
    hospital = await db.hospitals.find_one({"id": doctor["hospital_id"]}, {"_id": 0})
    spec = await db.specializations.find_one({"id": doctor["specialization_id"]}, {"_id": 0})
    return {**doctor, "hospital": hospital, "specialization": spec}


@router.put("/me/availability")
async def set_availability(body: AvailabilityIn, user: dict = Depends(require_role("doctor"))):
    doctor = await _me(user)
    avail = [a.model_dump() for a in body.availability]
    await db.doctors.update_one({"id": doctor["id"]}, {"$set": {"availability": avail, "updated_at": now_iso()}})
    return {"ok": True, "availability": avail}


@router.get("/me/stats")
async def stats(user: dict = Depends(require_role("doctor"))):
    doctor = await _me(user)
    today = today_str()
    appts = await db.appointments.find({"doctor_id": doctor["id"]}, {"_id": 0, "status": 1, "date": 1, "fee": 1}).to_list(10000)
    todays = [a for a in appts if a["date"] == today]
    completed = [a for a in appts if a["status"] == "completed"]
    return {"today_total": len(todays), "today_completed": len([a for a in todays if a["status"] == "completed"]),
            "today_waiting": len([a for a in todays if a["status"] in ("confirmed", "checked_in")]),
            "total_completed": len(completed), "total_revenue": sum(a.get("fee", 0) for a in completed),
            "rating": doctor.get("rating", 0), "review_count": doctor.get("review_count", 0)}


@router.get("/patients/{patient_id}/history")
async def patient_history(patient_id: str, user: dict = Depends(require_role("doctor", "admin"))):
    patient = await db.users.find_one({"id": patient_id}, {"_id": 0, "password_hash": 0})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    appts = await db.appointments.find({"patient_id": patient_id}, {"_id": 0}).sort([("date", -1), ("time", -1)]).to_list(200)
    rx = await db.prescriptions.find({"patient_id": patient_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"patient": patient, "appointments": await enrich_appointments(appts), "prescriptions": rx}
