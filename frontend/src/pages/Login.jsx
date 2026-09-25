import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { errMsg, roleHome } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DEMO = [
  { label: "Patient", email: "patient@horizoncare.com", password: "patient123" },
  { label: "Doctor", email: "dr.arjun@horizoncare.com", password: "doctor123" },
];

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3.1 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" /></svg>
  );
}

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12">
        <div className="flex items-center gap-2.5"><span className="h-9 w-9 rounded-xl bg-teal-500 grid place-items-center"><HeartPulse className="h-5 w-5" /></span><span className="font-display font-extrabold text-lg">HorizonCare</span></div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-teal-300">Patient · Doctor · Admin</div>
          <h2 className="font-display text-4xl font-extrabold tracking-tight mt-3 leading-tight">One login for the whole care journey.</h2>
          <p className="text-slate-300 mt-4 max-w-md">Book across hospitals, watch your live queue token, and download digital prescriptions — all from one secure account.</p>
        </div>
        <p className="text-xs text-slate-500">Role-based access · Audit-logged records · HIPAA-inspired design</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">{subtitle}</p>
          {children}
          <div className="text-sm text-slate-500 mt-6 text-center">{footer}</div>
        </div>
      </div>
    </main>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(location.state?.from && user.role === "patient" ? location.state.from : roleHome(user.role), { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage appointments, queues and records." footer={<>New patient? <Link to="/register" className="text-teal-700 font-semibold" data-testid="login-register-link">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11 rounded-xl" data-testid="login-email-input" /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11 rounded-xl" data-testid="login-password-input" /></div>
        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2" data-testid="login-error">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="login-submit-button">{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="relative my-5"><div className="border-t border-slate-200" /><span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-slate-400">or</span></div>
      <Button variant="outline" onClick={googleLogin} className="w-full h-11 rounded-xl gap-2" data-testid="google-login-button"><GoogleIcon /> Continue with Google (patients)</Button>
      <div className="mt-6">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Demo accounts</div>
        <div className="flex gap-2">
          {DEMO.map((d) => (
            <button key={d.label} type="button" onClick={() => { setEmail(d.email); setPassword(d.password); }} className="flex-1 text-xs rounded-lg border border-slate-200 py-2 hover:border-teal-300 hover:bg-teal-50/50 transition-colors" data-testid={`demo-fill-${d.label.toLowerCase()}`}>{d.label}</button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
