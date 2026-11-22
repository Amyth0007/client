import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Mail, Plus } from "lucide-react";
import { api } from "../../services/api-client.js";
import { useAuth } from "../auth/AuthContext.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { Tabs } from "../../components/common/Tabs.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { ORGANIZATION_MODULES, organizationModuleEnabled, type OrganizationModuleKey } from "../platform/module-registry.js";
import { ACTION_PERMISSIONS } from "../platform/action-permission-registry.js";

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeToReset, setEmployeeToReset] = useState<any>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isManagingGmail, setIsManagingGmail] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<any>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [actionPermissionDraft, setActionPermissionDraft] = useState<string[]>([]);
  const [scopeDraft, setScopeDraft] = useState<{ mode: "organization" | "selected"; departmentIds: string[]; locationIds: string[] }>({ mode: "organization", departmentIds: [], locationIds: [] });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [customRoleForm, setCustomRoleForm] = useState<{ id: string; name: string; description: string; modules: string[]; actions: string[] }>({ id: "", name: "", description: "", modules: [], actions: [] });
  const [settingsTab, setSettingsTab] = useState("organization");

  const isOrgAdmin = user?.role === "org_admin" || user?.role === "super_admin";
  const canManageGmail = user?.role === "org_admin";
  const gmailEnabled = !user?.organizationId || organizationModuleEnabled(user.organization?.modules, "gmail");

  // Load Organization
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: () => api.getOrganization(),
  });

  const { data: gmailConnection, isLoading: gmailLoading } = useQuery({
    queryKey: ["gmail-connection"],
    queryFn: () => api.getGmailConnection(),
    enabled: gmailEnabled && (user?.role === "org_admin" || user?.role === "accounts_manager"),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("gmail");
    if (!result) return;
    if (result === "connected") toast.success("Gmail connected successfully");
    else toast.error("Gmail authorization was not completed. You can try again.");
    window.history.replaceState({}, "", window.location.pathname);
    void queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
  }, [queryClient]);

  // Load Employees
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => (isOrgAdmin ? api.listEmployees({ limit: 50 }) : null),
    enabled: isOrgAdmin,
  });
  const { data: customRoles = [] } = useQuery({ queryKey: ["custom-roles"], queryFn: () => api.listCustomRoles(), enabled: isOrgAdmin });
  const { data: workforceDepartments = [] } = useQuery({ queryKey: ["workforce-departments"], queryFn: () => api.listWorkforceDepartments(), enabled: isOrgAdmin && organizationModuleEnabled(organization?.modules ?? user?.organization?.modules, "workforce") });
  const { data: attendanceConfig } = useQuery({ queryKey: ["attendance-config"], queryFn: () => api.getAttendanceConfig(), enabled: isOrgAdmin && organizationModuleEnabled(organization?.modules ?? user?.organization?.modules, "attendance") });

  // Org form
  const { register: regOrg, handleSubmit: handleOrgSubmit, setValue: setOrgValue, watch: watchOrg } = useForm({
    values: {
      name: organization?.name ?? "",
      legalName: organization?.legalName ?? "",
      address: organization?.address ?? "",
      gstin: organization?.gstin ?? "",
      timezone: organization?.timezone ?? "Asia/Kolkata",
    },
  });

  // Employee form
  const {
    register: regEmp,
    handleSubmit: handleEmpSubmit,
    reset: resetEmpForm,
    watch: watchEmp,
    setValue: setEmpValue,
    formState: { errors: empErrors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      role: "field_recovery",
      temporaryPassword: "",
      modulePermissions: [] as string[],
      actionPermissions: [] as string[],
      customRoleId: "",
    },
  });

  const onSaveOrg = async (values: any) => {
    setIsSavingOrg(true);
    try {
      await api.updateOrganization(values);
      toast.success("Organization profile updated!");
      queryClient.invalidateQueries({ queryKey: ["organization-settings"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update organization");
    } finally {
      setIsSavingOrg(false);
    }
  };

  const connectGmail = async () => {
    setIsManagingGmail(true);
    try {
      const authorizationUrl = await api.startGmailAuthorization();
      window.location.assign(authorizationUrl);
    } catch (err: any) {
      toast.error(err?.message || "Could not start Gmail authorization");
      setIsManagingGmail(false);
    }
  };

  const disconnectGmail = async () => {
    setIsManagingGmail(true);
    try {
      await api.disconnectGmail();
      toast.success("Gmail disconnected");
      await queryClient.invalidateQueries({ queryKey: ["gmail-connection"] });
    } catch (err: any) {
      toast.error(err?.message || "Could not disconnect Gmail");
    } finally {
      setIsManagingGmail(false);
    }
  };

  const onAddEmployee = async (values: any) => {
    setIsCreatingEmployee(true);
    try {
      const selectedModules = (values.modulePermissions ?? []).filter((module: string) => values.role !== "sub_admin" || module !== "settings");
      const payload = values.role === "sub_admin" && values.customRoleId
        ? { ...values, modulePermissions: [], actionPermissions: [], customRoleId: values.customRoleId }
        : { ...values, modulePermissions: values.role === "org_admin" ? undefined : selectedModules, actionPermissions: values.role === "sub_admin" ? (values.actionPermissions ?? []).filter((permission: string) => selectedModules.includes(ACTION_PERMISSIONS.find((item) => item.key === permission)?.module ?? "")) : [], customRoleId: null };
      await api.createEmployee(payload);
      toast.success("Employee created successfully!");
      setEmployeeModalOpen(false);
      resetEmpForm();
      queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create employee");
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  const saveCustomRole = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const payload = { name: customRoleForm.name, description: customRoleForm.description, modulePermissions: customRoleForm.modules, actionPermissions: customRoleForm.actions };
      if (customRoleForm.id) await api.updateCustomRole(customRoleForm.id, payload); else await api.createCustomRole(payload);
      toast.success(customRoleForm.id ? "Custom role updated" : "Custom role created");
      setCustomRoleForm({ id: "", name: "", description: "", modules: [], actions: [] });
      await queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (error: any) { toast.error(error?.message || "Could not save custom role"); }
  };
  const archiveRole = async (id: string) => {
    try { await api.archiveCustomRole(id); toast.success("Custom role archived"); await queryClient.invalidateQueries({ queryKey: ["custom-roles"] }); }
    catch (error: any) { toast.error(error?.message || "Could not archive role"); }
  };

  const editEmployeePermissions = (employee: any) => {
    setPermissionsTarget(employee);
    const modules = organization?.modules ?? user?.organization?.modules;
    setPermissionDraft(Object.entries(employee.modulePermissions ?? {}).filter(([key, allowed]) => allowed && !(employee.role === "sub_admin" && key === "settings") && organizationModuleEnabled(modules, key as OrganizationModuleKey)).map(([key]) => key));
    setActionPermissionDraft(employee.actionPermissions ?? []);
    setScopeDraft(employee.workforceScope ?? { mode: "organization", departmentIds: [], locationIds: [] });
  };
  const saveEmployeePermissions = async () => {
    if (!permissionsTarget) return;
    setIsSavingPermissions(true);
    try {
      const modules = permissionDraft.filter((key) => organizationModuleEnabled(availableOrganizationModules, key as OrganizationModuleKey));
      await api.updateEmployee(permissionsTarget.id, { modulePermissions: modules, ...(permissionsTarget.role === "sub_admin" ? { actionPermissions: actionPermissionDraft.filter((permission) => modules.includes(ACTION_PERMISSIONS.find((item) => item.key === permission)?.module ?? "")), workforceScope: scopeDraft } : {}) });
      toast.success("Access permissions updated");
      setPermissionsTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (error: any) { toast.error(error?.message || "Could not update screen access"); }
    finally { setIsSavingPermissions(false); }
  };

  const handleToggleEmployeeStatus = async (emp: any) => {
    const nextStatus = emp.status === "active" ? "disabled" : "active";
    try {
      await api.updateEmployee(emp.id, { status: nextStatus });
      toast.success(`User marked ${nextStatus}`);
      queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to change user status");
    }
  };

  const handleChangeEmployeeRoleChoice = async (emp: any, choice: string) => {
    try {
      const isCustomSubadminRole = choice.startsWith("sub_admin:");
      await api.updateEmployee(emp.id, isCustomSubadminRole
        ? { role: "sub_admin", customRoleId: choice.slice("sub_admin:".length) }
        : { role: choice, ...(choice === "sub_admin" ? { customRoleId: null } : {}) });
      toast.success(`${emp.name}'s role updated`);
      await queryClient.invalidateQueries({ queryKey: ["employees-list"] });
      return true;
    } catch (error: any) { toast.error(error?.message || "Failed to update employee role"); return false; }
  };

  const handleResetEmployeePassword = async (emp: any) => {
    setEmployeeToReset(emp);
    setTemporaryPassword("");
  };

  const confirmResetEmployeePassword = async () => {
    if (temporaryPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!employeeToReset) return;
    setIsResettingPassword(true);
    try {
      await api.updateEmployee(employeeToReset.id, { temporaryPassword });
      toast.success("Staff password updated by admin");
      setEmployeeToReset(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const employees = employeesData?.data ?? [];
  const availableOrganizationModules = organization?.modules ?? user?.organization?.modules;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Settings & Workspace Administration"
        description="Configure organization profile, recovery policies, and employee permissions"
      />

      <Tabs ariaLabel="Settings sections" activeTab={settingsTab} onChange={setSettingsTab} tabs={[
        { id: "organization", label: "Organization" },
        ...(isOrgAdmin ? [{ id: "team", label: "Team & access" }, { id: "roles", label: "Subadmin roles" }] : []),
      ]} />

      {/* Organization Profile */}
      {settingsTab === "organization" && <Card title="Organization Profile" subtitle="Commercial identity and tenant details">
        {orgLoading ? (
          <div className="h-32 bg-slate-50 animate-pulse rounded-xl" />
        ) : (
          <form onSubmit={handleOrgSubmit(onSaveOrg)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Organization Display Name"
                disabled={!isOrgAdmin}
                {...regOrg("name")}
              />

              <Input
                label="Legal Entity Name"
                disabled={!isOrgAdmin}
                {...regOrg("legalName")}
              />

              <Input label="Company Address (shown on payslips)" disabled={!isOrgAdmin} {...regOrg("address")} />

              <Input
                label="GSTIN"
                disabled={!isOrgAdmin}
                {...regOrg("gstin")}
              />

              <CustomSelect
                label="Operational Timezone"
                disabled={!isOrgAdmin}
                value={watchOrg("timezone")}
                onChange={(event) => setOrgValue("timezone", event.target.value, { shouldDirty: true })}
                options={[
                  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
                  { value: "UTC", label: "UTC (+0:00)" },
                  { value: "Asia/Dubai", label: "Asia/Dubai (+4:00)" },
                  { value: "Asia/Singapore", label: "Asia/Singapore (+8:00)" },
                ]}
              />
            </div>

            {isOrgAdmin && (
              <div className="flex justify-end pt-2">
                <Button type="submit" isLoading={isSavingOrg}>
                  Save Profile Changes
                </Button>
              </div>
            )}
          </form>
        )}
      </Card>}

      {settingsTab === "organization" && gmailEnabled && <Card title="Gmail integration" subtitle="Send payment reminders and invoice documents from your organization Gmail account">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700"><Mail className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {gmailLoading ? "Checking connection…" : gmailConnection?.connected ? `Connected as ${gmailConnection.email}` : gmailConnection?.status === "reauthorization_required" ? `Reconnect ${gmailConnection.email || "Gmail"}` : "No Gmail account connected"}
              </p>
              <p className="mt-1 text-xs text-slate-600">Only permission to send mail is requested. Inbox access is not requested.</p>
              {gmailConnection?.lastSuccessfulEmailAt && <p className="mt-1 text-xs text-slate-500">Last email sent {new Date(gmailConnection.lastSuccessfulEmailAt).toLocaleString()}</p>}
            </div>
          </div>
          {canManageGmail && <div className="flex flex-wrap gap-2">
            {gmailConnection?.email && <Button size="sm" variant="outline" isLoading={isManagingGmail} onClick={() => void disconnectGmail()}>Disconnect Gmail</Button>}
            {!gmailConnection?.connected && <Button size="sm" isLoading={isManagingGmail} onClick={() => void connectGmail()}>{gmailConnection?.status === "reauthorization_required" ? "Reconnect Gmail" : "Connect Gmail"}</Button>}
          </div>}
        </div>
      </Card>}

      {/* Employee Management Section (Only visible to Org Admins) */}
      {settingsTab === "team" && isOrgAdmin && (
        <Card
          title="Team & Employee Access"
          subtitle="Manage user roles, credentials, and field executive accounts"
          action={
            <Button size="sm" onClick={() => setEmployeeModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>Add Employee</span>
            </Button>
          }
        >
          {employeesLoading ? (
            <div className="h-32 bg-slate-50 animate-pulse rounded-xl" />
          ) : employees.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No team members found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500 sm:hidden">Swipe horizontally to view roles and actions.</p>
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-semibold">
                    <th className="whitespace-nowrap px-4 py-3">Name & Email</th>
                    <th className="whitespace-nowrap px-4 py-3">Role</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="min-w-[250px] px-4 py-4">
                        <span className="block whitespace-nowrap font-semibold text-slate-900">{emp.name}</span>
                        <span className="block whitespace-nowrap text-slate-500">{emp.email}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {emp.id === user?.id ? (
                          emp.customRoleName || (emp.role === "sub_admin" ? "Subadmin" : emp.role === "accounts_manager" ? "Account Manager" : emp.role === "field_recovery" ? "Field Executive" : emp.role === "employee" ? "Employee" : emp.role === "org_admin" ? "Organization Admin" : "Super Admin")
                        ) : (
                          <CustomSelect
                            portal
                            className="min-w-[190px]"
                            value={emp.role === "sub_admin" && emp.customRoleId ? `sub_admin:${emp.customRoleId}` : emp.role}
                            onChange={(event) => void handleChangeEmployeeRoleChoice(emp, event.target.value)}
                            options={[{ value: "org_admin", label: "Organization Admin" }, { value: "sub_admin", label: "Subadmin · Individual permissions" }, ...[...customRoles].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((role: any) => ({ value: `sub_admin:${role.id}`, label: `Subadmin · ${role.name}` })), { value: "accounts_manager", label: "Account Manager" }, { value: "field_recovery", label: "Field Executive" }, { value: "guard", label: "Guard" }, { value: "employee", label: "Employee"}]}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-center">
                        <Badge variant={emp.status === "active" ? "success" : "neutral"}>
                          {emp.status}
                        </Badge>
                      </td>
                      <td className="min-w-[250px] whitespace-nowrap px-4 py-4 text-right">
                        {emp.id !== user?.id && (
                          <>
                          <button onClick={() => void handleResetEmployeePassword(emp)} className="mr-3 text-xs font-medium text-indigo-600 hover:underline">Set password</button>
                          {emp.role !== "org_admin" && <button onClick={() => editEmployeePermissions(emp)} className="mr-3 text-xs font-medium text-indigo-600 hover:underline">Screens</button>}
                          <button
                            onClick={() => handleToggleEmployeeStatus(emp)}
                            className={`text-xs font-medium hover:underline ${
                              emp.status === "active"
                                ? "text-rose-600 hover:text-rose-700"
                                : "text-emerald-600 hover:text-emerald-700"
                            }`}
                          >
                            {emp.status === "active" ? "Disable" : "Enable"}
                          </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {settingsTab === "roles" && isOrgAdmin && <Card title="Custom subadmin roles" subtitle="Create reusable, tenant-scoped module and action bundles. Role changes apply to assigned subadmins immediately.">
        <form onSubmit={(event) => void saveCustomRole(event)} className="grid gap-3 sm:grid-cols-2">
          <Input label="Role name" required minLength={2} value={customRoleForm.name} onChange={(event) => setCustomRoleForm({ ...customRoleForm, name: event.target.value })} />
          <Input label="Description" value={customRoleForm.description} onChange={(event) => setCustomRoleForm({ ...customRoleForm, description: event.target.value })} />
          <fieldset className="rounded-xl border p-3 sm:col-span-2"><legend className="px-1 text-sm font-semibold">Enabled modules</legend><div className="grid gap-2 sm:grid-cols-3">{ORGANIZATION_MODULES.filter((module) => module.key !== "settings").sort((a, b) => a.name.localeCompare(b.name)).map((module) => { const enabled = organizationModuleEnabled(availableOrganizationModules, module.key); const checked = customRoleForm.modules.includes(module.key); return <label key={module.key} className={`flex items-center gap-2 text-xs ${enabled ? "" : "opacity-50"}`}><input type="checkbox" disabled={!enabled} checked={checked} onChange={(event) => setCustomRoleForm((current) => ({ ...current, modules: event.target.checked ? [...current.modules, module.key] : current.modules.filter((key) => key !== module.key), actions: event.target.checked ? current.actions : current.actions.filter((key) => ACTION_PERMISSIONS.find((permission) => permission.key === key)?.module !== module.key) }))} />{module.name}</label>; })}</div></fieldset>
          <fieldset className="rounded-xl border p-3 sm:col-span-2"><legend className="px-1 text-sm font-semibold">Allowed actions</legend>{customRoleForm.modules.length === 0 ? <p className="text-xs text-slate-500">Choose an enabled module first.</p> : <div className="grid gap-3 md:grid-cols-2">{ORGANIZATION_MODULES.filter((module) => customRoleForm.modules.includes(module.key)).sort((a, b) => a.name.localeCompare(b.name)).map((module) => { const moduleActions = ACTION_PERMISSIONS.filter((permission) => permission.module === module.key).sort((a, b) => a.name.localeCompare(b.name)); return moduleActions.length ? <div key={module.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><h3 className="mb-2 text-xs font-semibold text-slate-800">{module.name}</h3><div className="space-y-2">{moduleActions.map((permission) => <label key={permission.key} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={customRoleForm.actions.includes(permission.key)} onChange={(event) => setCustomRoleForm((current) => ({ ...current, actions: event.target.checked ? [...current.actions, permission.key] : current.actions.filter((key) => key !== permission.key) }))} />{permission.name}</label>)}</div></div> : null; })}</div>}</fieldset>
          <div className="flex justify-end gap-2 sm:col-span-2">{customRoleForm.id && <Button type="button" variant="outline" onClick={() => setCustomRoleForm({ id: "", name: "", description: "", modules: [], actions: [] })}>Cancel edit</Button>}<Button type="submit">{customRoleForm.id ? "Save role" : "Create role"}</Button></div>
        </form>
        <div className="mt-4 divide-y">{[...customRoles].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((role: any) => <div key={role.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{role.name}</p><p className="text-xs text-slate-500">{role.description || "No description"} · {role.modulePermissions.length} module(s) · {role.actionPermissions.length} action(s)</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setCustomRoleForm({ id: role.id, name: role.name, description: role.description, modules: role.modulePermissions, actions: role.actionPermissions })}>Edit</Button><Button size="sm" variant="secondary" onClick={() => void archiveRole(role.id)}>Archive</Button></div></div>)}</div>
      </Card>}

      {/* Add Employee Modal */}
      <Modal
        isOpen={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        title="Add New Employee"
        description="Provision team member with temporary password and designated role"
      >
        <form onSubmit={handleEmpSubmit(onAddEmployee)} className="space-y-4">
          <Input
            label="Full Name"
            required
            placeholder="e.g. Anand Sharma"
            error={empErrors.name?.message}
            {...regEmp("name", { required: "Name is required" })}
          />

          <Input
            label="Work Email"
            type="email"
            required
            placeholder="anand@company.com"
            error={empErrors.email?.message}
            {...regEmp("email", { required: "Email is required" })}
          />

          <CustomSelect
            label="Role & Permissions"
            required
            value={watchEmp("role") === "sub_admin" && watchEmp("customRoleId") ? `sub_admin:${watchEmp("customRoleId")}` : watchEmp("role")}
            onChange={(event) => {
              const value = event.target.value;
              if (value.startsWith("sub_admin:")) {
                setEmpValue("role", "sub_admin", { shouldDirty: true });
                setEmpValue("customRoleId", value.slice("sub_admin:".length), { shouldDirty: true });
              } else {
                setEmpValue("role", value, { shouldDirty: true });
                if (value !== "sub_admin") setEmpValue("customRoleId", "", { shouldDirty: true });
              }
            }}
            options={[
              { value: "field_recovery", label: "Field Executive (Assigned Visits & Follow-up)" },
              { value: "guard", label: "Guard (Employee check-in / check-out on mobile)" },
              { value: "employee", label: "Employee (Choose screen access)" },
              { value: "accounts_manager", label: "Account Manager (Invoices, Payments & Recovery)" },
              { value: "sub_admin", label: "Subadmin (Manage assigned modules, including Attendance)" },
              ...customRoles.map((role: any) => ({ value: `sub_admin:${role.id}`, label: `Subadmin · ${role.name}` })),
              { value: "org_admin", label: "Organization Admin (Full Control)" },
            ]}
          />

          {watchEmp("role") === "sub_admin" && <CustomSelect label="Custom permission role (optional)" value={watchEmp("customRoleId")} onChange={(event) => setEmpValue("customRoleId", event.target.value, { shouldDirty: true })} options={[{ value: "", label: "Configure individual permissions below" }, ...customRoles.map((role: any) => ({ value: role.id, label: role.name }))]} />}

          {watchEmp("role") !== "org_admin" && !(watchEmp("role") === "sub_admin" && watchEmp("customRoleId")) && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold text-slate-800">Screens this staff member can access</legend><p className="mb-2 text-xs text-slate-500">Select enabled modules. Subadmins cannot manage organization settings or team access.</p><div className="grid gap-2 sm:grid-cols-2">{ORGANIZATION_MODULES.map((module) => { const enabledForOrganization = organizationModuleEnabled(availableOrganizationModules, module.key); const restrictedForSubAdmin = watchEmp("role") === "sub_admin" && module.key === "settings"; return <label key={module.key} className={`flex items-start gap-2 rounded-lg p-2 text-xs ${enabledForOrganization && !restrictedForSubAdmin ? "hover:bg-slate-50" : "cursor-not-allowed opacity-50"}`}><input type="checkbox" value={module.key} disabled={!enabledForOrganization || restrictedForSubAdmin} {...regEmp("modulePermissions")} /><span><span className="block font-medium text-slate-800">{module.name}{module.key === "attendance" && !enabledForOrganization ? " · enable in Platform Administration" : restrictedForSubAdmin ? " · org admin only" : ""}</span><span className="text-slate-500">{module.description}</span></span></label>; })}</div></fieldset>}

          {watchEmp("role") === "sub_admin" && !watchEmp("customRoleId") && <fieldset className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3"><legend className="px-1 text-sm font-semibold text-slate-800">Allowed actions</legend><p className="mb-2 text-xs text-slate-600">Choose actions inside the modules above. View access is limited to each module’s read-only screens.</p><div className="grid gap-2 sm:grid-cols-2">{ACTION_PERMISSIONS.filter((permission) => (watchEmp("modulePermissions") ?? []).includes(permission.module)).map((permission) => <label key={permission.key} className="flex items-center gap-2 rounded-lg bg-white p-2 text-xs text-slate-700"><input type="checkbox" value={permission.key} {...regEmp("actionPermissions")} /><span>{permission.name}</span></label>)}</div>{(watchEmp("modulePermissions") ?? []).length === 0 && <p className="text-xs text-slate-500">Select a module above to see its actions.</p>}</fieldset>}

          <Input
            label="Temporary Password"
            type="password"
            required
            placeholder="At least 8 characters"
            error={empErrors.temporaryPassword?.message}
            {...regEmp("temporaryPassword", {
              required: "Temporary password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            })}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmployeeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreatingEmployee}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(employeeToReset)} onClose={() => setEmployeeToReset(null)} title="Set staff password" description={employeeToReset ? `Set a temporary password for ${employeeToReset.name}` : undefined}>
        <div className="space-y-4">
          <Input label="Temporary password" type="password" required minLength={8} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} helperText="At least 8 characters. The staff member can sign in with this password." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEmployeeToReset(null)} disabled={isResettingPassword}>Cancel</Button>
            <Button isLoading={isResettingPassword} onClick={() => void confirmResetEmployeePassword()}>Save password</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(permissionsTarget)} onClose={() => setPermissionsTarget(null)} title="Staff screen access" description={permissionsTarget ? `Choose the screens ${permissionsTarget.name} can open.` : undefined}>
        <div className="space-y-4"><p className="text-xs text-slate-600">Screens must also be enabled for the organization by the platform administrator. Subadmins cannot manage organization settings or team access.</p><div className="grid gap-2 sm:grid-cols-2">{ORGANIZATION_MODULES.map((module) => { const enabledForOrganization = organizationModuleEnabled(availableOrganizationModules, module.key); const restrictedForSubAdmin = permissionsTarget?.role === "sub_admin" && module.key === "settings"; return <label key={module.key} className={`flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm ${enabledForOrganization && !restrictedForSubAdmin ? "" : "cursor-not-allowed opacity-50"}`}><input type="checkbox" checked={permissionDraft.includes(module.key)} disabled={!enabledForOrganization || restrictedForSubAdmin} onChange={(event) => setPermissionDraft((current) => event.target.checked ? [...current, module.key] : current.filter((key) => key !== module.key))} /><span><span className="block font-medium">{module.name}{module.key === "attendance" && !enabledForOrganization ? " · disabled for organization" : restrictedForSubAdmin ? " · org admin only" : ""}</span><span className="text-xs text-slate-500">{module.description}</span></span></label>; })}</div>
          {permissionsTarget?.role === "sub_admin" && <fieldset className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3"><legend className="px-1 text-sm font-semibold text-slate-800">Allowed actions</legend><p className="mb-2 text-xs text-slate-600">Action access is checked by the API and is limited to the selected modules.</p><div className="grid gap-2 sm:grid-cols-2">{ACTION_PERMISSIONS.filter((permission) => permissionDraft.includes(permission.module)).map((permission) => <label key={permission.key} className="flex items-center gap-2 rounded-lg bg-white p-2 text-xs text-slate-700"><input type="checkbox" checked={actionPermissionDraft.includes(permission.key)} onChange={(event) => setActionPermissionDraft((current) => event.target.checked ? [...current, permission.key] : current.filter((key) => key !== permission.key))} /><span>{permission.name}</span></label>)}</div></fieldset>}
          {permissionsTarget?.role === "sub_admin" && <fieldset className="rounded-xl border border-amber-100 bg-amber-50/40 p-3"><legend className="px-1 text-sm font-semibold text-slate-800">Workforce data scope</legend><p className="mb-3 text-xs text-slate-600">Organization-wide access is the default. Selected departments and locations are combined as an intersection; an unselected dimension stays unrestricted.</p><label className="flex items-center gap-2 text-sm"><input type="radio" checked={scopeDraft.mode === "organization"} onChange={() => setScopeDraft({ ...scopeDraft, mode: "organization" })} />All organization workforce records</label><label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" checked={scopeDraft.mode === "selected"} onChange={() => setScopeDraft({ ...scopeDraft, mode: "selected" })} />Restrict to selected departments or locations</label>{scopeDraft.mode === "selected" && <div className="mt-3 grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-xs font-semibold">Departments</p>{workforceDepartments.length ? workforceDepartments.map((item: any) => <label key={item.id} className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={scopeDraft.departmentIds.includes(item.id)} onChange={(event) => setScopeDraft({ ...scopeDraft, departmentIds: event.target.checked ? [...scopeDraft.departmentIds, item.id] : scopeDraft.departmentIds.filter((id) => id !== item.id) })} />{item.name}</label>) : <p className="text-xs text-slate-500">No departments available.</p>}</div><div><p className="mb-2 text-xs font-semibold">Work locations</p>{attendanceConfig?.locations?.length ? attendanceConfig.locations.map((item: any) => <label key={item.id} className="mb-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={scopeDraft.locationIds.includes(item.id)} onChange={(event) => setScopeDraft({ ...scopeDraft, locationIds: event.target.checked ? [...scopeDraft.locationIds, item.id] : scopeDraft.locationIds.filter((id) => id !== item.id) })} />{item.name}</label>) : <p className="text-xs text-slate-500">Enable Attendance and configure office locations to scope by location.</p>}</div></div>}</fieldset>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPermissionsTarget(null)}>Cancel</Button><Button isLoading={isSavingPermissions} onClick={() => void saveEmployeePermissions()}>Save access</Button></div></div>
      </Modal>
    </div>
  );
}
