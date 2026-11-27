import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Target,
  Handshake,
  Settings,
  Building2,
  CalendarCheck,
  Clock3,
  Wallet,
  Timer,
  Umbrella,
  ClipboardList,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { canUserAccessModule, type OrganizationModuleKey } from "../../modules/platform/module-registry.js";
import type { useAuth } from "../../modules/auth/AuthContext.js";
import { isPathHidden } from "../../modules/platform/screen-registry.js";

type NavUser = ReturnType<typeof useAuth>["user"];
export type NavItem = { label: string; path: string; icon: LucideIcon };
export type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

/** Single source of truth for the app menu: used by the sidebar/mobile bar and by the post-login landing redirect. */
export function buildNavGroups(user: NavUser): NavGroup[] {
  const moduleEnabled = (moduleKey: OrganizationModuleKey) =>
    !user?.organizationId || canUserAccessModule(user, moduleKey);
  const visitorAdmin = user?.role === "org_admin" || user?.role === "super_admin";
  const canManageVisitorForms = visitorAdmin || user?.actionPermissions?.includes("visitors.manage_forms") === true;
  const guardHasVisitorDesk = user?.role === "guard" && user.modulePermissions?.visitors === true;
  const canRegisterVisitors = visitorAdmin || guardHasVisitorDesk || user?.actionPermissions?.includes("visitors.register") === true;
  const canViewVisitors = visitorAdmin || user?.actionPermissions?.includes("visitors.view") === true;
  const canCheckVisitors = visitorAdmin || guardHasVisitorDesk || user?.actionPermissions?.includes("visitors.check_in") === true || user?.actionPermissions?.includes("visitors.check_out") === true;
  const visitorItems: NavItem[] = user?.role === "guard"
    ? (canRegisterVisitors || canCheckVisitors ? [{ label: "Visitor desk", path: "/guard/visitors", icon: ClipboardList }] : [])
    : [
    ...(canManageVisitorForms ? [{ label: "Forms & passes", path: "/visitor-forms", icon: ClipboardList }] : []),
    ...(canRegisterVisitors ? [{ label: "Register a visitor", path: "/visitor-register-internal", icon: Users }] : []),
    ...(canCheckVisitors ? [{ label: "Check in / out", path: "/visitor-checkin", icon: ScanLine }] : []),
    ...(canViewVisitors ? [{ label: "Registrations", path: "/visitor-records", icon: FileText }] : []),
  ];
  const groups: NavGroup[] = user?.role === "guard" ? [
    ...(moduleEnabled("attendance") ? [{ id: "guard", label: "Guard station", icon: CalendarCheck, items: [{ label: "Attendance", path: "/guard/attendance", icon: CalendarCheck }] }] : []),
    ...(moduleEnabled("visitors") && visitorItems.length ? [{ id: "visitors", label: "Visitor Management", icon: ClipboardList, items: visitorItems }] : []),
  ] : user?.role === "super_admin" ? [{
    id: "platform",
    label: "Platform",
    icon: Building2,
    items: [{ label: "Platform admin", path: "/platform", icon: Building2 }],
  }] : [
    {
      id: "payment-recovery",
      label: "Payment Recovery",
      icon: Target,
      items: [
        ...(moduleEnabled("reports") ? [{ label: "Overview", path: "/dashboard", icon: LayoutDashboard }] : []),
        ...(moduleEnabled("customers") ? [{ label: "Customers", path: "/customers", icon: Users }] : []),
        ...(moduleEnabled("invoices") ? [{ label: "Invoices", path: "/invoices", icon: FileText }] : []),
        ...(moduleEnabled("payments") ? [{ label: "Payments", path: "/payments", icon: CreditCard }] : []),
        ...(moduleEnabled("recovery") ? [{ label: "Recovery", path: "/recovery", icon: Target }] : []),
        ...(moduleEnabled("commitments") ? [{ label: "Commitments", path: "/commitments", icon: Handshake }] : []),
      ],
    },
    {
      id: "workforce",
      label: "Workforce",
      icon: CalendarCheck,
      items: [
        ...(moduleEnabled("workforce") ? [{ label: "Employees", path: "/workforce", icon: Users }, { label: "Shifts", path: "/workforce/shifts", icon: Clock3 }] : []),
        ...(moduleEnabled("payroll") ? [user?.role === "employee" ? { label: "My payslips", path: "/my-payroll", icon: Wallet } : { label: "Earnings & pay", path: "/payroll", icon: Wallet }] : []),
        ...(moduleEnabled("overtime") ? [{ label: "Overtime", path: "/overtime", icon: Timer }] : []),
        ...(moduleEnabled("leave") ? [{ label: user?.role === "employee" ? "My leave" : "Leave & approvals", path: "/leave", icon: Umbrella }] : []),
        ...(moduleEnabled("compliance") && user?.role !== "employee" ? [{ label: "Compliance rules", path: "/compliance", icon: FileText }] : []),
        ...(moduleEnabled("reports") && ["workforce", "payroll", "attendance", "overtime", "leave"].some((key) => moduleEnabled(key as OrganizationModuleKey)) ? [{ label: "Workforce reports", path: "/workforce/reports", icon: FileText }] : []),
        ...(moduleEnabled("attendance") ? [{ label: "Attendance", path: "/attendance", icon: CalendarCheck }] : []),
      ],
    },
    ...(moduleEnabled("visitors") && visitorItems.length ? [{ id: "visitors", label: "Visitor Management", icon: ClipboardList, items: visitorItems }] : []),
    {
      id: "workspace",
      label: "Workspace",
      icon: Settings,
      items: [
        ...(moduleEnabled("settings") ? [{ label: "Settings & team", path: "/settings", icon: Settings }] : []),
      ],
    },
  ];
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !isPathHidden(user, item.path)) }))
    .filter((group) => group.items.length > 0);
  return applyNavOrder(visibleGroups, user?.organization?.navOrder);
}

/**
 * Sorts sections and their screens by the organization's saved order (section ids and screen paths).
 * Anything not in the saved list keeps its default position after the ordered entries.
 */
export function applyNavOrder(groups: NavGroup[], order: string[] | undefined | null): NavGroup[] {
  if (!order?.length) return groups;
  const rank = new Map(order.map((key, index) => [key, index]));
  const sortBy = <T,>(list: T[], keyOf: (item: T) => string) =>
    list
      .map((item, index) => ({ item, index }))
      .sort((a, b) => (rank.get(keyOf(a.item)) ?? order.length + a.index) - (rank.get(keyOf(b.item)) ?? order.length + b.index))
      .map(({ item }) => item);
  return sortBy(groups, (group) => group.id).map((group) => ({ ...group, items: sortBy(group.items, (item) => item.path) }));
}

/** The first menu screen the user is allowed to open, or null when nothing is assigned. */
export function firstNavPath(user: NavUser): string | null {
  return buildNavGroups(user)[0]?.items[0]?.path ?? null;
}
