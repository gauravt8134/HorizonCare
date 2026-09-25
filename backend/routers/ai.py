import os
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from emergentintegrations.llm.chat import LlmChat, UserMessage
from core import db, new_id, now_iso

router = APIRouter(prefix="/ai", tags=["ai"])


class SymptomIn(BaseModel):
    symptoms: str


class FaqIn(BaseModel):
    message: str
    history: list[dict] = []


FAQ_SYSTEM = ("You are the HorizonCare help assistant. HorizonCare lets patients find doctors across partner hospitals in "
              "Mumbai, Pune and Bengaluru (filter by city → specialization → hospital → doctor), book time slots, check in to a "
              "live queue with a token number, receive digital prescriptions (PDF), upload medical records, and rate doctors. "
              "Appointments can be rescheduled or cancelled from the patient dashboard; doctors set weekly hours; email reminders "
              "go out 24h and 1h before a visit. Answer ONLY questions about using HorizonCare or which medical specialization "
              "fits a described concern. You must never diagnose, name conditions, or suggest treatments or medicines — if asked, "
              "say you can only help pick a specialization and they should see a doctor. Keep answers under 80 words, friendly, plain text.")


@router.post("/faq")
async def faq(body: FaqIn):
    text = body.message.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    context = "\n".join(f"{m.get('role', 'user')}: {m.get('content', '')}" for m in body.history[-6:])
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"faq-{new_id()}",
                   system_message=FAQ_SYSTEM).with_model("anthropic", "claude-sonnet-4-6")
    prompt = f"Conversation so far:\n{context}\n\nuser: {text}" if context else text
    try:
        reply = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service unavailable: {e}")
    await db.ai_queries.insert_one({"id": new_id(), "kind": "faq", "message": text, "reply": reply, "created_at": now_iso()})
    return {"reply": reply.strip()}


@router.post("/symptom-check")
async def symptom_check(body: SymptomIn):
    text = body.symptoms.strip()
    if len(text) < 5:
        raise HTTPException(status_code=400, detail="Please describe your symptoms in a little more detail")
    specs = [s["name"] for s in await db.specializations.find({}, {"_id": 0, "name": 1}).to_list(100)]
    system = ("You are a triage assistant for HorizonCare, a hospital appointment platform in India. "
              "Given patient symptoms, recommend up to 3 medical specializations strictly from this list: "
              f"{', '.join(specs)}. Never diagnose. Respond ONLY with JSON: "
              '{"suggestions":[{"specialization":"<name from list>","reason":"<one sentence>","confidence":"high|medium|low"}],'
              '"urgency":"routine|soon|urgent","advice":"<one short sentence of general guidance>"}')
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"symptom-{new_id()}",
                   system_message=system).with_model("anthropic", "claude-sonnet-4-6")
    try:
        raw = await chat.send_message(UserMessage(text=f"Symptoms: {text}"))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service unavailable: {e}")
    match = re.search(r"\{.*\}", raw, re.S)
    try:
        data = json.loads(match.group(0) if match else raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned an unreadable response")
    spec_map = {s["name"]: s["id"] for s in await db.specializations.find({}, {"_id": 0}).to_list(100)}
    for s in data.get("suggestions", []):
        s["specialization_id"] = spec_map.get(s.get("specialization"))
    data["disclaimer"] = "This is assistive guidance only and not a medical diagnosis. Please consult a doctor."
    await db.ai_queries.insert_one({"id": new_id(), "symptoms": text, "result": data, "created_at": now_iso()})
    return data
