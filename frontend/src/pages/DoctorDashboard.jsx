import { useCallback, useEffect, useState } from "react";
import { Play, CheckCircle2, UserX, History, Star, IndianRupee, Users, CalendarDays } from "lucide-react";
import { api, errMsg, fmtDate, fmtTime, inr, todayISO } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PrescriptionForm } from "@/components/PrescriptionForm";
import { StatCard, StatusBadge, PageHeader, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function AvailabilityEditor({ initial, onSaved }) {
  const [rows, setRows] = useState(() => DAYS.map((_, i) => {
    const a = (initial || []).find((x) => x.day === i);
    return { day: i, enabled: !!a, start: a?.start || "09:00", end: a?.end || "13:00", slot_duration: a?.slot_duration || 30 };
  }));
  const [saving, setSaving] = useState(false);
  const upd = (i, k, v) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    setSaving(true);
    try {
      const availability = rows.filter((r) => r.enabled).map(({ day, start, end, slot_duration }) => ({ day, start, end, slot_duration: Number(slot_duration) }));
      await api.put("/doctor/me/availability", { availability });
      toast.success("Availability updated");
      onSaved?.();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6" data-testid="availability-editor">
      <p className="text-sm text-slate-500 mb-4">Toggle the days you consult and set your hours. Slots are generated automatically.</p>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.day} className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-3 sm:col-span-2 flex items-center gap-3"><Switch checked={r.enabled} onCheckedChange={(v) => upd(i, "enabled", v)} data-testid={`doctor-availability-toggle-${DAYS[r.day]}`} /><span className="font-semibold text-slate-800 text-sm">{DAYS[r.day]}</span></div>
            <Input type="time" disabled={!r.enabled} value={r.start} onChange={(e) => upd(i, "start", e.target.value)} className="col-span-3" data-testid={`availability-start-${DAYS[r.day]}`} />
            <Input type="time" disabled={!r.enabled} value={r.end} onChange={(e) => upd(i, "end", e.target.value)} className="col-span-3" data-testid={`availability-end-${DAYS[r.day]}`} />
            <div className="col-span-3 sm:col-span-4 flex items-center gap-2"><Input type="number" min={10} max={120} step={5} disabled={!r.enabled} value={r.slot_duration} onChange={(e) => upd(i, "slot_duration", e.target.value)} className="w-20" data-testid={`availability-duration-${DAYS[r.day]}`} /><span className="text-xs text-slate-500 hidden sm:inline">min / slot</span></div>
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={saving} className="mt-5 rounded-full bg-teal-600 hover:bg-teal-700" data-testid="availability-save-button">{saving ? "Saving…" : "Save availability"}</Button>
    </div>
  );
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [appts, setAppts] = useState([]);
  const [rxFor, setRxFor] = useState(null);
  const [history, setHistory] = useState(null);

  const load = useCallback(() => {
    api.get("/doctor/me").then((r) => setProfile(r.data));
    api.get("/doctor/me/stats").then((r) => setStats(r.data));
    api.get("/appointments/doctor", { params: { date } }).then((r) => setAppts(r.data));
  }, [date]);
  useEffect(load, [load]);

  const setStatus = async (a, status) => {
    try { await api.patch(`/appointments/${a.id}/status`, { status }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const openHistory = async (a) => { const { data } = await api.get(`/doctor/patients/${a.patient_id}/history`); setHistory(data); };

  const serving = appts.find((a) => a.status === "in_progress");
  const waiting = appts.filter((a) => ["confirmed", "checked_in"].includes(a.status));
  const done = appts.filter((a) => ["completed", "no_show", "cancelled"].includes(a.status));
  const isToday = date === todayISO();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="doctor-dashboard">
      <PageHeader eyebrow={profile ? `${profile.specialization?.name} · ${profile.hospital?.name}` : "Doctor portal"} title={user.name} subtitle="Manage today's queue, issue prescriptions and set your weekly hours." />
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard label="Today's patients" value={stats.today_total} hint={`${stats.today_waiting} waiting · ${stats.today_completed} done`} icon={Users} testId="stat-today" />
          <StatCard label="Consultations" value={stats.total_completed} hint="All time completed" accent="border-sky-500" icon={CalendarDays} testId="stat-consultations" />
          <StatCard label="Revenue generated" value={inr(stats.total_revenue)} hint="From completed visits" accent="border-emerald-500" icon={IndianRupee} testId="stat-revenue" />
          <StatCard label="Rating" value={stats.rating} hint={`${stats.review_count} reviews`} accent="border-amber-500" icon={Star} testId="stat-rating" />
        </div>
      )}
      <Tabs defaultValue="queue">
        <TabsList className="rounded-full bg-slate-100 p-1">
          <TabsTrigger value="queue" className="rounded-full" data-testid="tab-queue">Queue & schedule</TabsTrigger>
          <TabsTrigger value="availability" className="rounded-full" data-testid="tab-availability">Availability</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" data-testid="schedule-date-input" /><span className="text-sm text-slate-500">{fmtDate(date)} · {appts.length} appointments</span></div>
            {isToday && waiting.length > 0 && <Button className="rounded-full bg-slate-900 hover:bg-slate-800" onClick={() => setStatus(waiting[0], "in_progress")} data-testid="call-next-button"><Play className="h-4 w-4 mr-1.5" /> Call next (#{waiting[0].token_number})</Button>}
          </div>
          {serving && (
            <div className="rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-6 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-testid="now-serving-card">
              <div><div className="text-teal-200 text-xs uppercase tracking-widest font-semibold">Now consulting</div><div className="font-display text-3xl font-extrabold mt-1">#{serving.token_number} · {serving.patient_name}</div><div className="text-teal-100 text-sm mt-1">{serving.reason || "No reason given"} · {fmtTime(serving.time)}</div></div>
              <div className="flex gap-2">
                <Button variant="secondary" className="rounded-full" onClick={() => openHistory(serving)} data-testid="serving-history-button"><History className="h-4 w-4 mr-1.5" /> History</Button>
                <Button className="rounded-full bg-white text-teal-800 hover:bg-teal-50" onClick={() => setRxFor(serving)} data-testid="serving-prescribe-button"><CheckCircle2 className="h-4 w-4 mr-1.5" /> Prescribe & complete</Button>
              </div>
            </div>
          )}
          {appts.length === 0 ? <EmptyState title="No appointments on this day" testId="schedule-empty" /> : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="doctor-queue-table">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-3">Token</th><th className="text-left px-4 py-3">Time</th><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3 hidden md:table-cell">Reason</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr></thead>
                <tbody>
                  {[...waiting, ...(serving ? [serving] : []), ...done].sort((a, b) => a.token_number - b.token_number).map((a) => (
                    <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`queue-row-${a.id}`}>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">#{a.token_number}</td>
                      <td className="px-4 py-3">{fmtTime(a.time)}</td>
                      <td className="px-4 py-3"><div className="font-medium text-slate-900">{a.patient_name}</div><div className="text-xs text-slate-400">{a.patient_email}</div></td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-600">{a.reason || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => openHistory(a)} data-testid={`history-button-${a.id}`}><History className="h-4 w-4" /></Button>
                          {["confirmed", "checked_in"].includes(a.status) && <>
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus(a, "in_progress")} data-testid={`start-button-${a.id}`}><Play className="h-3.5 w-3.5 mr-1" /> Start</Button>
                            <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setStatus(a, "no_show")} data-testid={`noshow-button-${a.id}`}><UserX className="h-4 w-4" /></Button>
                          </>}
                          {a.status === "in_progress" && <Button size="sm" className="rounded-full bg-teal-600 hover:bg-teal-700" onClick={() => setRxFor(a)} data-testid={`prescribe-button-${a.id}`}>Prescribe</Button>}
                          {a.status === "completed" && !a.prescription_id && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRxFor(a)} data-testid={`prescribe-button-${a.id}`}>Add Rx</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="availability" className="mt-6">
          {profile && <AvailabilityEditor initial={profile.availability} onSaved={load} />}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rxFor} onOpenChange={(o) => !o && setRxFor(null)}>
        <DialogContent className="max-w-2xl" data-testid="prescription-dialog">
          <DialogHeader><DialogTitle>Issue prescription</DialogTitle></DialogHeader>
          {rxFor && <PrescriptionForm appointment={rxFor} onDone={() => { setRxFor(null); load(); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="history-dialog">
          <DialogHeader><DialogTitle>{history?.patient?.name} · medical history</DialogTitle></DialogHeader>
          {history && (
            <div className="space-y-5 text-sm">
              <div className="text-slate-500">{history.patient.email} · {history.patient.phone || "no phone"}</div>
              <div>
                <div className="font-semibold text-slate-900 mb-2">Prescriptions ({history.prescriptions.length})</div>
                {history.prescriptions.length === 0 ? <p className="text-slate-500">None on record.</p> : history.prescriptions.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 p-3 mb-2"><div className="font-medium">{r.diagnosis || "Prescription"}</div><div className="text-xs text-slate-500">{r.medicines.map((m) => m.name).join(", ")}</div></div>
                ))}
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-2">Visits ({history.appointments.length})</div>
                <div className="space-y-1.5">{history.appointments.slice(0, 10).map((a) => <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{fmtDate(a.date)} · Dr. {a.doctor_name} · {a.reason || "—"}</span><StatusBadge status={a.status} /></div>)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
