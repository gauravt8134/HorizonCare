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
