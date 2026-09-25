import { Fragment } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#0D9488", "#0284C7", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899"];

export function Panel({ title, subtitle, children, testId, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 ${className}`} data-testid={testId}>
      <div className="mb-4"><div className="font-display font-bold text-slate-900">{title}</div>{subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}</div>
      {children}
    </div>
  );
}

export function AppointmentsChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -20, right: 8 }}>
        <defs><linearGradient id="teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0D9488" stopOpacity={0.35} /><stop offset="100%" stopColor="#0D9488" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
        <Area type="monotone" dataKey="appointments" stroke="#0D9488" strokeWidth={2.5} fill="url(#teal)" name="Appointments" />
        <Area type="monotone" dataKey="completed" stroke="#0284C7" strokeWidth={2} fill="transparent" name="Completed" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
        <Tooltip formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`} contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
        <Bar dataKey="revenue" fill="#10B981" radius={[6, 6, 0, 0]} name="Revenue" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DemandChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 24 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#334155" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Appointments" label={{ position: "right", fontSize: 11, fill: "#64748B" }}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Heatmap({ rows, hours }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div className="overflow-x-auto" data-testid="admin-analytics-heatmap">
      <div className="grid gap-1 min-w-[560px]" style={{ gridTemplateColumns: `44px repeat(${hours.length}, minmax(0, 1fr))` }}>
        <div />
        {hours.map((h) => <div key={h} className="text-[10px] text-slate-400 text-center font-mono">{h.split(":")[0]}</div>)}
        {rows.map((r) => (
          <Fragment key={r.day}>
            <div className="text-xs font-semibold text-slate-600 flex items-center">{r.day}</div>
            {r.values.map((v, i) => (
              <div key={`${r.day}-${i}`} title={`${r.day} ${hours[i]}: ${v} appointments`} className="h-8 rounded-md transition-transform hover:scale-105"
                style={{ backgroundColor: v === 0 ? "#F1F5F9" : `rgba(13,148,136,${0.15 + 0.85 * (v / max)})` }} data-testid={`heatmap-cell-${r.day}-${i}`} />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400"><span>Low</span><div className="h-2 w-24 rounded-full bg-gradient-to-r from-slate-100 to-teal-600" /><span>High</span><span className="ml-auto">8 AM – 8 PM · all-time load</span></div>
    </div>
  );
}
