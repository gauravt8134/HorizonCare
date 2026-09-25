import { useEffect, useState } from "react";
import { api, addDays, todayISO, fmtTime } from "@/lib/api";

const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return { wd: d.toLocaleDateString("en-IN", { weekday: "short" }), day: d.getDate(), mon: d.toLocaleDateString("en-IN", { month: "short" }) };
};

export function SlotPicker({ doctorId, value, onChange, excludeTime }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));
  const date = value.date || dates[0];

  useEffect(() => {
    setLoading(true);
    api.get(`/doctors/${doctorId}/slots`, { params: { date } }).then((r) => setSlots(r.data.slots)).finally(() => setLoading(false));
  }, [doctorId, date]);

  return (
    <div data-testid="slot-picker">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" data-testid="slot-date-picker">
        {dates.map((d) => {
          const l = dayLabel(d);
          const active = d === date;
          return (
            <button key={d} onClick={() => onChange({ date: d, time: "" })}
              className={`shrink-0 w-16 rounded-xl border py-2 text-center transition-colors ${active ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-teal-300"}`}
              data-testid={`slot-date-${d}`}>
              <div className="text-[10px] uppercase tracking-wider opacity-80">{l.wd}</div>
              <div className="font-display font-bold text-lg leading-tight">{l.day}</div>
              <div className="text-[10px] opacity-80">{l.mon}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-[80px]">
        {loading ? (
          <p className="text-sm text-slate-400">Loading slots…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4" data-testid="no-slots-message">Doctor is not available on this day. Try another date.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((s) => {
              const disabled = !s.available && s.time !== excludeTime;
              const selected = value.time === s.time;
              return (
                <button key={s.time} disabled={disabled} onClick={() => onChange({ date, time: s.time })}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${selected ? "bg-slate-900 border-slate-900 text-white" : disabled ? "bg-slate-50 border-slate-100 text-slate-300 line-through cursor-not-allowed" : "bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700"}`}
                  data-testid={`slot-time-chip-${s.time}`}>
                  {fmtTime(s.time)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
