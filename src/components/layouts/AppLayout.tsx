import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  LogOut,
  MoreHorizontal,
  X,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../../modules/auth/AuthContext.js";
import { Button } from "../common/Button.js";
import { Modal } from "../common/Modal.js";
import { Input } from "../common/Input.js";
import { api } from "../../services/api-client.js";
import { buildNavGroups } from "./navigation.js";
import { ApiProgressBar } from "../common/ApiProgressBar.js";

const SIDEBAR_KEY = "recovr.sidebarCollapsed";

export function AppLayout() {
  const { user, logout, exitImpersonation, refreshProfile } = useAuth();
  const impersonating = Boolean(user?.impersonatedBy);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);

  const toggleSidebar = () => {
    setTooltip(null);
    setSidebarCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* storage unavailable */ }
      return next;
    });
  };
  const showTooltip = (element: HTMLElement, label: string) => {
    const rect = element.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2 });
  };
  const hideTooltip = () => setTooltip(null);

  // Ctrl/Cmd + B toggles the sidebar on desktop.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b" && !event.altKey && !event.shiftKey) {
        const target = event.target as HTMLElement | null;
        if (target && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName))) return;
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = () => (impersonating ? exitImpersonation() : setLogoutModalOpen(true));
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const openPasswordModal = () => { setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPasswordModalOpen(true); };
  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error("The new passwords do not match"); return; }
    setIsChangingPassword(true);
    try {
      await api.changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      await refreshProfile();
      toast.success("Password changed. Other devices have been signed out.");
      setPasswordModalOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change the password");
    } finally {
      setIsChangingPassword(false);
    }
  };

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
  const initials = (user?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

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
      {/* Desktop Sidebar (hidden on mobile) — collapsible to an icon rail */}
      <aside
        className={`hidden md:flex md:flex-col md:fixed md:inset-y-0 z-30 border-r border-slate-200 bg-white transition-[width] duration-200 ease-out ${sidebarCollapsed ? "md:w-[72px]" : "md:w-64"}`}
      >
        {/* Brand + collapse toggle */}
        <div className={`flex h-16 shrink-0 items-center border-b border-slate-100 ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4"}`}>
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-slate-100"
            >
              <img src="/recovr-mark.svg" alt="" aria-hidden="true" className="h-9 w-9 rounded-xl shadow-xs transition group-hover:opacity-0" />
              <PanelLeftOpen className="absolute h-5 w-5 text-slate-600 opacity-0 transition group-hover:opacity-100" />
            </button>
          ) : (
            <>
              <img src="/recovr-mark.svg" alt="" aria-hidden="true" className="h-9 w-9 shrink-0 rounded-xl shadow-xs" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-base font-bold tracking-tight text-slate-900">Recovr</span>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">B2B</span>
                </div>
                {user?.organization && <p className="truncate text-[11px] font-medium text-slate-500" title={user.organization.name}>{user.organization.name}</p>}
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Product areas and their available screens */}
        <nav aria-label="Main navigation" className={`flex-1 overflow-y-auto overflow-x-hidden py-3 no-scrollbar ${sidebarCollapsed ? "px-2" : "px-3"}`}>
          {navGroups.map((group, groupIndex) => {
            const GroupIcon = group.icon;
            const expanded = sidebarCollapsed || isGroupOpen(group);
            return <section key={group.id} className={groupIndex > 0 ? (sidebarCollapsed ? "mt-2 border-t border-slate-100 pt-2" : "mt-3") : undefined}>
              {!sidebarCollapsed && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setCollapsedGroups((current) => ({ ...current, [group.id]: expanded }))}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors ${isGroupActive(group) ? "text-indigo-700" : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"}`}
                >
                  <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{group.label}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} />
                </button>
              )}
              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className={`min-h-0 overflow-hidden ${sidebarCollapsed ? "space-y-1" : "mt-0.5 space-y-0.5"}`}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === "/dashboard"}
                      tabIndex={expanded ? undefined : -1}
                      aria-label={sidebarCollapsed ? item.label : undefined}
                      onMouseEnter={sidebarCollapsed ? (event) => showTooltip(event.currentTarget, item.label) : undefined}
                      onMouseLeave={sidebarCollapsed ? hideTooltip : undefined}
                      onFocus={sidebarCollapsed ? (event) => showTooltip(event.currentTarget, item.label) : undefined}
                      onBlur={sidebarCollapsed ? hideTooltip : undefined}
                      className={({ isActive }) => `group relative flex items-center rounded-xl text-sm font-medium transition-colors ${sidebarCollapsed ? "mx-auto h-10 w-10 justify-center" : "gap-3 px-3 py-2"} ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                    >
                      {({ isActive }) => <>
                        {isActive && !sidebarCollapsed && <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-indigo-600" />}
                        <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </>}
                    </NavLink>;
                  })}
                </div>
              </div>
            </section>;
          })}
        </nav>

        {/* User profile & logout */}
        <div className={`shrink-0 border-t border-slate-100 ${sidebarCollapsed ? "flex flex-col items-center gap-2 p-2 py-3" : "p-3"}`}>
          {sidebarCollapsed ? (
            <>
              <span title={`${user?.name ?? ""} · ${roleLabel}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials}</span>
              {!impersonating && <button onClick={openPasswordModal} aria-label="Change password" title="Change password" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <KeyRound className="h-4 w-4" />
              </button>}
              <button onClick={handleLogout} aria-label={impersonating ? "Exit organization" : "Sign out"} title={impersonating ? "Exit organization" : "Sign out"} className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{user?.name}</p>
                <p className="truncate text-[11px] capitalize text-slate-500">{roleLabel}</p>
              </div>
              {!impersonating && <button onClick={openPasswordModal} aria-label="Change password" title="Change password" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <KeyRound className="h-4 w-4" />
              </button>}
              <button onClick={handleLogout} aria-label={impersonating ? "Exit organization" : "Sign out"} title={impersonating ? "Exit organization" : "Sign out"} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Hover label for the collapsed icon rail (fixed so the scrolling nav can't clip it) */}
      {sidebarCollapsed && tooltip && (
        <div role="tooltip" style={{ top: tooltip.top }} className="pointer-events-none fixed left-[80px] z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg md:block">
          {tooltip.label}
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 pb-20 md:pb-8 transition-[padding] duration-200 ease-out ${sidebarCollapsed ? "md:pl-[72px]" : "md:pl-64"}`}>
        {impersonating && (
          <div role="status" className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="min-w-0 truncate">Platform admin view: <strong>{user?.organization?.name}</strong> as {user?.name}. Actions are recorded under {user?.impersonatedBy?.name || "your platform account"}.</span>
            </span>
            <button type="button" onClick={exitImpersonation} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700">Exit organization</button>
          </div>
        )}

        {/* Mobile Header */}
        <header className="md:hidden flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <img src="/recovr-mark.svg" alt="" aria-hidden="true" className="h-7 w-7 rounded-lg" />
            <span className="font-bold text-slate-900 tracking-tight text-sm">Recovr</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {user?.organization && <span className="max-w-[150px] truncate text-xs font-semibold text-slate-700">{user.organization.name}</span>}
            {!mobileOverflowGroups.length && !impersonating && <button type="button" onClick={openPasswordModal} title="Change password" aria-label="Change password" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><KeyRound className="h-4 w-4" /></button>}
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

              <div className="grid grid-cols-2 gap-2">
                {!impersonating && <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openPasswordModal();
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="h-5 w-5 text-indigo-600" />
                  <span>Change password</span>
                </button>}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-medium text-xs"
                >
                  <LogOut className="h-5 w-5 text-rose-600" />
                  <span>{impersonating ? "Exit organization" : "Sign Out"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="Change password" description="Other devices will be signed out after the change." maxWidth="sm">
        <form onSubmit={submitPasswordChange} className="space-y-3">
          <Input label="Current password" type="password" required autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} />
          <Input label="New password" type="password" required minLength={8} autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} />
          <Input label="Confirm new password" type="password" required minLength={8} autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isChangingPassword}>Update password</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={logoutModalOpen} onClose={() => setLogoutModalOpen(false)} title="Log out?" description="Are you sure you want to log out of Recovr?" maxWidth="sm">
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setLogoutModalOpen(false)} disabled={isLoggingOut}>Stay signed in</Button>
          <Button variant="danger" isLoading={isLoggingOut} onClick={() => confirmLogout()}>Log out</Button>
        </div>
      </Modal>
    </div>
  );
}
