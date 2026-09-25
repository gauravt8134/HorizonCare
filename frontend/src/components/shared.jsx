import { STATUS_STYLES } from "@/lib/api";

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.cancelled}`} data-testid={`status-badge-${status}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function StatCard({ label, value, hint, accent = "border-teal-500", icon: Icon, testId }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${accent} p-5 shadow-sm`} data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <div className="font-display text-3xl font-extrabold text-slate-900 mt-2 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-widest text-teal-700 mb-1">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint, testId }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center" data-testid={testId}>
      <div className="font-semibold text-slate-700">{title}</div>
      {hint && <div className="text-sm text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
