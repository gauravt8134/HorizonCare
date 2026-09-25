import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const QUICK = ["How do I book an appointment?", "How does the queue token work?", "Can I reschedule a visit?", "Which specialist for back pain?"];

export function FaqChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! I can help with using HorizonCare or picking the right specialization. I don't diagnose — a doctor does that." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  const send = async (q) => {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const { data } = await api.post("/ai/faq", { message, history });
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Sorry, I couldn't answer right now. ${errMsg(e)}` }]);
    } finally { setBusy(false); }
  };

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="fixed bottom-5 right-5 z-50 h-13 w-13 p-3.5 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-transform hover:scale-105" data-testid="faq-chat-toggle" aria-label="Help assistant">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200" data-testid="faq-chat-panel">
          <div className="bg-teal-600 text-white px-4 py-3"><div className="font-display font-bold text-sm">HorizonCare Assistant</div><div className="text-[11px] text-teal-100">FAQs & specialization help · not medical advice</div></div>
          <div className="h-72 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {msgs.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${m.role === "user" ? "ml-auto bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`} data-testid={`faq-msg-${m.role}-${i}`}>{m.content}</div>
            ))}
            {busy && <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 text-sm text-slate-400 w-16">…</div>}
            <div ref={endRef} />
          </div>
          {msgs.length === 1 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">{QUICK.map((q) => <button key={q} onClick={() => send(q)} className="text-[11px] rounded-full border border-teal-200 bg-teal-50 text-teal-700 px-2.5 py-1 hover:bg-teal-100" data-testid="faq-quick-question">{q}</button>)}</div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 p-3">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about booking, queues…" className="h-10 rounded-xl" data-testid="faq-chat-input" />
            <Button type="submit" size="icon" disabled={busy || !text.trim()} className="h-10 w-10 rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="faq-chat-send"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      )}
    </>
  );
}
