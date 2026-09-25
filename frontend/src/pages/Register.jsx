import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { AuthShell } from "@/pages/Login";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/patient", { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your patient account" subtitle="Doctors and admins are onboarded by the hospital." footer={<>Already registered? <Link to="/login" className="text-teal-700 font-semibold" data-testid="register-login-link">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        <div><Label>Full name</Label><Input required value={form.name} onChange={set("name")} className="mt-1.5 h-11 rounded-xl" data-testid="register-name-input" /></div>
        <div><Label>Email</Label><Input type="email" required value={form.email} onChange={set("email")} className="mt-1.5 h-11 rounded-xl" data-testid="register-email-input" /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={set("phone")} className="mt-1.5 h-11 rounded-xl" placeholder="+91" data-testid="register-phone-input" /></div>
        <div><Label>Password</Label><Input type="password" required minLength={6} value={form.password} onChange={set("password")} className="mt-1.5 h-11 rounded-xl" data-testid="register-password-input" /></div>
        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2" data-testid="register-error">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700" data-testid="register-submit-button">{loading ? "Creating…" : "Create account"}</Button>
      </form>
    </AuthShell>
  );
}
