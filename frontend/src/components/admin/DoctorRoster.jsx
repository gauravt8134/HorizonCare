import { useEffect, useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { api, errMsg, inr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const blank = { name: "", email: "", password: "doctor123", hospital_id: "", specialization_id: "", experience: 5, fee: 500, qualification: "MBBS, MD", image: "" };

export function DoctorRoster() {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);

  const load = () => api.get("/admin/doctors").then((r) => setDoctors(r.data));
  useEffect(() => {
    load();
    api.get("/hospitals").then((r) => setHospitals(r.data));
    api.get("/specializations").then((r) => setSpecs(r.data));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const create = async () => {
    try {
      await api.post("/admin/doctors", { ...form, experience: Number(form.experience), fee: Number(form.fee) });
      toast.success("Doctor onboarded");
      setOpen(false);
      setForm(blank);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (d) => {
    if (!window.confirm(`Remove Dr. ${d.name} from the roster?`)) return;
    try { await api.delete(`/admin/doctors/${d.id}`); toast.success("Doctor removed"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="doctor-roster">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">{doctors.length} doctors across {hospitals.length} hospitals</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full bg-teal-600 hover:bg-teal-700" data-testid="add-doctor-button"><Plus className="h-4 w-4 mr-1.5" /> Onboard doctor</Button></DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="add-doctor-dialog">
            <DialogHeader><DialogTitle>Onboard a doctor</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Full name</Label><Input value={form.name} onChange={set("name")} placeholder="Asha Verma" data-testid="doctor-form-name" /></div>
              <div><Label>Login email</Label><Input value={form.email} onChange={set("email")} placeholder="dr.asha@horizoncare.com" data-testid="doctor-form-email" /></div>
              <div><Label>Temp password</Label><Input value={form.password} onChange={set("password")} data-testid="doctor-form-password" /></div>
              <div><Label>Hospital</Label>
                <Select value={form.hospital_id} onValueChange={set("hospital_id")}><SelectTrigger data-testid="doctor-form-hospital"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{hospitals.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Specialization</Label>
                <Select value={form.specialization_id} onValueChange={set("specialization_id")}><SelectTrigger data-testid="doctor-form-specialization"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{specs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Experience (yrs)</Label><Input type="number" value={form.experience} onChange={set("experience")} data-testid="doctor-form-experience" /></div>
              <div><Label>Fee (₹)</Label><Input type="number" value={form.fee} onChange={set("fee")} data-testid="doctor-form-fee" /></div>
              <div className="col-span-2"><Label>Qualification</Label><Input value={form.qualification} onChange={set("qualification")} data-testid="doctor-form-qualification" /></div>
              <div className="col-span-2"><Label>Photo URL (optional)</Label><Input value={form.image} onChange={set("image")} data-testid="doctor-form-image" /></div>
            </div>
            <Button onClick={create} disabled={!form.name || !form.email || !form.hospital_id || !form.specialization_id} className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="doctor-form-submit">Create doctor account</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-3">Doctor</th><th className="text-left px-4 py-3 hidden md:table-cell">Specialization</th><th className="text-left px-4 py-3 hidden lg:table-cell">Hospital</th><th className="text-left px-4 py-3">Fee</th><th className="text-left px-4 py-3">Rating</th><th className="px-4 py-3" /></tr></thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`roster-row-${d.id}`}>
                <td className="px-4 py-3"><div className="flex items-center gap-3">{d.image ? <img src={d.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-700 grid place-items-center font-bold">{d.name[0]}</div>}<div><div className="font-medium text-slate-900">Dr. {d.name}</div><div className="text-xs text-slate-400">{d.email} · {d.experience} yrs</div></div></div></td>
                <td className="px-4 py-3 hidden md:table-cell">{d.specialization_name}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-600">{d.hospital_name}</td>
                <td className="px-4 py-3 font-medium">{inr(d.fee)}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{d.rating} <span className="text-slate-400 text-xs">({d.review_count})</span></span></td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(d)} data-testid={`remove-doctor-${d.id}`}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
