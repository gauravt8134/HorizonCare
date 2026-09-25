import { useEffect, useState } from "react";
import { MapPin, Stethoscope, Building2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ALL = "__all__";

export function SearchChain({ value, onChange, onSearch, compact = false }) {
  const [locations, setLocations] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const { location = "", specialization = "", hospital = "" } = value;

  useEffect(() => { api.get("/locations").then((r) => setLocations(r.data)); }, []);
  useEffect(() => {
    api.get("/specializations", { params: location ? { location } : {} }).then((r) => setSpecs(r.data));
  }, [location]);
  useEffect(() => {
    const params = {};
    if (location) params.location = location;
    if (specialization) params.specialization = specialization;
    api.get("/hospitals", { params }).then((r) => setHospitals(r.data));
  }, [location, specialization]);

  const set = (k, v) => {
    const next = { ...value, [k]: v === ALL ? "" : v };
    if (k === "location") { next.specialization = ""; next.hospital = ""; }
    if (k === "specialization") next.hospital = "";
    onChange(next);
  };

  const Field = ({ icon: Icon, label, children }) => (
    <div className="flex-1 min-w-0">
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-teal-700 mb-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      {children}
    </div>
  );

  return (
    <div className={`flex flex-col ${compact ? "gap-4" : "md:flex-row gap-4 md:items-end"}`} data-testid="search-chain">
      <Field icon={MapPin} label="Location">
        <Select value={location || ALL} onValueChange={(v) => set("location", v)}>
          <SelectTrigger className="h-11 rounded-xl bg-white" data-testid="search-location-select"><SelectValue placeholder="Any city" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any city</SelectItem>
            {locations.map((l) => <SelectItem key={l.city} value={l.city} data-testid={`location-option-${l.city}`}>{l.city} · {l.hospital_count} hospitals</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field icon={Stethoscope} label="Specialization">
        <Select value={specialization || ALL} onValueChange={(v) => set("specialization", v)}>
          <SelectTrigger className="h-11 rounded-xl bg-white" data-testid="search-specialization-select"><SelectValue placeholder="Any specialization" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any specialization</SelectItem>
            {specs.map((s) => <SelectItem key={s.id} value={s.id} data-testid={`specialization-option-${s.name}`}>{s.name} · {s.doctor_count}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field icon={Building2} label="Hospital">
        <Select value={hospital || ALL} onValueChange={(v) => set("hospital", v)}>
          <SelectTrigger className="h-11 rounded-xl bg-white" data-testid="search-hospital-select"><SelectValue placeholder="Any hospital" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any hospital</SelectItem>
            {hospitals.map((h) => <SelectItem key={h.id} value={h.id} data-testid={`hospital-option-${h.id}`}>{h.name} · {h.doctor_count}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {onSearch && (
        <Button className="h-11 rounded-xl bg-teal-600 hover:bg-teal-700 px-6" onClick={onSearch} data-testid="search-submit-button">
          <Search className="h-4 w-4 mr-2" /> Find doctors
        </Button>
      )}
    </div>
  );
}
