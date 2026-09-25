import { useEffect, useState } from "react";
import { CalendarDays, IndianRupee, UserX, Users, Download, Stethoscope, Building2 } from "lucide-react";
import { api, fmtDate, fmtTime, inr, todayISO } from "@/lib/api";
import { StatCard, StatusBadge, PageHeader, EmptyState } from "@/components/shared";
import { Panel, AppointmentsChart, RevenueChart, DemandChart, Heatmap } from "@/components/admin/Charts";
import { DoctorRoster } from "@/components/admin/DoctorRoster";
import { HospitalManager } from "@/components/admin/HospitalManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AppointmentsTable() {
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/admin/appointments", { params: date ? { date } : {} }).then((r) => setRows(r.data)); }, [date]);
  return (
    <div data-testid="admin-appointments">
      <div className="flex items-center gap-3 mb-4"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" data-testid="admin-appointments-date" /><Button variant="outline" size="sm" className="rounded-full" onClick={() => setDate("")} data-testid="admin-appointments-all">All dates</Button><span className="text-sm text-slate-500">{rows.length} records</span></div>
      {rows.length === 0 ? <EmptyState title="No appointments for this filter" testId="admin-appointments-empty" /> : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-3">When</th><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3">Doctor</th><th className="text-left px-4 py-3 hidden lg:table-cell">Hospital</th><th className="text-left px-4 py-3">Fee</th><th className="text-left px-4 py-3">Status</th></tr></thead>
          <tbody>{rows.map((a) => <tr key={a.id} className="border-t border-slate-100" data-testid={`admin-appt-row-${a.id}`}><td className="px-4 py-3 whitespace-nowrap">{fmtDate(a.date)} · {fmtTime(a.time)} <span className="text-slate-400 font-mono text-xs">#{a.token_number}</span></td><td className="px-4 py-3">{a.patient_name}</td><td className="px-4 py-3">Dr. {a.doctor_name} <span className="text-xs text-slate-400">{a.specialization_name}</span></td><td className="px-4 py-3 hidden lg:table-cell text-slate-600">{a.hospital_name}</td><td className="px-4 py-3">{inr(a.fee)}</td><td className="px-4 py-3"><StatusBadge status={a.status} /></td></tr>)}</tbody>
        </table></div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/analytics").then((r) => setData(r.data)); }, []);

  const exportCsv = async () => {
    const res = await api.get("/admin/export/appointments.csv", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = "appointments.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return <div className="max-w-7xl mx-auto px-8 py-10 grid grid-cols-4 gap-5">{[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  const k = data.kpis;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="admin-dashboard">
      <PageHeader eyebrow="Hospital network admin" title="Operations overview" subtitle={`${k.hospitals} hospitals · ${k.doctors} doctors · ${k.patients} registered patients`}>
        <Button variant="outline" className="rounded-full" onClick={exportCsv} data-testid="export-csv-button"><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
      </PageHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Appointments today" value={k.today_appointments} hint={`${k.today_waiting} waiting in queues`} icon={CalendarDays} testId="kpi-today" />
        <StatCard label="Last 14 days" value={k.window_appointments} hint={`${inr(k.window_revenue)} revenue`} accent="border-sky-500" icon={Users} testId="kpi-window" />
        <StatCard label="Total revenue" value={inr(k.revenue)} hint="Completed consultations" accent="border-emerald-500" icon={IndianRupee} testId="kpi-revenue" />
        <StatCard label="No-show rate" value={`${k.no_show_rate}%`} hint="Of finished appointments" accent="border-rose-500" icon={UserX} testId="kpi-noshow" />
      </div>
      <Tabs defaultValue="analytics">
        <TabsList className="rounded-full bg-slate-100 p-1">
          <TabsTrigger value="analytics" className="rounded-full" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="doctors" className="rounded-full" data-testid="tab-doctors">Doctor roster</TabsTrigger>
          <TabsTrigger value="hospitals" className="rounded-full" data-testid="tab-hospitals">Hospitals</TabsTrigger>
          <TabsTrigger value="appointments" className="rounded-full" data-testid="tab-admin-appointments">Appointments</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics" className="mt-6 space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Panel title="Appointments per day" subtitle="Last 14 days" className="lg:col-span-2" testId="chart-appointments"><AppointmentsChart data={data.per_day} /></Panel>
            <Panel title="Daily revenue" subtitle="Completed visits" testId="chart-revenue"><RevenueChart data={data.per_day} /></Panel>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Panel title="Peak-hour heatmap" subtitle="Appointment density by weekday & hour" className="lg:col-span-2" testId="chart-heatmap"><Heatmap rows={data.heatmap} hours={data.hours} /></Panel>
            <Panel title="Specialization demand" subtitle="All-time bookings" testId="chart-demand"><DemandChart data={data.specialization_demand} /></Panel>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Panel title="Doctor performance" subtitle="Consultations, ratings, revenue & commission (70%)" className="lg:col-span-2" testId="doctor-performance-table">
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="text-left py-2">Doctor</th><th className="text-right py-2">Visits</th><th className="text-right py-2">No-shows</th><th className="text-right py-2">Rating</th><th className="text-right py-2">Revenue</th><th className="text-right py-2">Commission</th></tr></thead>
                <tbody>{data.doctor_performance.map((d) => <tr key={d.doctor_id} className="border-t border-slate-100" data-testid={`perf-row-${d.doctor_id}`}><td className="py-2.5"><div className="font-medium text-slate-900">Dr. {d.name}</div><div className="text-xs text-slate-400">{d.specialization} · {d.hospital}</div></td><td className="text-right tabular-nums">{d.consultations}</td><td className="text-right tabular-nums text-rose-600">{d.no_shows}</td><td className="text-right tabular-nums">{d.rating}</td><td className="text-right tabular-nums font-medium">{inr(d.revenue)}</td><td className="text-right tabular-nums text-slate-500">{inr(d.commission)}</td></tr>)}</tbody>
              </table></div>
            </Panel>
            <Panel title="Hospital demand" subtitle="Bookings by facility" testId="hospital-demand">
              <div className="space-y-3">{data.hospital_demand.map((h, i) => { const max = data.hospital_demand[0]?.count || 1; return (
                <div key={h.name}><div className="flex justify-between text-sm"><span className="font-medium text-slate-800 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-teal-600" />{h.name}</span><span className="tabular-nums text-slate-500">{h.count}</span></div><div className="h-2 rounded-full bg-slate-100 mt-1.5"><div className="h-2 rounded-full bg-teal-600" style={{ width: `${(h.count / max) * 100}%` }} /></div><div className="text-[11px] text-slate-400 mt-0.5">{h.city}</div></div>
              ); })}</div>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="doctors" className="mt-6"><DoctorRoster /></TabsContent>
        <TabsContent value="hospitals" className="mt-6"><HospitalManager /></TabsContent>
        <TabsContent value="appointments" className="mt-6"><AppointmentsTable /></TabsContent>
      </Tabs>
    </main>
  );
}
