import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Clock3, Building2, Stethoscope, ArrowRight, CalendarCheck2, Ticket, FileText } from "lucide-react";
import { SearchChain } from "@/components/SearchChain";
import { SymptomChecker } from "@/components/SymptomChecker";
import { useEffect } from "react";
import { api } from "@/lib/api";

const HERO_IMG = "https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const STEPS = [
  { icon: Stethoscope, title: "Pick location & specialty", text: "Filters narrow dynamically — city → specialization → hospital → doctor." },
  { icon: CalendarCheck2, title: "Book a live slot", text: "Real-time availability with no double-booking, guaranteed at the database layer." },
  { icon: Ticket, title: "Track your queue token", text: "See who's being served and your estimated wait, live on your phone." },
  { icon: FileText, title: "Get a digital prescription", text: "Download PDF prescriptions and keep your medical records in one place." },
];

export default function Landing() {
  const [filters, setFilters] = useState({ location: "", specialization: "", hospital: "" });
  const [hospitals, setHospitals] = useState([]);
  const [specs, setSpecs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/hospitals").then((r) => setHospitals(r.data));
    api.get("/specializations").then((r) => setSpecs(r.data));
  }, []);

  const search = () => {
    const p = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
    navigate(`/doctors?${p.toString()}`);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8" data-testid="landing-page">
      <section className="relative mt-4 rounded-3xl overflow-hidden border border-teal-100/60 bg-gradient-to-br from-teal-50/70 via-white to-sky-50/50 p-8 sm:p-12 lg:p-16">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-teal-700 bg-white border border-teal-100 px-3 py-1.5 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" /> Multi-hospital care network
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900 mt-5">
              The right doctor,<br />across <span className="text-teal-600">every hospital</span> near you.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 mt-5 max-w-xl leading-relaxed">
              Discover specialists, book real-time slots, track your live queue token and keep every prescription in one secure place.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {[[`${hospitals.length || 6}+ partner hospitals`, Building2], ["17+ verified doctors", Stethoscope], ["<12 min avg queue", Clock3]].map(([t, I]) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white/80 border border-slate-200 px-3 py-1.5 rounded-full"><I className="h-3.5 w-3.5 text-teal-600" /> {t}</span>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <img src={HERO_IMG} alt="Modern hospital" className="rounded-3xl object-cover w-full h-72 lg:h-96 shadow-xl" />
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-lg border border-slate-100 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><Ticket className="h-5 w-5" /></div>
              <div><div className="text-xs text-slate-500">Now serving</div><div className="font-display font-extrabold text-slate-900 text-lg leading-none">Token #12</div></div>
            </div>
          </div>
        </div>
        <div className="mt-10 bg-white rounded-2xl border border-slate-200 shadow-lg p-5 sm:p-6" data-testid="hero-search-card">
          <SearchChain value={filters} onChange={setFilters} onSearch={search} />
        </div>
      </section>

      <section className="grid lg:grid-cols-12 gap-8 py-16 sm:py-20">
        <div className="lg:col-span-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-700">How it works</div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-2">From symptom to prescription, in four steps.</h2>
          <div className="mt-8 space-y-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-teal-50 text-teal-700 grid place-items-center"><s.icon className="h-5 w-5" /></div>
                <div><div className="font-semibold text-slate-900"><span className="text-teal-600 font-mono text-xs mr-2">0{i + 1}</span>{s.title}</div><p className="text-sm text-slate-500 mt-0.5">{s.text}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7"><SymptomChecker /></div>
      </section>

      <section className="pb-16">
        <div className="flex items-end justify-between mb-6">
          <div><div className="text-xs font-semibold uppercase tracking-widest text-teal-700">Specializations</div><h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">Browse by specialty</h2></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {specs.map((s) => (
            <button key={s.id} onClick={() => navigate(`/doctors?specialization=${s.id}`)} className="text-left rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300 hover:shadow-md transition-all group" data-testid={`spec-tile-${s.name}`}>
              <div className="font-display font-bold text-slate-900 group-hover:text-teal-700">{s.name}</div>
              <div className="text-xs text-slate-500 mt-1">{s.description}</div>
              <div className="text-xs font-semibold text-teal-700 mt-3 flex items-center gap-1">{s.doctor_count} doctors <ArrowRight className="h-3 w-3" /></div>
            </button>
          ))}
        </div>
      </section>

      <section className="pb-20">
        <div className="text-xs font-semibold uppercase tracking-widest text-teal-700">Partner hospitals</div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1 mb-6">Trusted care across Mumbai, Pune & Bengaluru</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {hospitals.map((h) => (
            <button key={h.id} onClick={() => navigate(`/doctors?location=${h.city}&hospital=${h.id}`)} className="text-left rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-md hover:border-teal-300 transition-all" data-testid={`hospital-tile-${h.id}`}>
              <img src={h.image} alt={h.name} className="h-36 w-full object-cover" />
              <div className="p-4">
                <div className="font-display font-bold text-slate-900">{h.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{h.area}, {h.city} · {h.doctor_count} doctors</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
