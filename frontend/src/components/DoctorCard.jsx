import { useNavigate } from "react-router-dom";
import { Star, Building2, MapPin, Clock, BriefcaseMedical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime, inr } from "@/lib/api";

export function DoctorCard({ doctor }) {
  const navigate = useNavigate();
  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all duration-200 p-5 flex flex-col gap-4" data-testid={`doctor-card-${doctor.id}`}>
      <div className="flex gap-4">
        <img src={doctor.image} alt={doctor.name} className="h-20 w-20 rounded-2xl object-cover bg-slate-100 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 mb-1">{doctor.specialization_name}</span>
          <h3 className="font-display font-bold text-slate-900 truncate">Dr. {doctor.name}</h3>
          <p className="text-xs text-slate-500 truncate">{doctor.qualification}</p>
          <div className="flex items-center gap-1 mt-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-900">{doctor.rating}</span>
            <span className="text-slate-400 text-xs">({doctor.review_count} reviews)</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5 col-span-2"><Building2 className="h-3.5 w-3.5 text-teal-600" /> <span className="truncate">{doctor.hospital_name}</span></span>
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-teal-600" /> {doctor.hospital_area}, {doctor.city}</span>
        <span className="flex items-center gap-1.5"><BriefcaseMedical className="h-3.5 w-3.5 text-teal-600" /> {doctor.experience} yrs exp</span>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Consultation</div>
          <div className="font-display font-bold text-slate-900">{inr(doctor.fee)}</div>
        </div>
        {doctor.next_available ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-1.5 rounded-full" data-testid="doctor-next-slot">
            <Clock className="h-3.5 w-3.5" /> {fmtDate(doctor.next_available.date)}, {fmtTime(doctor.next_available.time)}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No slots this fortnight</span>
        )}
      </div>
      <Button className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" onClick={() => navigate(`/doctors/${doctor.id}`)} data-testid="doctor-card-book-button">
        View profile & book
      </Button>
    </article>
  );
}
