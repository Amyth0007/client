import { ORGANIZATION_MODULES } from "../../modules/platform/module-registry.js";
import { ACTION_PERMISSIONS } from "../../modules/platform/action-permission-registry.js";
import { SCREENS } from "../../modules/platform/screen-registry.js";

/** `deniedScreens` hides individual screens of a granted module (deny-list, so new screens default to visible). */
export type PermissionValue = { modules: string[]; actions: string[]; deniedScreens?: string[] };

export const PERMISSION_GROUPS: Array<{ id: string; name: string; description: string; modules: string[] }> = [
  { id: "recovery", name: "Payment recovery", description: "Receivables, collections and customer follow-up", modules: ["reports", "customers", "invoices", "payments", "recovery", "commitments", "gmail"] },
  { id: "workforce", name: "Workforce & HR", description: "People, time, pay and statutory rules", modules: ["workforce", "attendance", "leave", "overtime", "payroll", "compliance"] },
  { id: "frontdesk", name: "Front desk", description: "Visitor registration and gate passes", modules: ["visitors"] },
  { id: "workspace", name: "Workspace", description: "Organization profile and team administration", modules: ["settings"] },
];

/** Actions that move money, lock records or delete history – highlighted so admins grant them deliberately. */
export const SENSITIVE_ACTIONS = new Set<string>([
  "customers.archive", "invoices.cancel", "invoices.issue", "payments.reverse", "payments.record", "commitments.cancel", "recovery.manage",
  "attendance.adjust", "attendance.manage_policy", "payroll.approve_run", "payroll.finalize_run", "payroll.record_payment", "payroll.manage_compensation",
  "overtime.approve", "leave.approve", "compliance.manage",
]);

export const isViewAction = (key: string) => key.split(".")[1]!.startsWith("view");
export const actionsOf = (moduleKey: string) => ACTION_PERMISSIONS.filter((action) => action.module === moduleKey);
export const viewActionsOf = (moduleKey: string) => {
  const views = actionsOf(moduleKey).filter((action) => isViewAction(action.key));
  return views.length ? views : actionsOf(moduleKey).slice(0, 1);
};
export const moduleOfAction = (key: string) => ACTION_PERMISSIONS.find((action) => action.key === key)?.module;

export type AccessLevel = "none" | "view" | "custom" | "full";
export function accessLevelFor(moduleKey: string, value: PermissionValue, mode: "actions" | "modules"): AccessLevel {
  if (!value.modules.includes(moduleKey)) return "none";
  if (mode === "modules") return "full";
  const all = actionsOf(moduleKey);
  const granted = all.filter((action) => value.actions.includes(action.key));
  if (!granted.length) return "none";
  if (granted.length === all.length) return "full";
  if (granted.every((action) => isViewAction(action.key))) return "view";
  return "custom";
}

/** Short human summary, e.g. "6 screens · 23 actions". */
export function permissionSummary(value: PermissionValue, mode: "actions" | "modules") {
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const hidden = (value.deniedScreens ?? []).filter((key) => value.modules.includes(SCREENS.find((screen) => screen.key === key)?.module ?? "")).length;
  return [plural(value.modules.length, "module"), mode === "actions" ? plural(value.actions.length, "action") : null, hidden ? `${hidden} screen${hidden === 1 ? "" : "s"} hidden` : null].filter(Boolean).join(" · ");
}

/** Keeps modules and actions consistent: in action mode a screen is granted exactly when one of its actions is. */
export function normalizePermissions(value: PermissionValue, mode: "actions" | "modules"): PermissionValue {
  // Hidden screens only matter for granted modules; drop the rest so revoking a module resets its screens.
  const keepScreens = (modules: string[]) => [...new Set(value.deniedScreens ?? [])].filter((key) => modules.includes(SCREENS.find((screen) => screen.key === key)?.module ?? ""));
  if (mode === "modules") { const modules = [...new Set(value.modules)]; return { modules, actions: [], deniedScreens: keepScreens(modules) }; }
  const actions = [...new Set(value.actions)].filter((key) => moduleOfAction(key));
  const modules = ORGANIZATION_MODULES.map((module) => module.key as string).filter((key) => actions.some((action) => moduleOfAction(action) === key));
  return { modules, actions, deniedScreens: keepScreens(modules) };
}

