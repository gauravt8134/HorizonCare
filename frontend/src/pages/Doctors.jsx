import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { SearchChain } from "@/components/SearchChain";
import { DoctorCard } from "@/components/DoctorCard";
import { PageHeader, EmptyState } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Doctors() {
  const [params, setParams] = useSearchParams();
  const [doctors, setDoctors] = useState(null);
  const filters = { location: params.get("location") || "", specialization: params.get("specialization") || "", hospital: params.get("hospital") || "" };
  const sort = params.get("sort") || "rating";
  const q = params.get("q") || "";

  const apply = (next) => {
    const clean = Object.fromEntries(Object.entries({ ...filters, sort, q, ...next }).filter(([, v]) => v));
    setParams(clean);
  };

  useEffect(() => {
    setDoctors(null);
    api.get("/doctors", { params: Object.fromEntries(params) }).then((r) => setDoctors(r.data));
  }, [params]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="doctors-page">
      <PageHeader eyebrow="Doctor discovery" title="Find a specialist" subtitle="Filters narrow each other — pick a city to see only its hospitals and specialties." />
      <div className="grid lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5 lg:sticky lg:top-24">
            <Input placeholder="Search doctor by name" value={q} onChange={(e) => apply({ q: e.target.value })} className="rounded-xl h-11" data-testid="doctor-search-input" />
            <SearchChain compact value={filters} onChange={apply} />
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-teal-700 mb-1.5 block">Sort by</label>
              <Select value={sort} onValueChange={(v) => apply({ sort: v })}>
                <SelectTrigger className="h-11 rounded-xl" data-testid="sort-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Top rated</SelectItem>
                  <SelectItem value="experience">Most experienced</SelectItem>
                  <SelectItem value="fee_asc">Lowest fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </aside>
        <section className="lg:col-span-9">
          {doctors === null ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{[...Array(6)].map((_, i) => <div key={i} className="h-72 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
          ) : doctors.length === 0 ? (
            <EmptyState title="No doctors match these filters" hint="Try widening the location or specialization." testId="doctors-empty" />
          ) : (
            <>
              <div className="text-sm text-slate-500 mb-4" data-testid="doctors-count">{doctors.length} doctors available</div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{doctors.map((d) => <DoctorCard key={d.id} doctor={d} />)}</div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
