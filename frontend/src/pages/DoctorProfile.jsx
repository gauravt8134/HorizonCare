import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Star, Building2, MapPin, Phone, BriefcaseMedical, CalendarCheck2 } from "lucide-react";
import { api, errMsg, fmtDate, fmtTime, inr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { SlotPicker } from "@/components/SlotPicker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DoctorProfile() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [slot, setSlot] = useState({ date: "", time: "" });
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { api.get(`/doctors/${id}`).then((r) => setDoc(r.data)); }, [id]);

  const book = async () => {
    if (!user) return navigate("/login", { state: { from: `/doctors/${id}` } });
    if (user.role !== "patient") return toast.error("Only patients can book appointments");
    setBooking(true);
    try {
      await api.post("/appointments", { doctor_id: id, date: slot.date, time: slot.time, reason });
      toast.success(`Booked with Dr. ${doc.name} on ${fmtDate(slot.date)} at ${fmtTime(slot.time)}`);
      navigate("/patient");
    } catch (e) {
      toast.error(errMsg(e));
      setSlot({ date: slot.date, time: "" });
    } finally {
      setBooking(false);
    }
  };

  if (!doc) return <div className="max-w-7xl mx-auto px-8 py-10"><div className="h-64 rounded-3xl bg-slate-100 animate-pulse" /></div>;

  const grouped = DAYS.map((d, i) => ({ d, ranges: (doc.availability || []).filter((a) => a.day === i) }));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="doctor-profile-page">
      <div className="grid lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
            <img src={doc.image} alt={doc.name} className="h-36 w-36 rounded-3xl object-cover bg-slate-100" />
            <div className="flex-1">
              <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">{doc.specialization_name}</span>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 mt-2" data-testid="doctor-name">Dr. {doc.name}</h1>
              <p className="text-slate-500">{doc.qualification}</p>
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> <b className="text-slate-900">{doc.rating}</b> ({doc.review_count} reviews)</span>
                <span className="flex items-center gap-1.5"><BriefcaseMedical className="h-4 w-4 text-teal-600" /> {doc.experience} years</span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-900">{inr(doc.fee)} <span className="text-slate-400 font-normal">/ visit</span></span>
              </div>
              <p className="text-sm text-slate-600 mt-4 leading-relaxed">{doc.bio}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-teal-700 mb-3">Hospital</div>
              <div className="font-display font-bold text-slate-900 flex items-center gap-2"><Building2 className="h-4 w-4 text-teal-600" />{doc.hospital?.name}</div>
              <div className="text-sm text-slate-500 mt-2 flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" />{doc.hospital?.address}</div>
              <div className="text-sm text-slate-500 mt-1 flex items-center gap-2"><Phone className="h-4 w-4" />{doc.hospital?.contact}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-teal-700 mb-3">Weekly hours</div>
              <ul className="space-y-1.5 text-sm">
                {grouped.map(({ d, ranges }) => (
                  <li key={d} className="flex justify-between"><span className="text-slate-500 w-10">{d}</span><span className={ranges.length ? "text-slate-800 font-medium" : "text-slate-300"}>{ranges.length ? ranges.map((r) => `${fmtTime(r.start)}–${fmtTime(r.end)}`).join(", ") : "Closed"}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-teal-700 mb-4">Patient reviews</div>
            {doc.reviews.length === 0 ? <p className="text-sm text-slate-500">No reviews yet.</p> : (
              <div className="space-y-4" data-testid="doctor-reviews">
                {doc.reviews.slice(0, 6).map((r) => (
                  <div key={r.id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between"><span className="font-semibold text-slate-800 text-sm">{r.patient_name}</span><span className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</span></div>
                    <p className="text-sm text-slate-600 mt-1">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <aside className="lg:col-span-5">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 lg:sticky lg:top-24" data-testid="booking-panel">
            <div className="flex items-center gap-2 mb-4"><CalendarCheck2 className="h-5 w-5 text-teal-600" /><h2 className="font-display text-lg font-bold text-slate-900">Book an appointment</h2></div>
            <SlotPicker doctorId={id} value={slot} onChange={setSlot} />
            <Textarea className="mt-4 rounded-xl" rows={2} placeholder="Reason for visit (optional)" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="booking-reason-input" />
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
              <div><div className="text-xs text-slate-500">{slot.time ? `${fmtDate(slot.date)} · ${fmtTime(slot.time)}` : "Select a slot"}</div><div className="font-display font-bold text-slate-900">{inr(doc.fee)}</div></div>
              <Button disabled={!slot.time || booking} onClick={book} className="rounded-full bg-teal-600 hover:bg-teal-700 px-6" data-testid="confirm-booking-button">
                {booking ? "Booking…" : user ? "Confirm booking" : "Sign in to book"}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
