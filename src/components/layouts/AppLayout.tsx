import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  LogOut,
  MoreHorizontal,
  X,
  Building2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../modules/auth/AuthContext.js";
import { Button } from "../common/Button.js";
import { Modal } from "../common/Modal.js";
import { buildNavGroups } from "./navigation.js";
import { ApiProgressBar } from "../common/ApiProgressBar.js";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => setLogoutModalOpen(true);

  const confirmLogout = async () => {
    const destination = user?.role === "employee" || user?.role === "field_recovery" || user?.role === "accounts_manager" || user?.role === "sub_admin" || user?.role === "guard" ? "/employee-login" : "/login";
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
      : user?.role === "sub_admin"
        ? user.customRoleName || "Subadmin"
      : user?.role === "accounts_manager"
        ? "Account Manager"
        : user?.role === "guard" ? "Guard" : user?.role === "employee" ? "Employee" : "Field Executive";

  const navGroups = buildNavGroups(user);

  const allNavItems = navGroups.flatMap((group) => group.items);
  const mobilePrimaryItems = allNavItems.slice(0, allNavItems.length <= 5 ? 5 : 4);
  const mobileOverflowGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !mobilePrimaryItems.some((primary) => primary.path === item.path)),
  })).filter((group) => group.items.length > 0);

  const isGroupActive = (group: (typeof navGroups)[number]) => group.items.some((item) =>
    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
  );
  const isGroupOpen = (group: (typeof navGroups)[number]) =>
    collapsedGroups[group.id] === undefined ? isGroupActive(group) || group.id === "payment-recovery" : !collapsedGroups[group.id];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <ApiProgressBar />
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

        {/* Product areas and their available screens */}
        <nav aria-label="Main navigation" className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            const expanded = isGroupOpen(group);
            return <section key={group.id}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setCollapsedGroups((current) => ({ ...current, [group.id]: expanded }))}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider transition-colors ${isGroupActive(group) ? "text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{group.label}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} />
              </button>
              {expanded && <div className="mt-1 space-y-1 pl-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/dashboard"}
                    className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>;
                })}
              </div>}
            </section>;
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
          <div className="flex min-w-0 items-center gap-2">
            {user?.organization && <span className="max-w-[150px] truncate text-xs font-semibold text-slate-700">{user.organization.name}</span>}
            {!mobileOverflowGroups.length && <button type="button" onClick={handleLogout} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><LogOut className="h-4 w-4" /></button>}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Primary navigation" className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 flex items-stretch h-16 px-1 shadow-lg">
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.path} to={item.path} end={item.path === "/dashboard" || item.path === "/platform"} className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold ${isActive ? "text-indigo-700" : "text-slate-700"}`}>
            <Icon className="h-5 w-5 shrink-0" /><span className="max-w-full truncate">{item.label}</span>
          </NavLink>;
        })}
        {mobileOverflowGroups.length > 0 && <button onClick={() => setMobileMenuOpen(true)} aria-expanded={mobileMenuOpen} className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold ${mobileOverflowGroups.some((group) => group.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))) ? "text-indigo-700" : "text-slate-700 hover:text-slate-800"}`}>
          <MoreHorizontal className="h-5 w-5" /><span>More</span>
        </button>}
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
            <div className="max-h-[65vh] space-y-5 overflow-y-auto py-4">
              {mobileOverflowGroups.map((group) => <section key={group.id}>
                <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.label}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl border p-3 text-xs font-medium ${location.pathname === item.path || location.pathname.startsWith(`${item.path}/`) ? "border-indigo-200 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                      <Icon className="h-5 w-5 shrink-0 text-indigo-600" /><span>{item.label}</span>
                    </Link>;
                  })}
                </div>
              </section>)}

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
          <Button variant="danger" isLoading={isLoggingOut} onClick={() => confirmLogout()}>Log out</Button>
        </div>
      </Modal>
    </div>
  );
}
