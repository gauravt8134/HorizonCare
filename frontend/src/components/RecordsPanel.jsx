import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, FileText, Image as ImageIcon, Download, Trash2, ShieldCheck, History } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared";
import { toast } from "sonner";

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function RecordsPanel({ patientId, compact = false }) {
  const { user } = useAuth();
  const [records, setRecords] = useState(null);
  const [types, setTypes] = useState([]);
  const [type, setType] = useState("Lab report");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [auditFor, setAuditFor] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const fileRef = useRef(null);

  const url = user.role === "patient" ? "/records/me" : `/records/patient/${patientId}`;
  const load = useCallback(() => api.get(url).then((r) => setRecords(r.data)).catch(() => setRecords([])), [url]);
  useEffect(() => { load(); api.get("/records/types").then((r) => setTypes(r.data)); }, [load]);

  const upload = async () => {
    if (!file) return toast.error("Choose a file first");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("record_type", type);
    fd.append("notes", notes);
    if (user.role !== "patient") fd.append("patient_id", patientId);
    setUploading(true);
    try {
      await api.post("/records", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Report uploaded and encrypted");
      setFile(null); setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setUploading(false); }
  };

  const download = async (r) => {
    try {
      const res = await api.get(`/records/${r.id}/download`, { responseType: "blob" });
      window.open(URL.createObjectURL(res.data), "_blank");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.filename}"?`)) return;
    try { await api.delete(`/records/${r.id}`); toast.success("Record deleted"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const openAudit = async (r) => { setAuditFor(r); const { data } = await api.get(`/records/${r.id}/audit`); setAuditRows(data); };

  return (
    <div className="space-y-5" data-testid="records-panel">
      <div className={`bg-white rounded-2xl border border-slate-200 ${compact ? "p-4" : "p-5 sm:p-6"}`} data-testid="records-upload-form">
        <div className="flex items-center gap-2 mb-1"><FileUp className="h-4 w-4 text-teal-600" /><span className="font-display font-bold text-slate-900">Upload a report</span></div>
        <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Files are AES-encrypted before storage; every view is audit-logged.</p>
        <div className="grid sm:grid-cols-12 gap-3">
          <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="sm:col-span-5 file:text-teal-700 file:font-medium" data-testid="record-file-input" />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:col-span-3" data-testid="record-type-select"><SelectValue /></SelectTrigger>
            <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="sm:col-span-4" data-testid="record-notes-input" />
        </div>
        <Button onClick={upload} disabled={uploading || !file} className="mt-3 rounded-full bg-teal-600 hover:bg-teal-700" data-testid="record-upload-button">{uploading ? "Encrypting & uploading…" : "Upload securely"}</Button>
      </div>

      {records === null ? <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" /> : records.length === 0 ? (
        <EmptyState title="No medical records yet" hint="Upload lab reports, scans or discharge summaries (PDF/JPG/PNG, up to 10 MB)." testId="records-empty" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3" data-testid="records-list">
          {records.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3" data-testid={`record-card-${r.id}`}>
              <div className="h-11 w-11 shrink-0 rounded-xl bg-teal-50 text-teal-700 grid place-items-center">{r.content_type === "application/pdf" ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate" data-testid="record-filename">{r.filename}</div>
                <div className="text-xs text-slate-500">{r.record_type} · {fmtSize(r.size)} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                <div className="text-xs text-slate-400 mt-0.5">By {r.uploaded_by_name} ({r.uploaded_by_role}){r.notes ? ` · ${r.notes}` : ""}</div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="ghost" onClick={() => download(r)} data-testid={`record-download-${r.id}`}><Download className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => openAudit(r)} data-testid={`record-audit-${r.id}`}><History className="h-4 w-4" /></Button>
                {(r.uploaded_by === user.id || user.role !== "doctor") && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(r)} data-testid={`record-delete-${r.id}`}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!auditFor} onOpenChange={(o) => !o && setAuditFor(null)}>
        <DialogContent className="max-w-md" data-testid="record-audit-dialog">
          <DialogHeader><DialogTitle>Access log · {auditFor?.filename}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 text-sm max-h-72 overflow-y-auto">
            {auditRows.map((l) => <div key={l.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span><span className="font-medium capitalize">{l.action}</span> · {l.user_name} <span className="text-slate-400">({l.user_role})</span></span><span className="text-xs text-slate-400">{new Date(l.timestamp).toLocaleString("en-IN")}</span></div>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
