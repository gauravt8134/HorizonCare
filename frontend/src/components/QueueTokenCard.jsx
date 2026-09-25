import { useEffect, useRef, useState } from "react";
import { Ticket, Timer, Users, CheckCircle2, Bell, BellOff } from "lucide-react";
import { api, errMsg, fmtTime } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = [660, 880, 1100][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.55);
    });
  } catch { /* audio not available */ }
}

function notifyBrowser(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* ignore */ }
  }
}

export function QueueTokenCard({ appointment, onChanged }) {
  const [q, setQ] = useState(null);
  const [alerts, setAlerts] = useState(() => localStorage.getItem("hc_queue_alerts") === "on");
  const prev = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.get(`/appointments/${appointment.id}/queue`).then((r) => alive && setQ(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [appointment.id]);

  useEffect(() => {
    if (!q) return;
    const p = prev.current;
    prev.current = q;
    if (!p || !alerts) return;
    if (q.status === "in_progress" && p.status !== "in_progress") {
      chime();
      notifyBrowser("It's your turn!", `Token #${q.token_number} — please proceed to Dr. ${appointment.doctor_name}.`);
      toast.success("It's your turn — please proceed to the consultation room.");
    } else if (q.position === 1 && p.position > 1) {
      chime();
      notifyBrowser("You're next", `Token #${q.token_number} is next in line for Dr. ${appointment.doctor_name}.`);
      toast("You're next in line — please stay close to the consultation room.");
    }
  }, [q, alerts, appointment.doctor_name]);

  const toggleAlerts = async () => {
    if (alerts) {
      setAlerts(false);
      localStorage.setItem("hc_queue_alerts", "off");
      return;
    }
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission().catch(() => {});
    chime();
    setAlerts(true);
    localStorage.setItem("hc_queue_alerts", "on");
    toast.success("Queue alerts on — you'll hear a chime when your token is called.");
  };

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
        <div className="flex items-center gap-3">
          <button onClick={toggleAlerts} className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-colors ${alerts ? "bg-emerald-400/20 border-emerald-300/40 text-emerald-200" : "bg-white/5 border-white/15 text-teal-100 hover:bg-white/10"}`} data-testid="queue-alerts-toggle">
            {alerts ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />} {alerts ? "Alerts on" : "Enable alerts"}
          </button>
          <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live</span>
        </div>
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
