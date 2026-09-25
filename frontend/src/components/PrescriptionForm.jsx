import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const empty = () => ({ name: "", dosage: "", frequency: "", duration: "" });

export function PrescriptionForm({ appointment, onDone }) {
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [meds, setMeds] = useState([empty()]);
  const [saving, setSaving] = useState(false);

  const update = (i, k, v) => setMeds((m) => m.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));

  const submit = async () => {
    const medicines = meds.filter((m) => m.name.trim());
    if (!medicines.length) return toast.error("Add at least one medicine");
    setSaving(true);
    try {
      await api.post("/prescriptions", { appointment_id: appointment.id, diagnosis, medicines, notes, follow_up: followUp });
      toast.success("Prescription issued and consultation completed");
      onDone?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="prescription-form">
      <div className="text-sm text-slate-500">Patient: <span className="font-semibold text-slate-900">{appointment.patient_name}</span> · Token #{appointment.token_number} · {appointment.reason || "No reason given"}</div>
      <Input placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} data-testid="prescription-diagnosis-input" />
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider text-slate-400 font-semibold px-1">
          <span className="col-span-4">Medicine</span><span className="col-span-2">Dosage</span><span className="col-span-3">Frequency</span><span className="col-span-2">Duration</span>
        </div>
        {meds.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Input className="col-span-4" placeholder="Paracetamol 650mg" value={m.name} onChange={(e) => update(i, "name", e.target.value)} data-testid={`med-name-${i}`} />
            <Input className="col-span-2" placeholder="1 tab" value={m.dosage} onChange={(e) => update(i, "dosage", e.target.value)} data-testid={`med-dosage-${i}`} />
            <Input className="col-span-3" placeholder="Twice daily" value={m.frequency} onChange={(e) => update(i, "frequency", e.target.value)} data-testid={`med-frequency-${i}`} />
            <Input className="col-span-2" placeholder="5 days" value={m.duration} onChange={(e) => update(i, "duration", e.target.value)} data-testid={`med-duration-${i}`} />
            <button className="col-span-1 grid place-items-center text-slate-400 hover:text-rose-600" onClick={() => setMeds((x) => x.filter((_, idx) => idx !== i))} disabled={meds.length === 1} data-testid={`med-remove-${i}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setMeds((m) => [...m, empty()])} data-testid="med-add-button"><Plus className="h-4 w-4 mr-1" /> Add medicine</Button>
      </div>
      <Textarea placeholder="Advice / notes for the patient" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="prescription-notes-input" />
      <Input placeholder="Follow-up (e.g. after 7 days)" value={followUp} onChange={(e) => setFollowUp(e.target.value)} data-testid="prescription-followup-input" />
      <Button className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={saving} data-testid="prescription-form-submit">
        {saving ? "Issuing…" : "Issue prescription & complete visit"}
      </Button>
    </div>
  );
}
