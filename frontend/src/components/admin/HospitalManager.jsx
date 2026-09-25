import { useEffect, useState } from "react";
import { Plus, Building2, MapPin, Phone } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const blank = { name: "", city: "", area: "", address: "", contact: "", image: "" };

export function HospitalManager() {
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const load = () => api.get("/hospitals").then((r) => setHospitals(r.data));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    try {
      await api.post("/admin/hospitals", form);
      toast.success("Hospital added to the network");
      setOpen(false); setForm(blank); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div data-testid="hospital-manager">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500">{hospitals.length} hospitals in {new Set(hospitals.map((h) => h.city)).size} cities</div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-full bg-teal-600 hover:bg-teal-700" data-testid="add-hospital-button"><Plus className="h-4 w-4 mr-1.5" /> Add hospital</Button></DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="add-hospital-dialog">
            <DialogHeader><DialogTitle>Add a partner hospital</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Hospital name</Label><Input value={form.name} onChange={set("name")} data-testid="hospital-form-name" /></div>
              <div><Label>City</Label><Input value={form.city} onChange={set("city")} placeholder="Mumbai" data-testid="hospital-form-city" /></div>
              <div><Label>Area</Label><Input value={form.area} onChange={set("area")} placeholder="Bandra West" data-testid="hospital-form-area" /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={set("address")} data-testid="hospital-form-address" /></div>
              <div><Label>Contact</Label><Input value={form.contact} onChange={set("contact")} placeholder="+91 …" data-testid="hospital-form-contact" /></div>
              <div><Label>Image URL (optional)</Label><Input value={form.image} onChange={set("image")} data-testid="hospital-form-image" /></div>
            </div>
            <Button onClick={create} disabled={!form.name || !form.city} className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="hospital-form-submit">Add hospital</Button>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {hospitals.map((h) => (
          <div key={h.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`hospital-row-${h.id}`}>
            <div className="font-display font-bold text-slate-900 flex items-center gap-2"><Building2 className="h-4 w-4 text-teal-600" />{h.name}</div>
            <div className="text-sm text-slate-500 mt-2 flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{h.address || `${h.area}, ${h.city}`}</div>
            {h.contact && <div className="text-sm text-slate-500 mt-1 flex items-center gap-2"><Phone className="h-4 w-4" />{h.contact}</div>}
            <div className="text-xs font-semibold text-teal-700 mt-3">{h.doctor_count} doctors · {h.city}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
