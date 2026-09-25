import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, FileText, Star, Download, RotateCcw, XCircle } from "lucide-react";
import { api, errMsg, fmtDate, fmtTime, inr, todayISO } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { QueueTokenCard } from "@/components/QueueTokenCard";
import { RecordsPanel } from "@/components/RecordsPanel";
import { SlotPicker } from "@/components/SlotPicker";
import { StatusBadge, PageHeader, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ACTIVE = ["confirmed", "checked_in", "in_progress"];

function AppointmentRow({ a, onCancel, onReschedule, onReview, onViewRx }) {
  const upcoming = ACTIVE.includes(a.status);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4" data-testid={`appointment-row-${a.id}`}>
      <img src={a.doctor_image} alt="" className="h-14 w-14 rounded-xl object-cover bg-slate-100" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2"><span className="font-display font-bold text-slate-900">Dr. {a.doctor_name}</span><StatusBadge status={a.status} /></div>
        <div className="text-sm text-slate-500">{a.specialization_name} · {a.hospital_name}</div>
        <div className="text-sm text-slate-700 mt-1 flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-teal-600" /> {fmtDate(a.date)} · {fmtTime(a.time)} · Token #{a.token_number} · {inr(a.fee)}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {upcoming && <Button size="sm" variant="outline" className="rounded-full" onClick={() => onReschedule(a)} data-testid={`reschedule-button-${a.id}`}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reschedule</Button>}
        {upcoming && <Button size="sm" variant="outline" className="rounded-full text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => onCancel(a)} data-testid={`cancel-button-${a.id}`}><XCircle className="h-3.5 w-3.5 mr-1" /> Cancel</Button>}
        {a.prescription_id && <Button size="sm" variant="outline" className="rounded-full" onClick={() => onViewRx(a.prescription_id)} data-testid={`view-rx-button-${a.id}`}><FileText className="h-3.5 w-3.5 mr-1" /> Prescription</Button>}
        {a.status === "completed" && !a.reviewed && <Button size="sm" className="rounded-full bg-amber-500 hover:bg-amber-600" onClick={() => onReview(a)} data-testid={`review-button-${a.id}`}><Star className="h-3.5 w-3.5 mr-1" /> Rate</Button>}
      </div>
    </div>
  );
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState([]);
  const [rxs, setRxs] = useState([]);
  const [resched, setResched] = useState(null);
  const [slot, setSlot] = useState({ date: "", time: "" });
  const [review, setReview] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [rxView, setRxView] = useState(null);

  const load = useCallback(() => {
    api.get("/appointments/me").then((r) => setAppts(r.data));
    api.get("/prescriptions/me").then((r) => setRxs(r.data));
  }, []);
  useEffect(load, [load]);

  const today = todayISO();
  const todayAppt = appts.find((a) => a.date === today && ACTIVE.includes(a.status));
  const upcoming = appts.filter((a) => ACTIVE.includes(a.status) && a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = appts.filter((a) => !upcoming.includes(a));

  const cancel = async (a) => {
    try { await api.patch(`/appointments/${a.id}/cancel`); toast.success("Appointment cancelled"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const doReschedule = async () => {
    try { await api.patch(`/appointments/${resched.id}/reschedule`, slot); toast.success("Rescheduled"); setResched(null); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const submitReview = async () => {
    try { await api.post("/reviews", { appointment_id: review.id, rating, comment }); toast.success("Thanks for your review!"); setReview(null); setComment(""); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const openRx = async (id) => { const { data } = await api.get(`/prescriptions/${id}`); setRxView(data); };
  const downloadPdf = async (id) => {
    const res = await api.get(`/prescriptions/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank");
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="patient-dashboard">
      <PageHeader eyebrow="Patient portal" title={`Hello, ${user.name.split(" ")[0]}`} subtitle="Your appointments, live queue and prescriptions in one place.">
        <Button className="rounded-full bg-teal-600 hover:bg-teal-700" onClick={() => navigate("/doctors")} data-testid="book-new-button">Book new appointment</Button>
      </PageHeader>
      {todayAppt && <div className="mb-8"><QueueTokenCard appointment={todayAppt} onChanged={load} /></div>}
      <Tabs defaultValue="appointments">
        <TabsList className="rounded-full bg-slate-100 p-1">
          <TabsTrigger value="appointments" className="rounded-full" data-testid="tab-appointments">Appointments</TabsTrigger>
          <TabsTrigger value="prescriptions" className="rounded-full" data-testid="tab-prescriptions">Prescriptions ({rxs.length})</TabsTrigger>
          <TabsTrigger value="records" className="rounded-full" data-testid="tab-records">Medical records</TabsTrigger>
        </TabsList>
        <TabsContent value="records" className="mt-6"><RecordsPanel patientId={user.id} /></TabsContent>
        <TabsContent value="appointments" className="mt-6 space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">Upcoming</h2>
            {upcoming.length === 0 ? <EmptyState title="No upcoming appointments" hint="Find a specialist and book a slot." testId="upcoming-empty" /> : <div className="space-y-3" data-testid="upcoming-list">{upcoming.map((a) => <AppointmentRow key={a.id} a={a} onCancel={cancel} onReschedule={(x) => { setResched(x); setSlot({ date: x.date, time: "" }); }} onReview={setReview} onViewRx={openRx} />)}</div>}
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-slate-900 mb-3">History</h2>
            {past.length === 0 ? <EmptyState title="No past visits yet" testId="history-empty" /> : <div className="space-y-3" data-testid="history-list">{past.map((a) => <AppointmentRow key={a.id} a={a} onCancel={cancel} onReschedule={setResched} onReview={setReview} onViewRx={openRx} />)}</div>}
          </section>
        </TabsContent>
        <TabsContent value="prescriptions" className="mt-6">
          {rxs.length === 0 ? <EmptyState title="No prescriptions yet" testId="rx-empty" /> : (
            <div className="grid md:grid-cols-2 gap-4" data-testid="prescriptions-list">
              {rxs.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5" data-testid={`rx-card-${r.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-display font-bold text-slate-900">{r.diagnosis || "Prescription"}</div><div className="text-sm text-slate-500">Dr. {r.doctor_name} · {r.hospital_name}</div><div className="text-xs text-slate-400 mt-0.5">{fmtDate(r.appointment_date)}</div></div>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadPdf(r.id)} data-testid={`rx-pdf-button-${r.id}`}><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">{r.medicines.map((m, i) => <li key={i} className="flex justify-between"><span className="text-slate-800 font-medium">{m.name}</span><span className="text-slate-500">{m.dosage} · {m.frequency} · {m.duration}</span></li>)}</ul>
                  {r.notes && <p className="text-xs text-slate-500 mt-3 whitespace-pre-line">{r.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!resched} onOpenChange={(o) => !o && setResched(null)}>
        <DialogContent className="max-w-lg" data-testid="reschedule-dialog">
          <DialogHeader><DialogTitle>Reschedule with Dr. {resched?.doctor_name}</DialogTitle></DialogHeader>
          {resched && <SlotPicker doctorId={resched.doctor_id} value={slot} onChange={setSlot} />}
          <Button disabled={!slot.time} onClick={doReschedule} className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="reschedule-confirm-button">Confirm new slot</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-md" data-testid="review-dialog">
          <DialogHeader><DialogTitle>Rate Dr. {review?.doctor_name}</DialogTitle></DialogHeader>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} data-testid={`rating-star-${n}`}><Star className={`h-8 w-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} /></button>)}</div>
          <Textarea placeholder="How was your visit?" value={comment} onChange={(e) => setComment(e.target.value)} data-testid="review-comment-input" />
          <Button onClick={submitReview} className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="review-submit-button">Submit review</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rxView} onOpenChange={(o) => !o && setRxView(null)}>
        <DialogContent className="max-w-lg" data-testid="rx-dialog">
          <DialogHeader><DialogTitle>Prescription · {rxView?.diagnosis}</DialogTitle></DialogHeader>
          {rxView && (
            <div className="text-sm space-y-3">
              <div className="text-slate-500">Dr. {rxView.doctor_name} · {rxView.specialization_name} · {fmtDate(rxView.appointment_date)}</div>
              <ul className="space-y-1">{rxView.medicines.map((m, i) => <li key={i} className="flex justify-between border-b border-slate-100 pb-1"><span className="font-medium">{m.name}</span><span className="text-slate-500">{m.dosage} · {m.frequency} · {m.duration}</span></li>)}</ul>
              {rxView.notes && <p className="text-slate-600 whitespace-pre-line">{rxView.notes}</p>}
              {rxView.follow_up && <p className="text-slate-600"><b>Follow-up:</b> {rxView.follow_up}</p>}
              <Button variant="outline" className="rounded-full" onClick={() => downloadPdf(rxView.id)} data-testid="rx-dialog-pdf-button"><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
