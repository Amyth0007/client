/**
 * Individual screens inside each module (mirrors SCREENS in the API's permission-registry.ts).
 * Admins can hide a screen while still granting its module; the deny-list is stored per user / custom role.
 * `paths` are URL prefixes: a screen also covers its detail and edit pages (e.g. /invoices/:id).
 */
export const SCREENS = [
  { key: "reports.overview", module: "reports", name: "Overview dashboard", paths: ["/dashboard"] },
  { key: "reports.workforce", module: "reports", name: "Workforce reports", paths: ["/workforce/reports"] },
  { key: "customers.list", module: "customers", name: "Customers", paths: ["/customers"] },
  { key: "invoices.list", module: "invoices", name: "Invoices", paths: ["/invoices"] },
  { key: "payments.list", module: "payments", name: "Payments", paths: ["/payments"] },
  { key: "recovery.list", module: "recovery", name: "Recovery assignments", paths: ["/recovery"] },
  { key: "commitments.list", module: "commitments", name: "Commitments", paths: ["/commitments"] },
  { key: "attendance.main", module: "attendance", name: "Attendance", paths: ["/attendance"] },
  { key: "attendance.guard_station", module: "attendance", name: "Guard station punches", paths: ["/guard/attendance"] },
  { key: "workforce.employees", module: "workforce", name: "Employees", paths: ["/workforce"] },
  { key: "workforce.shifts", module: "workforce", name: "Shifts & schedules", paths: ["/workforce/shifts"] },
  { key: "payroll.earnings", module: "payroll", name: "Earnings & pay", paths: ["/payroll", "/my-payroll"] },
  { key: "payroll.history", module: "payroll", name: "Payroll history", paths: ["/payroll/history"] },
  { key: "overtime.main", module: "overtime", name: "Overtime", paths: ["/overtime"] },
  { key: "leave.main", module: "leave", name: "Leave & approvals", paths: ["/leave"] },
  { key: "compliance.main", module: "compliance", name: "Compliance rules", paths: ["/compliance"] },
  { key: "visitors.forms", module: "visitors", name: "Forms & passes", paths: ["/visitor-forms"] },
  { key: "visitors.register", module: "visitors", name: "Register a visitor", paths: ["/visitor-register-internal"] },
  { key: "visitors.checkin", module: "visitors", name: "Check in / out", paths: ["/visitor-checkin"] },
  { key: "visitors.records", module: "visitors", name: "Registrations", paths: ["/visitor-records"] },
  { key: "settings.main", module: "settings", name: "Settings & team", paths: ["/settings"] },
] as const;

export type ScreenKey = (typeof SCREENS)[number]["key"];
type ScreenUser = { role?: string; deniedScreens?: string[] } | null | undefined;

export const screensOfModule = (moduleKey: string) => SCREENS.filter((screen) => screen.module === moduleKey);

/** Organization admins always see every screen; everyone else is filtered by their deny-list. */
export function isScreenHidden(user: ScreenUser, key: ScreenKey) {
  if (!user || user.role === "org_admin" || user.role === "super_admin") return false;
  return user.deniedScreens?.includes(key) ?? false;
}

/** The screen a URL belongs to (longest matching prefix), or null for pages outside the screen list. */
export function screenForPath(pathname: string): ScreenKey | null {
  let best: { key: ScreenKey; length: number } | null = null;
  for (const screen of SCREENS) {
    for (const path of screen.paths) {
      if ((pathname === path || pathname.startsWith(`${path}/`)) && path.length > (best?.length ?? 0)) best = { key: screen.key, length: path.length };
    }
  }
  return best?.key ?? null;
}

/** The guard visitor desk combines registering and checking in, so it stays visible while either is allowed. */
export function isPathHidden(user: ScreenUser, pathname: string) {
  if (pathname === "/guard/visitors" || pathname.startsWith("/guard/visitors/")) return isScreenHidden(user, "visitors.register") && isScreenHidden(user, "visitors.checkin");
  const key = screenForPath(pathname);
  return key ? isScreenHidden(user, key) : false;
}
