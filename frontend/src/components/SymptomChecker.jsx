import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const URGENCY = { routine: "bg-emerald-50 text-emerald-700", soon: "bg-amber-50 text-amber-700", urgent: "bg-rose-50 text-rose-700" };

export function SymptomChecker() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const submit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/ai/symptom-check", { symptoms: text });
      setResult(data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-teal-100 bg-white p-6 sm:p-8 shadow-sm" id="ai" data-testid="symptom-checker">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-8 w-8 rounded-lg bg-teal-600 text-white grid place-items-center"><Sparkles className="h-4 w-4" /></span>
        <h3 className="font-display text-lg font-bold text-slate-900">Not sure who to see?</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">Describe your symptoms and our AI assistant suggests the right specialist. Assistive only — never a diagnosis.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="rounded-xl resize-none"
        placeholder="e.g. Sharp chest pain when climbing stairs, shortness of breath for 2 days…" data-testid="ai-symptom-input" />
      <div className="flex justify-end mt-3">
        <Button onClick={submit} disabled={loading || text.trim().length < 5} className="rounded-full bg-slate-900 hover:bg-slate-800" data-testid="ai-symptom-submit-button">
          {loading ? "Analyzing…" : "Suggest a specialist"} <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
      {result && (
        <div className="mt-5 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="ai-symptom-result">
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2.5 py-1 rounded-full font-semibold capitalize ${URGENCY[result.urgency] || URGENCY.routine}`} data-testid="ai-urgency-badge">{result.urgency} priority</span>
            <span className="text-slate-500">{result.advice}</span>
          </div>
          {result.suggestions?.map((s, i) => (
            <button key={i} onClick={() => s.specialization_id && navigate(`/doctors?specialization=${s.specialization_id}`)}
              className="w-full text-left rounded-2xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 p-4 transition-colors group" data-testid={`ai-suggestion-${i}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{s.specialization}</span>
                <span className="text-xs text-teal-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">Find doctors <ArrowRight className="h-3 w-3" /></span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{s.reason}</p>
            </button>
          ))}
          <p className="flex items-start gap-1.5 text-xs text-slate-400"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
