import { useEffect, useState } from "react";
import { Ticket, Timer, Users, CheckCircle2 } from "lucide-react";
import { api, errMsg, fmtTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function QueueTokenCard({ appointment, onChanged }) {
  const [q, setQ] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.get(`/appointments/${appointment.id}/queue`).then((r) => alive && setQ(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [appointment.id]);

  const checkin = async () => {
    try {
      await api.post(`/appointments/${appointment.id}/checkin`);
      toast.success("Checked in. You're in the live queue.");
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const status = q?.status || appointment.status;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-6 shadow-xl" data-testid="patient-queue-token-card">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/20 blur-2xl" />
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-teal-200 text-xs font-semibold uppercase tracking-widest"><Ticket className="h-4 w-4" /> Today's live queue</div>
        <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-teal-200 text-xs">Your token</div>
          <div className="font-display text-5xl font-extrabold leading-none mt-1" data-testid="queue-my-token">#{appointment.token_number}</div>
        </div>
        <div>
          <div className="text-teal-200 text-xs">Now serving</div>
          <div className="font-display text-5xl font-extrabold leading-none mt-1 text-emerald-300" data-testid="queue-now-serving">#{q?.now_serving ?? "–"}</div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm"><Users className="h-4 w-4 text-teal-300" /> <span data-testid="queue-position">{q ? `${q.position} ahead of you` : "…"}</span></div>
          <div className="flex items-center gap-1.5 text-sm"><Timer className="h-4 w-4 text-teal-300" /> <span data-testid="queue-wait">~{q?.estimated_wait_minutes ?? "–"} min wait</span></div>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-teal-100">Dr. {appointment.doctor_name} · {appointment.hospital_name} · {fmtTime(appointment.time)}</div>
        {status === "confirmed" && <Button size="sm" onClick={checkin} className="rounded-full bg-white text-teal-800 hover:bg-teal-50" data-testid="queue-checkin-button">I've arrived — check in</Button>}
        {status === "checked_in" && <span className="flex items-center gap-1.5 text-emerald-300 font-medium" data-testid="queue-checked-in-badge"><CheckCircle2 className="h-4 w-4" /> Checked in</span>}
        {status === "in_progress" && <span className="flex items-center gap-1.5 text-emerald-300 font-semibold animate-pulse" data-testid="queue-your-turn-badge">It's your turn — please proceed</span>}
      </div>
    </div>
  );
}
