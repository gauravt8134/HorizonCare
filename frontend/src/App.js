import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthCallback from "@/components/AuthCallback";
import { FaqChat } from "@/components/FaqChat";
import Landing from "@/pages/Landing";
import Doctors from "@/pages/Doctors";
import DoctorProfile from "@/pages/DoctorProfile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PatientDashboard from "@/pages/PatientDashboard";
import DoctorDashboard from "@/pages/DoctorDashboard";
import AdminDashboard from "@/pages/AdminDashboard";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/:id" element={<DoctorProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/patient" element={<ProtectedRoute roles={["patient"]}><PatientDashboard /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute roles={["doctor"]}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="border-t border-slate-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} HorizonCare · Multi-hospital patient management</span>
          <span>AI suggestions are assistive only and never a substitute for a doctor.</span>
        </div>
      </footer>
      <FaqChat />
    </>
  );
}

export default function App() {
  return (
    <div className="App min-h-screen bg-slate-50 text-slate-800">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
