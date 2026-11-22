export const ORGANIZATION_MODULES = [
  { key: "reports", name: "Dashboard & Reports", description: "Organization dashboard and business reports", defaultEnabled: true },
  { key: "customers", name: "Customers", description: "Customer records and contact details", defaultEnabled: true },
  { key: "invoices", name: "Invoices", description: "Invoice creation, documents, and acknowledgements", defaultEnabled: true },
  { key: "payments", name: "Payments", description: "Payment records, reversals, and ledgers", defaultEnabled: true },
  { key: "recovery", name: "Recovery", description: "Assignments, field visits, and call attempts", defaultEnabled: true },
  { key: "commitments", name: "Commitments", description: "Payment commitments and follow-up tracking", defaultEnabled: true },
  { key: "gmail", name: "Gmail integration", description: "Connect Gmail and send customer messages", defaultEnabled: true },
  { key: "settings", name: "Workspace settings & team", description: "Organization profile and staff administration", defaultEnabled: true },
  { key: "attendance", name: "Attendance", description: "Location-based attendance and history", defaultEnabled: false },
  { key: "workforce", name: "Workforce", description: "Employee profiles, departments, and job designations", defaultEnabled: false },
  { key: "payroll", name: "Payroll", description: "Compensation setup, daily earnings, and payroll processing", defaultEnabled: false },
  { key: "overtime", name: "Overtime", description: "Overtime policies, requests, review, and payable hours", defaultEnabled: false },
  { key: "leave", name: "Leave", description: "Leave types, balances, requests, and approvals", defaultEnabled: false },
  { key: "compliance", name: "Compliance rules", description: "Versioned jurisdictional payroll rule configuration", defaultEnabled: false },
] as const;

export type OrganizationModuleKey = (typeof ORGANIZATION_MODULES)[number]["key"];
export type OrganizationModules = Partial<Record<OrganizationModuleKey, boolean>>;

export function organizationModuleEnabled(modules: OrganizationModules | undefined, moduleKey: OrganizationModuleKey) {
  return modules?.[moduleKey] ?? ORGANIZATION_MODULES.find((module) => module.key === moduleKey)!.defaultEnabled;
}

export function userCanAccessModule(role: string | undefined, modules: OrganizationModules | undefined, permissions: Record<string, boolean> | undefined, moduleKey: OrganizationModuleKey, permissionsConfigured = false, actionPermissions?: string[]) {
  if (role === "guard" && moduleKey === "attendance") return organizationModuleEnabled(modules, moduleKey);
  const roleRequiresGrant = role !== undefined && role !== "org_admin" && role !== "super_admin";
  const hasModuleGrant = organizationModuleEnabled(modules, moduleKey) && (!roleRequiresGrant || (permissionsConfigured && permissions?.[moduleKey] === true));
  if (!hasModuleGrant) return false;
  if (role === "sub_admin" && actionPermissions !== undefined) return actionPermissions.some((permission) => permission.startsWith(`${moduleKey}.`));
  return true;
}
