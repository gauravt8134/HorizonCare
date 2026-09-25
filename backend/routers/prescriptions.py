from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from core import db, new_id, now_iso, get_current_user, require_role, audit

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


class Medicine(BaseModel):
    name: str
    dosage: str = ""
    frequency: str = ""
    duration: str = ""


class PrescriptionIn(BaseModel):
    appointment_id: str
    diagnosis: str = ""
    medicines: list[Medicine]
    notes: str = ""
    follow_up: str = ""


async def _enrich(rx: dict) -> dict:
    doctor = await db.doctors.find_one({"id": rx["doctor_id"]}, {"_id": 0})
    patient = await db.users.find_one({"id": rx["patient_id"]}, {"_id": 0, "password_hash": 0})
    hospital = await db.hospitals.find_one({"id": doctor["hospital_id"]}, {"_id": 0}) if doctor else None
    spec = await db.specializations.find_one({"id": doctor["specialization_id"]}, {"_id": 0}) if doctor else None
    appt = await db.appointments.find_one({"id": rx["appointment_id"]}, {"_id": 0})
    return {**rx, "doctor_name": doctor["name"] if doctor else "", "doctor_qualification": doctor.get("qualification", "") if doctor else "",
            "specialization_name": spec["name"] if spec else "", "hospital_name": hospital["name"] if hospital else "",
            "hospital_address": hospital.get("address", "") if hospital else "",
            "patient_name": patient["name"] if patient else "", "appointment_date": appt["date"] if appt else "",
            "appointment_time": appt["time"] if appt else ""}


@router.post("", status_code=201)
async def create(body: PrescriptionIn, user: dict = Depends(require_role("doctor"))):
    doctor = await db.doctors.find_one({"user_id": user["id"]}, {"_id": 0})
    appt = await db.appointments.find_one({"id": body.appointment_id}, {"_id": 0})
    if not appt or not doctor or appt["doctor_id"] != doctor["id"]:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if await db.prescriptions.find_one({"appointment_id": appt["id"]}):
        raise HTTPException(status_code=400, detail="Prescription already issued for this appointment")
    rx = {"id": new_id(), "appointment_id": appt["id"], "doctor_id": doctor["id"], "patient_id": appt["patient_id"],
          "diagnosis": body.diagnosis.strip(), "medicines": [m.model_dump() for m in body.medicines],
          "notes": body.notes.strip(), "follow_up": body.follow_up.strip(), "created_at": now_iso()}
    await db.prescriptions.insert_one(rx)
    await db.appointments.update_one({"id": appt["id"]}, {"$set": {"status": "completed", "updated_at": now_iso()}})
    await audit(user["id"], "issue", "prescription", rx["id"])
    rx.pop("_id", None)
    return await _enrich(rx)


@router.get("/me")
async def mine(user: dict = Depends(require_role("patient"))):
    rows = await db.prescriptions.find({"patient_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [await _enrich(r) for r in rows]


async def _load(rx_id: str, user: dict) -> dict:
    rx = await db.prescriptions.find_one({"id": rx_id}, {"_id": 0})
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if user["role"] == "patient" and rx["patient_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if user["role"] == "doctor":
        doctor = await db.doctors.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        if not doctor or doctor["id"] != rx["doctor_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    await audit(user["id"], "view", "prescription", rx_id)
    return rx


@router.get("/{rx_id}")
async def get_one(rx_id: str, user: dict = Depends(get_current_user)):
    return await _enrich(await _load(rx_id, user))


@router.get("/{rx_id}/pdf")
async def pdf(rx_id: str, user: dict = Depends(get_current_user)):
    rx = await _enrich(await _load(rx_id, user))
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFillColor(colors.HexColor("#0D9488"))
    c.rect(0, h - 90, w, 90, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(40, h - 45, "HorizonCare")
    c.setFont("Helvetica", 11)
    c.drawString(40, h - 65, rx["hospital_name"])
    c.drawRightString(w - 40, h - 45, f"Prescription #{rx['id'][:8].upper()}")
    c.drawRightString(w - 40, h - 65, f"Date: {rx['appointment_date']}  {rx['appointment_time']}")
    c.setFillColor(colors.HexColor("#0F172A"))
    y = h - 130
    c.setFont("Helvetica-Bold", 13)
    c.drawString(40, y, f"Dr. {rx['doctor_name']}")
    c.setFont("Helvetica", 10)
    c.drawString(40, y - 15, f"{rx['specialization_name']}  |  {rx['doctor_qualification']}")
    c.drawString(40, y - 30, rx["hospital_address"])
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(w - 40, y, "Patient")
    c.setFont("Helvetica", 10)
    c.drawRightString(w - 40, y - 15, rx["patient_name"])
    y -= 60
    c.setStrokeColor(colors.HexColor("#E2E8F0"))
    c.line(40, y, w - 40, y)
    y -= 25
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Diagnosis")
    c.setFont("Helvetica", 10)
    c.drawString(140, y, rx["diagnosis"] or "-")
    y -= 35
    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, y, "Rx")
    y -= 25
    c.setFillColor(colors.HexColor("#F1F5F9"))
    c.rect(40, y - 5, w - 80, 20, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 10)
    for x, label in ((48, "Medicine"), (250, "Dosage"), (350, "Frequency"), (460, "Duration")):
        c.drawString(x, y, label)
    y -= 22
    c.setFont("Helvetica", 10)
    for m in rx["medicines"]:
        c.drawString(48, y, m["name"][:32])
        c.drawString(250, y, m["dosage"][:16])
        c.drawString(350, y, m["frequency"][:18])
        c.drawString(460, y, m["duration"][:16])
        y -= 18
    y -= 15
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Advice / Notes")
    c.setFont("Helvetica", 10)
    y -= 16
    for line in (rx["notes"] or "-").split("\n"):
        c.drawString(40, y, line[:100])
        y -= 14
    if rx["follow_up"]:
        y -= 8
        c.setFont("Helvetica-Bold", 10)
        c.drawString(40, y, f"Follow-up: {rx['follow_up']}")
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawString(40, 40, "Digitally issued via HorizonCare. This prescription is valid with the issuing doctor's registration.")
    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="prescription-{rx_id[:8]}.pdf"'})
