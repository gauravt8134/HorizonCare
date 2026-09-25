import os
import hmac
import asyncio
from datetime import datetime, date, time, timedelta
from fastapi import APIRouter, Request, HTTPException
from core import db, IST, local_now, now_iso
from notifications import notify
from routers.appointments import enrich_appointments

router = APIRouter(prefix="/cron", tags=["cron"])


def _authorized(request: Request) -> bool:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return False
    return hmac.compare_digest(header[7:], os.environ["WEBHOOK_CRON_SECRET"])


async def run_reminders() -> dict:
    now = local_now()
    today = now.date()
    dates = [today.isoformat(), (today + timedelta(days=1)).isoformat()]
    appts = await db.appointments.find({"date": {"$in": dates}, "status": {"$in": ["confirmed", "checked_in"]}},
                                       {"_id": 0}).to_list(5000)
    sent = {"reminder_24h": 0, "reminder_1h": 0}
    for a in appts:
        slot = datetime.combine(date.fromisoformat(a["date"]), time.fromisoformat(a["time"])).replace(tzinfo=IST)
        mins = (slot - now).total_seconds() / 60
        if mins <= 0:
            continue
        kind = None
        if mins <= 60 and not a.get("reminder_1h_sent"):
            kind = "reminder_1h"
        elif 75 < mins <= 1440 and not a.get("reminder_24h_sent"):
            kind = "reminder_24h"
        if not kind:
            continue
        flag = "reminder_1h_sent" if kind == "reminder_1h" else "reminder_24h_sent"
        claimed = await db.appointments.update_one({"id": a["id"], flag: {"$ne": True}}, {"$set": {flag: True, f"{flag}_at": now_iso()}})
        if not claimed.modified_count:
            continue
        enriched = (await enrich_appointments([a]))[0]
        await notify(kind, enriched)
        sent[kind] += 1
    return sent


@router.post("/reminders")
async def reminders(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    if not _authorized(request):
        raise HTTPException(status_code=401, detail="Unauthorized")
    run_id = request.headers.get("X-Webhook-Id") or f"manual-{now_iso()}"
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"status": "duplicate", "run_id": run_id}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "reminders", "started_at": now_iso()})

    async def work():
        try:
            result = await run_reminders()
            await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"finished_at": now_iso(), "result": result}})
        except Exception as e:
            await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"finished_at": now_iso(), "error": str(e)[:300]}})

    asyncio.create_task(work())
    return {"status": "accepted", "run_id": run_id}
