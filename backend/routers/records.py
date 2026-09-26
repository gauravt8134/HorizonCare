import os
import logging
import boto3
from botocore.exceptions import ClientError
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from core import db, new_id, now_iso, get_current_user, audit

logger = logging.getLogger("horizoncare.records")
router = APIRouter(prefix="/records", tags=["records"])

APP_NAME = "horizoncare"
ALLOWED = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_BYTES = 10 * 1024 * 1024
RECORD_TYPES = ["Lab report", "Imaging / scan", "Discharge summary", "Prescription (external)", "Vaccination", "Other"]

fernet = Fernet(os.environ["RECORDS_ENCRYPTION_KEY"].encode())

s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    region_name=os.environ.get("AWS_REGION", "ap-south-1"),
)
S3_BUCKET = os.environ["AWS_S3_BUCKET"]


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    try:
        s3_client.put_object(Bucket=S3_BUCKET, Key=path, Body=data, ContentType=content_type)
        return {"path": path}
    except ClientError as e:
        raise Exception(f"S3 upload failed: {e}")


async def get_object(path: str) -> bytes:
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=path)
        return response["Body"].read()
    except ClientError as e:
        raise Exception(f"S3 download failed: {e}")


def enc(s: str) -> str:
    return fernet.encrypt(s.encode()).decode()


def dec(s: str) -> str:
    return fernet.decrypt(s.encode()).decode()


async def can_access(user: dict, patient_id: str) -> bool:
    if user["role"] == "admin" or (user["role"] == "patient" and user["id"] == patient_id):
        return True
    if user["role"] == "doctor":
        doctor = await db.doctors.find_one({"user_id": user["id"]}, {"_id": 0, "id": 1})
        return bool(doctor and await db.appointments.find_one({"doctor_id": doctor["id"], "patient_id": patient_id}))
    return False


def public(r: dict, uploader_names: dict) -> dict:
    return {"id": r["id"], "patient_id": r["patient_id"], "record_type": r["record_type"], "content_type": r["content_type"],
            "size": r["size"], "filename": dec(r["filename_enc"]), "notes": dec(r["notes_enc"]) if r.get("notes_enc") else "",
            "uploaded_by": r["uploaded_by"], "uploaded_by_name": uploader_names.get(r["uploaded_by"], ""),
            "uploaded_by_role": r["uploaded_by_role"], "created_at": r["created_at"], "encrypted": True}


@router.get("/types")
async def types():
    return RECORD_TYPES


@router.post("", status_code=201)
async def upload(file: UploadFile = File(...), record_type: str = Form("Other"), notes: str = Form(""),
                 patient_id: str | None = Form(None), user: dict = Depends(get_current_user)):
    target = user["id"] if user["role"] == "patient" else patient_id
    if not target or not await can_access(user, target):
        raise HTTPException(status_code=403, detail="You cannot add records for this patient")
    ctype = file.content_type or "application/octet-stream"
    if ctype not in ALLOWED:
        raise HTTPException(status_code=400, detail="Only PDF, JPG, PNG or WebP files are allowed")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")
    rec_id = new_id()
    path = f"{APP_NAME}/records/{target}/{rec_id}.bin"
    try:
        result = await put_object(path, fernet.encrypt(data), "application/octet-stream")
    except Exception as e:
        logger.error(f"storage upload failed: {e}")
        raise HTTPException(status_code=502, detail="Storage service unavailable, please retry")
    rec = {"id": rec_id, "patient_id": target, "record_type": record_type if record_type in RECORD_TYPES else "Other",
           "content_type": ctype, "size": len(data), "storage_path": result["path"],
           "filename_enc": enc(file.filename or f"record.{ALLOWED[ctype]}"), "notes_enc": enc(notes.strip()) if notes.strip() else None,
           "uploaded_by": user["id"], "uploaded_by_role": user["role"], "is_deleted": False, "created_at": now_iso()}
    await db.medical_records.insert_one(rec)
    await audit(user["id"], "upload", "medical_record", rec_id)
    return public(rec, {user["id"]: user["name"]})


async def _list(patient_id: str, user: dict):
    if not await can_access(user, patient_id):
        raise HTTPException(status_code=403, detail="Access denied")
    rows = await db.medical_records.find({"patient_id": patient_id, "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)
    ids = list({r["uploaded_by"] for r in rows})
    names = {u["id"]: u["name"] for u in await db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}
    await audit(user["id"], "list", "medical_record", patient_id)
    return [public(r, names) for r in rows]


@router.get("/me")
async def my_records(user: dict = Depends(get_current_user)):
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    return await _list(user["id"], user)


@router.get("/patient/{patient_id}")
async def patient_records(patient_id: str, user: dict = Depends(get_current_user)):
    return await _list(patient_id, user)


@router.get("/{rec_id}/download")
async def download(rec_id: str, user: dict = Depends(get_current_user)):
    rec = await db.medical_records.find_one({"id": rec_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    if not await can_access(user, rec["patient_id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        data = fernet.decrypt(await get_object(rec["storage_path"]))
    except Exception as e:
        logger.error(f"storage download failed: {e}")
        raise HTTPException(status_code=502, detail="Storage service unavailable, please retry")
    await audit(user["id"], "download", "medical_record", rec_id)
    return Response(content=data, media_type=rec["content_type"],
                    headers={"Content-Disposition": f'inline; filename="{dec(rec["filename_enc"])}"'})


@router.delete("/{rec_id}")
async def delete(rec_id: str, user: dict = Depends(get_current_user)):
    rec = await db.medical_records.find_one({"id": rec_id, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    if not (user["role"] == "admin" or rec["uploaded_by"] == user["id"] or (user["role"] == "patient" and rec["patient_id"] == user["id"])):
        raise HTTPException(status_code=403, detail="Access denied")
    await db.medical_records.update_one({"id": rec_id}, {"$set": {"is_deleted": True, "deleted_at": now_iso(), "deleted_by": user["id"]}})
    await audit(user["id"], "delete", "medical_record", rec_id)
    return {"ok": True}


@router.get("/{rec_id}/audit")
async def record_audit(rec_id: str, user: dict = Depends(get_current_user)):
    rec = await db.medical_records.find_one({"id": rec_id}, {"_id": 0})
    if not rec or not await can_access(user, rec["patient_id"]):
        raise HTTPException(status_code=404, detail="Record not found")
    logs = await db.audit_logs.find({"resource": "medical_record", "resource_id": rec_id}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    ids = list({l["user_id"] for l in logs})
    names = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "name": 1, "role": 1}).to_list(200)}
    return [{**l, "user_name": names.get(l["user_id"], {}).get("name", ""), "user_role": names.get(l["user_id"], {}).get("role", "")} for l in logs]