import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Target,
  Handshake,
  Settings,
  LogOut,
  MoreHorizontal,
  X,
  Building2,
  CalendarCheck,
} from "lucide-react";
import { useAuth } from "../../modules/auth/AuthContext.js";
import { Button } from "../common/Button.js";
import { Modal } from "../common/Modal.js";
import { userCanAccessModule } from "../../modules/platform/module-registry.js";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const moduleEnabled = (moduleKey: "reports" | "customers" | "invoices" | "payments" | "recovery" | "commitments" | "gmail" | "settings" | "attendance") =>
    !user?.organizationId || userCanAccessModule(user?.role, user?.organization?.modules, user?.modulePermissions, moduleKey, user?.modulePermissionsConfigured ?? false);

  const handleLogout = () => setLogoutModalOpen(true);

  const confirmLogout = async () => {
    const destination = user?.role === "field_recovery" ? "/field-login" : "/login";
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutModalOpen(false);
      navigate(destination);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log out");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const roleLabel = user?.role === "super_admin"
    ? "Super Admin"
    : user?.role === "org_admin"
      ? "Organization Admin"
      : user?.role === "accounts_manager"
        ? "Account Manager"
        : user?.role === "employee" ? "Employee" : "Field Executive";

  const navItems = user?.role === "super_admin" ? [
    { label: "Platform admin", path: "/platform", icon: Building2 },
  ] : user?.role === "field_recovery" ? [
    ...(moduleEnabled("recovery") ? [{ label: "My assigned visits", path: "/recovery", icon: Target }] : []),
    ...(moduleEnabled("attendance") ? [{ label: "Attendance", path: "/attendance", icon: CalendarCheck }] : []),
  ] : [
    ...(moduleEnabled("reports") ? [{ label: "Dashboard", path: "/dashboard", icon: LayoutDashboard }] : []),
    ...(moduleEnabled("recovery") ? [{ label: "Recovery", path: "/recovery", icon: Target }] : []),
    ...(moduleEnabled("invoices") ? [{ label: "Invoices", path: "/invoices", icon: FileText }] : []),
    ...(moduleEnabled("payments") ? [{ label: "Payments", path: "/payments", icon: CreditCard }] : []),
    ...(moduleEnabled("commitments") ? [{ label: "Commitments", path: "/commitments", icon: Handshake }] : []),
    ...(moduleEnabled("customers") ? [{ label: "Customers", path: "/customers", icon: Users }] : []),
    ...(moduleEnabled("settings") ? [{ label: "Settings", path: "/settings", icon: Settings }] : []),
    ...(moduleEnabled("attendance") ? [{ label: "Attendance", path: "/attendance", icon: CalendarCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-base">Recovr</span>
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              B2B
            </span>
          </div>
        </div>

        {/* Organization pill */}
        {user?.organization && (
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Organization
            </p>
            <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">
              {user.organization.name}
            </p>
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User profile & logout */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-700 capitalize truncate">
                {roleLabel}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 pb-20 md:pb-8">
        {/* Mobile Header */}
        <header className="md:hidden flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-sm">Recovr</span>
          </div>
          {user?.organization && (
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">
              {user.organization.name}
            </span>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 flex items-center justify-around h-16 px-1 shadow-lg">
        {user?.role === "super_admin" ? <NavLink
          to="/platform"
          className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold ${isActive ? "text-indigo-700" : "text-slate-700"}`}
        >
          <Building2 className="h-5 w-5 mb-0.5" />
          <span>Platform</span>
        </NavLink> : user?.role === "field_recovery" ? <>
          {moduleEnabled("recovery") && <NavLink to="/recovery" className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
            <Target className="h-5 w-5 mb-0.5" /><span>My Visits</span>
          </NavLink>}
          {moduleEnabled("attendance") && <NavLink to="/attendance" className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold ${isActive ? "text-indigo-700" : "text-slate-700"}`}><CalendarCheck className="h-5 w-5 mb-0.5" /><span>Attendance</span></NavLink>}
        </> : <>
        {moduleEnabled("reports") && <NavLink to="/dashboard" className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold transition-colors ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
          <LayoutDashboard className="h-5 w-5 mb-0.5" /><span>Dashboard</span>
        </NavLink>}

        {moduleEnabled("recovery") && <NavLink to="/recovery" className={({ isActive }) => `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold transition-colors ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
          <Target className="h-5 w-5 mb-0.5" /><span>Recovery</span>
        </NavLink>}

        {moduleEnabled("invoices") && <NavLink
          to="/invoices"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold transition-colors ${
              isActive ? "text-indigo-700" : "text-slate-700"
            }`
          }
        >
          <FileText className="h-5 w-5 mb-0.5" />
          <span>Invoices</span>
        </NavLink>}

        {moduleEnabled("payments") && <NavLink
          to="/payments"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold transition-colors ${
              isActive ? "text-indigo-700" : "text-slate-700"
            }`
          }
        >
          <CreditCard className="h-5 w-5 mb-0.5" />
          <span>Payments</span>
        </NavLink>}
        </>}

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-1 text-xs mobile-nav-label font-semibold text-slate-700 hover:text-slate-800"
        >
          <MoreHorizontal className="h-5 w-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "More" Slide-up Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl border-t border-slate-200 p-6 z-10 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-900">More Options</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 py-4">
              {user?.role === "super_admin" ? (
                <Link to="/platform" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs">
                  <Building2 className="h-5 w-5 text-indigo-600" /><span>Platform admin</span>
                </Link>
              ) : user?.role === "field_recovery" ? (
                <>
                  {moduleEnabled("recovery") && <Link to="/recovery" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs"><Target className="h-5 w-5 text-indigo-600" /><span>My assigned visits</span></Link>}
                  {moduleEnabled("attendance") && <Link to="/attendance" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs"><CalendarCheck className="h-5 w-5 text-indigo-600" /><span>Attendance</span></Link>}
                </>
              ) : <>
              {moduleEnabled("attendance") && <Link to="/attendance" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs"><CalendarCheck className="h-5 w-5 text-indigo-600" /><span>Attendance</span></Link>}
              {moduleEnabled("commitments") && <Link
                to="/commitments"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs"
              >
                <Handshake className="h-5 w-5 text-emerald-600" />
                <span>Commitments</span>
              </Link>}

              {moduleEnabled("customers") && <Link
                to="/customers"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs"
              >
                <Users className="h-5 w-5 text-indigo-600" />
                <span>Customers</span>
              </Link>}

              {moduleEnabled("settings") && <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs"
              >
                <Settings className="h-5 w-5 text-slate-600" />
                <span>Settings</span>
              </Link>}
              </>}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 p-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-medium text-xs"
              >
                <LogOut className="h-5 w-5 text-rose-600" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={logoutModalOpen} onClose={() => setLogoutModalOpen(false)} title="Log out?" description="Are you sure you want to log out of Recovr?" maxWidth="sm">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setLogoutModalOpen(false)} disabled={isLoggingOut}>Stay signed in</Button>
          <Button variant="danger" isLoading={isLoggingOut} onClick={() => void confirmLogout()}>Log out</Button>
        </div>
      </Modal>
    </div>
  );
}
