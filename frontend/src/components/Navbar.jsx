import { Link, NavLink, useNavigate } from "react-router-dom";
import { HeartPulse, LogOut, LayoutDashboard, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleHome } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const linkCls = ({ isActive }) =>
  `text-sm font-medium transition-colors ${isActive ? "text-teal-700" : "text-slate-600 hover:text-slate-900"}`;

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/85 border-b border-slate-200/80" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-2.5" data-testid="navbar-brand">
          <span className="h-9 w-9 rounded-xl bg-teal-600 text-white grid place-items-center shadow-sm">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="font-display font-extrabold text-lg tracking-tight text-slate-900">HorizonCare</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          <NavLink to="/doctors" className={linkCls} data-testid="nav-find-doctors">Find Doctors</NavLink>
          <NavLink to="/#ai" className={linkCls} data-testid="nav-ai-assistant">AI Assistant</NavLink>
          <a href="tel:1800200900" className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full" data-testid="nav-emergency">
            <Phone className="h-3.5 w-3.5" /> 24/7 Emergency 1800-200-900
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button size="sm" className="rounded-full bg-teal-600 hover:bg-teal-700" onClick={() => navigate(roleHome(user.role))} data-testid="nav-dashboard-button">
                <LayoutDashboard className="h-4 w-4 mr-1.5" /> Dashboard
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full ring-2 ring-transparent hover:ring-teal-200 transition" data-testid="nav-user-menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.picture} alt={user.name} />
                      <AvatarFallback className="bg-teal-50 text-teal-700 font-semibold">{user.name?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-500 capitalize">{user.role} · {user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => { await logout(); navigate("/"); }} data-testid="nav-logout-button">
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => navigate("/login")} data-testid="nav-login-button">Sign in</Button>
              <Button size="sm" className="rounded-full bg-teal-600 hover:bg-teal-700" onClick={() => navigate("/register")} data-testid="nav-register-button">Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
