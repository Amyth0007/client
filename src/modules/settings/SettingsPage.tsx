import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Copy, Eye, EyeOff, Info, KeyRound, Lock, Mail, PenLine, Plus, ShieldCheck, UsersRound } from "lucide-react";
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
import { organizationModuleEnabled, type OrganizationModuleKey } from "../platform/module-registry.js";
import { ACTION_PERMISSIONS } from "../platform/action-permission-registry.js";
import { MenuOrderSettings } from "./MenuOrderSettings.js";
import { PermissionChips, PermissionEditor } from "../../components/permissions/PermissionEditor.js";
import { normalizePermissions, permissionSummary } from "../../components/permissions/permission-model.js";

const ROLE_LABELS: Record<string, string> = { org_admin: "Organization Admin", sub_admin: "Subadmin", accounts_manager: "Account Manager", field_recovery: "Field Executive", employee: "Employee", guard: "Guard", super_admin: "Super Admin" };
const EMPTY_ROLE_FORM = { id: "", name: "", description: "", modules: [] as string[], actions: [] as string[] };

export function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeToReset, setEmployeeToReset] = useState<any>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [isSavingGuideSetting, setIsSavingGuideSetting] = useState(false);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isManagingGmail, setIsManagingGmail] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<any>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);
  const [actionPermissionDraft, setActionPermissionDraft] = useState<string[]>([]);
  const [scopeDraft, setScopeDraft] = useState<{ mode: "organization" | "selected"; departmentIds: string[]; locationIds: string[] }>({ mode: "organization", departmentIds: [], locationIds: [] });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [updatingRoleEmployeeId, setUpdatingRoleEmployeeId] = useState<string | null>(null);
  const [updatingStatusEmployeeId, setUpdatingStatusEmployeeId] = useState<string | null>(null);
  const [customRoleForm, setCustomRoleForm] = useState<{ id: string; name: string; description: string; modules: string[]; actions: string[] }>({ id: "", name: "", description: "", modules: [], actions: [] });
  const [settingsTab, setSettingsTab] = useState("organization");
  const [permissionTab, setPermissionTab] = useState<"access" | "scope">("access");
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);

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
    enabled: settingsTab === "organization" && gmailEnabled && (user?.role === "org_admin" || user?.role === "accounts_manager"),
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
    enabled: isOrgAdmin && (settingsTab === "team" || settingsTab === "roles"),
  });
  const { data: customRoles = [] } = useQuery({ queryKey: ["custom-roles"], queryFn: () => api.listCustomRoles(), enabled: isOrgAdmin && (settingsTab === "team" || settingsTab === "roles") });
  const { data: workforceDepartments = [] } = useQuery({ queryKey: ["workforce-departments"], queryFn: () => api.listWorkforceDepartments(), enabled: isOrgAdmin && settingsTab === "team" && Boolean(permissionsTarget) && organizationModuleEnabled(organization?.modules ?? user?.organization?.modules, "workforce") });
  const { data: attendanceConfig } = useQuery({ queryKey: ["attendance-config"], queryFn: () => api.getAttendanceConfig(), enabled: isOrgAdmin && settingsTab === "team" && Boolean(permissionsTarget) && organizationModuleEnabled(organization?.modules ?? user?.organization?.modules, "attendance") });

  // Org form
  const { register: regOrg, handleSubmit: handleOrgSubmit, setValue: setOrgValue, watch: watchOrg, reset: resetOrg, formState: { isDirty: orgDirty } } = useForm({
    defaultValues: {
      name: organization?.name ?? "",
      legalName: organization?.legalName ?? "",
      address: organization?.address ?? "",
      gstin: organization?.gstin ?? "",
      timezone: organization?.timezone ?? "Asia/Kolkata",
    },
  });

  useEffect(() => {
    if (!organization || orgDirty) return;
    resetOrg({ name: organization.name ?? "", legalName: organization.legalName ?? "", address: organization.address ?? "", gstin: organization.gstin ?? "", timezone: organization.timezone ?? "Asia/Kolkata" });
  }, [organization, orgDirty, resetOrg]);

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
    const gstin = values.gstin?.trim().toUpperCase() ?? "";
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)) {
      toast.error("Enter a valid 15-character GSTIN, or leave the field blank.");
      return;
    }
    setIsSavingOrg(true);
    try {
      const saved = await api.updateOrganization({ ...values, gstin: gstin || null });
      queryClient.setQueryData(["organization-settings"], saved);
      resetOrg({ name: saved.name ?? "", legalName: saved.legalName ?? "", address: saved.address ?? "", gstin: saved.gstin ?? "", timezone: saved.timezone ?? "Asia/Kolkata" });
      await refreshProfile();
      toast.success("Organization profile updated!");
      await queryClient.invalidateQueries({ queryKey: ["organization-settings"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update organization");
    } finally {
      setIsSavingOrg(false);
    }
  };

  const toggleGuides = async () => {
    if (!organization || isSavingGuideSetting) return;
    setIsSavingGuideSetting(true);
    const showGuides = !(organization.showGuides ?? true);
    try {
      const updated = await api.updateOrganization({ showGuides });
      queryClient.setQueryData(["organization-settings"], updated);
      await refreshProfile();
      toast.success(showGuides ? "Workflow guides enabled" : "Workflow guides hidden across the workspace");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update guide setting");
    } finally { setIsSavingGuideSetting(false); }
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
      const individual = values.role === "sub_admin" ? normalizePermissions({ modules: values.modulePermissions ?? [], actions: values.actionPermissions ?? [] }, "actions") : null;
      const selectedModules = individual ? individual.modules : (values.modulePermissions ?? []);
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
      const permissions = normalizePermissions({ modules: customRoleForm.modules, actions: customRoleForm.actions }, "actions");
      if (!permissions.actions.length) { toast.error("Grant at least one screen before saving the role"); return; }
      const payload = { name: customRoleForm.name, description: customRoleForm.description, modulePermissions: permissions.modules, actionPermissions: permissions.actions };
      if (customRoleForm.id) await api.updateCustomRole(customRoleForm.id, payload); else await api.createCustomRole(payload);
      toast.success(customRoleForm.id ? "Custom role updated" : "Custom role created");
      setCustomRoleForm(EMPTY_ROLE_FORM);
      setRoleEditorOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      await queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (error: any) { toast.error(error?.message || "Could not save custom role"); }
  };
  const archiveRole = async (id: string) => {
    try {
      await api.archiveCustomRole(id);
      toast.success("Custom role archived");
      if (customRoleForm.id === id) { setCustomRoleForm(EMPTY_ROLE_FORM); setRoleEditorOpen(false); }
      await queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
    }
    catch (error: any) { toast.error(error?.message || "Could not archive role"); }
  };

  const editEmployeePermissions = (employee: any) => {
    setPermissionsTarget(employee);
    const modules = organization?.modules ?? user?.organization?.modules;
    setPermissionDraft(Object.entries(employee.modulePermissions ?? {}).filter(([key, allowed]) => allowed && !(employee.role === "sub_admin" && key === "settings") && organizationModuleEnabled(modules, key as OrganizationModuleKey)).map(([key]) => key));
    setActionPermissionDraft(employee.actionPermissions ?? []);
    setScopeDraft(employee.workforceScope ?? { mode: "organization", departmentIds: [], locationIds: [] });
    setPermissionTab("access");
  };
  const openRoleEditor = (role?: any, duplicate = false) => {
    setCustomRoleForm(role ? { id: duplicate ? "" : role.id, name: duplicate ? `${role.name} (copy)` : role.name, description: role.description ?? "", modules: role.modulePermissions ?? [], actions: role.actionPermissions ?? [] } : EMPTY_ROLE_FORM);
    setRoleEditorOpen(true);
  };
  const saveEmployeePermissions = async () => {
    if (!permissionsTarget) return;
    setIsSavingPermissions(true);
    try {
      const isSubAdmin = permissionsTarget.role === "sub_admin";
      const draft = normalizePermissions({ modules: permissionDraft.filter((key) => organizationModuleEnabled(availableOrganizationModules, key as OrganizationModuleKey)), actions: actionPermissionDraft }, isSubAdmin ? "actions" : "modules");
      await api.updateEmployee(permissionsTarget.id, { modulePermissions: draft.modules, ...(isSubAdmin ? { actionPermissions: draft.actions, workforceScope: scopeDraft } : {}) });
      toast.success("Access permissions updated");
      setPermissionsTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (error: any) { toast.error(error?.message || "Could not update screen access"); }
    finally { setIsSavingPermissions(false); }
  };

  const handleToggleEmployeeStatus = async (emp: any) => {
    if (updatingStatusEmployeeId) return;
    const nextStatus = emp.status === "active" ? "disabled" : "active";
    setUpdatingStatusEmployeeId(emp.id);
    try {
      await api.updateEmployee(emp.id, { status: nextStatus });
      toast.success(`User marked ${nextStatus}`);
      queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to change user status");
    } finally { setUpdatingStatusEmployeeId(null); }
  };

  const handleChangeEmployeeRoleChoice = async (emp: any, choice: string) => {
    if (updatingRoleEmployeeId) return false;
    setUpdatingRoleEmployeeId(emp.id);
    const isCustomSubadminRole = choice.startsWith("sub_admin:");
    const expectedRole = isCustomSubadminRole ? "sub_admin" : choice;
    const expectedCustomRoleId = isCustomSubadminRole ? choice.slice("sub_admin:".length) : null;
    const applyEmployeeUpdate = (updated: any) => {
      queryClient.setQueryData(["employees-list"], (current: any) => current
        ? { ...current, data: current.data.map((item: any) => item.id === updated.id ? { ...item, ...updated } : item) }
        : current);
    };
    try {
      const updated = await api.updateEmployee(emp.id, isCustomSubadminRole
        ? { role: expectedRole, customRoleId: expectedCustomRoleId }
        : { role: expectedRole, ...(expectedRole === "sub_admin" ? { customRoleId: null } : {}) });
      applyEmployeeUpdate(updated);
      toast.success(`${emp.name}'s role updated`);
      void queryClient.invalidateQueries({ queryKey: ["employees-list"] }).catch(() => undefined);
      return true;
    } catch (error: any) {
      // If the connection failed after the server committed, reconcile from the
      // authoritative list before telling the admin the update itself failed.
      try {
        const latest = await api.listEmployees({ limit: 50 });
        const serverEmployee = latest.data.find((item: any) => item.id === emp.id);
        if (serverEmployee?.role === expectedRole && (serverEmployee.customRoleId ?? null) === expectedCustomRoleId) {
          queryClient.setQueryData(["employees-list"], latest);
          toast.success(`${emp.name}'s role updated`);
          return true;
        }
        queryClient.setQueryData(["employees-list"], latest);
      } catch {
        // Keep the original mutation error; the reconciliation request is best effort.
      }
      toast.error(error?.message || "Failed to update employee role");
      return false;
    }
    finally { setUpdatingRoleEmployeeId(null); }
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
        ...(isOrgAdmin ? [{ id: "team", label: "Team & access" }, { id: "roles", label: "Subadmin roles" }, { id: "menu", label: "Menu order" }] : []),
      ]} />

      {settingsTab === "menu" && isOrgAdmin && <MenuOrderSettings />}

      {settingsTab === "team" && isOrgAdmin && <Card title="Workspace guide display" subtitle="Control workflow guides across all workspace screens for your organization.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-slate-800">Workflow guides are {organization?.showGuides === false ? "hidden" : "visible"}</p><p className="text-xs text-slate-500">Team members can still hide an individual guide from its screen header.</p></div>
          <Button type="button" size="sm" variant={organization?.showGuides === false ? "outline" : "secondary"} isLoading={isSavingGuideSetting} onClick={() => toggleGuides()}>
            {organization?.showGuides === false ? <><Eye className="h-4 w-4" />Enable guides</> : <><EyeOff className="h-4 w-4" />Hide all guides</>}
          </Button>
        </div>
      </Card>}

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
                <Button type="submit" isLoading={isSavingOrg} disabled={!orgDirty || isSavingOrg}>
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
            {gmailConnection?.email && <Button size="sm" variant="outline" isLoading={isManagingGmail} onClick={() => disconnectGmail()}>Disconnect Gmail</Button>}
            {!gmailConnection?.connected && <Button size="sm" isLoading={isManagingGmail} onClick={() => connectGmail()}>{gmailConnection?.status === "reauthorization_required" ? "Reconnect Gmail" : "Connect Gmail"}</Button>}
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
              <table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-semibold">
                    <th className="whitespace-nowrap px-4 py-3">Name & Email</th>
                    <th className="whitespace-nowrap px-4 py-3">Role</th>
                    <th className="whitespace-nowrap px-4 py-3">Access</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="min-w-[230px] px-4 py-4">
                        <span className="block whitespace-nowrap font-semibold text-slate-900">{emp.name}</span>
                        <span className="block whitespace-nowrap text-slate-500">{emp.email}</span>
                        <Badge className="mt-1" variant={emp.status === "active" ? "success" : "neutral"}>{emp.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {emp.id === user?.id ? (
                          emp.customRoleName || (emp.role === "sub_admin" ? "Subadmin" : emp.role === "accounts_manager" ? "Account Manager" : emp.role === "field_recovery" ? "Field Executive" : emp.role === "employee" ? "Employee" : emp.role === "org_admin" ? "Organization Admin" : "Super Admin")
                        ) : (
                          <>
                          <CustomSelect
                            portal
                            className="min-w-[190px]"
                            disabled={updatingRoleEmployeeId === emp.id}
                            value={emp.role === "sub_admin" && emp.customRoleId ? `sub_admin:${emp.customRoleId}` : emp.role}
                            onChange={(event) => void handleChangeEmployeeRoleChoice(emp, event.target.value)}
                            options={[{ value: "org_admin", label: "Organization Admin" }, { value: "sub_admin", label: "Subadmin · Individual permissions" }, ...[...customRoles].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((role: any) => ({ value: `sub_admin:${role.id}`, label: `Subadmin · ${role.name}` })), { value: "accounts_manager", label: "Account Manager" }, { value: "field_recovery", label: "Field Executive" }, { value: "guard", label: "Guard" }, { value: "employee", label: "Employee"}]}
                          />
                          {updatingRoleEmployeeId === emp.id && <span className="ml-2 text-[10px] text-slate-500">Updating role…</span>}
                          </>
                        )}
                      </td>
                      <td className="min-w-[190px] px-4 py-4">
                        {emp.role === "org_admin" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700"><ShieldCheck className="h-3 w-3" />Full access</span>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {emp.customRoleName ? <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700"><KeyRound className="h-3 w-3" />{emp.customRoleName}</span> : null}
                              {permissionSummary({ modules: Object.entries(emp.modulePermissions ?? {}).filter(([, on]) => on).map(([key]) => key), actions: emp.actionPermissions ?? [] }, emp.role === "sub_admin" ? "actions" : "modules")}
                            </span>
                            <PermissionChips modules={Object.entries(emp.modulePermissions ?? {}).filter(([, on]) => on).map(([key]) => key)} max={3} />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        {emp.id !== user?.id && (
                          <>
                          <button onClick={() => handleResetEmployeePassword(emp)} className="mr-3 text-xs font-medium text-indigo-600 hover:underline">Set password</button>
                          {emp.role !== "org_admin" && <button onClick={() => editEmployeePermissions(emp)} className="mr-3 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"><ShieldCheck className="h-3.5 w-3.5" />Permissions</button>}
                          <button
                            onClick={() => handleToggleEmployeeStatus(emp)}
                            disabled={updatingStatusEmployeeId === emp.id}
                            className={`text-xs font-medium hover:underline ${
                              emp.status === "active"
                                ? "text-rose-600 hover:text-rose-700"
                                : "text-emerald-600 hover:text-emerald-700"
                            }`}
                          >
                            {updatingStatusEmployeeId === emp.id ? "Updating…" : emp.status === "active" ? "Disable" : "Enable"}
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

      {settingsTab === "roles" && isOrgAdmin && (
        <Card
          title="Custom subadmin roles"
          subtitle="Reusable permission sets for subadmins. Editing a role updates everyone assigned to it immediately."
          action={<Button size="sm" onClick={() => openRoleEditor()}><Plus className="h-4 w-4" /><span>New role</span></Button>}
        >
          {customRoles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><KeyRound className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold text-slate-800">No custom roles yet</p><p className="text-xs text-slate-500">Bundle screens and actions once (for example “Accounts Head”), then assign it to any subadmin.</p></div>
              <Button size="sm" onClick={() => openRoleEditor()}><Plus className="h-4 w-4" /><span>Create the first role</span></Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...customRoles].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((role: any) => {
                const members = employees.filter((emp: any) => emp.customRoleId === role.id);
                return (
                  <div key={role.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><KeyRound className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{role.name}</p>
                        <p className="line-clamp-2 text-xs text-slate-500">{role.description || "No description"}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{permissionSummary({ modules: role.modulePermissions, actions: role.actionPermissions }, "actions")}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700"><UsersRound className="h-3 w-3" />{members.length} member{members.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="mt-2"><PermissionChips modules={role.modulePermissions} max={4} /></div>
                    {members.length > 0 && <p className="mt-2 truncate text-[11px] text-slate-500">{members.map((emp: any) => emp.name).join(", ")}</p>}
                    <div className="mt-auto flex gap-2 pt-4">
                      <Button size="sm" variant="outline" onClick={() => openRoleEditor(role)}><PenLine className="h-3.5 w-3.5" /><span>Edit</span></Button>
                      <Button size="sm" variant="ghost" onClick={() => openRoleEditor(role, true)}><Copy className="h-3.5 w-3.5" /><span>Duplicate</span></Button>
                      <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:text-rose-700" onClick={() => archiveRole(role.id)}>Archive</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Modal
        isOpen={roleEditorOpen}
        onClose={() => setRoleEditorOpen(false)}
        maxWidth="4xl"
        title={customRoleForm.id ? `Edit role · ${customRoleForm.name}` : "New subadmin role"}
        description="Choose an access level per screen, or expand a screen to switch individual actions on and off."
      >
        <form onSubmit={(event) => void saveCustomRole(event)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Role name" required minLength={2} placeholder="e.g. Accounts Head" value={customRoleForm.name} onChange={(event) => setCustomRoleForm({ ...customRoleForm, name: event.target.value })} />
            <Input label="Description" placeholder="What this role is for" value={customRoleForm.description} onChange={(event) => setCustomRoleForm({ ...customRoleForm, description: event.target.value })} />
          </div>
          {customRoleForm.id && employees.some((emp: any) => emp.customRoleId === customRoleForm.id) && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] text-amber-900">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Saving applies immediately to {employees.filter((emp: any) => emp.customRoleId === customRoleForm.id).map((emp: any) => emp.name).join(", ")}.</span>
            </div>
          )}
          <PermissionEditor
            mode="actions"
            value={{ modules: customRoleForm.modules, actions: customRoleForm.actions }}
            onChange={(next) => setCustomRoleForm((current) => ({ ...current, modules: next.modules, actions: next.actions }))}
            organizationModules={availableOrganizationModules}
            restrictedModules={["settings"]}
          />
          <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-6 py-3 backdrop-blur">
            <span className="text-xs text-slate-500">{permissionSummary(normalizePermissions({ modules: customRoleForm.modules, actions: customRoleForm.actions }, "actions"), "actions")}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setRoleEditorOpen(false)}>Cancel</Button>
              <Button type="submit">{customRoleForm.id ? "Save role" : "Create role"}</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        isOpen={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        title="Add New Employee"
        description="Provision team member with temporary password and designated role"
        maxWidth="3xl"
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

          {watchEmp("role") === "org_admin" ? (
            <div className="flex gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Organization admins have full access to every screen and action, including team and workspace settings.</div>
          ) : watchEmp("role") === "sub_admin" && watchEmp("customRoleId") ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Lock className="h-3.5 w-3.5 text-slate-400" />Permissions from the “{customRoles.find((role: any) => role.id === watchEmp("customRoleId"))?.name}” role</p>
              <PermissionEditor readOnly mode="actions" value={{ modules: customRoles.find((role: any) => role.id === watchEmp("customRoleId"))?.modulePermissions ?? [], actions: customRoles.find((role: any) => role.id === watchEmp("customRoleId"))?.actionPermissions ?? [] }} onChange={() => undefined} organizationModules={availableOrganizationModules} restrictedModules={["settings"]} />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Permissions</p>
              <PermissionEditor
                mode={watchEmp("role") === "sub_admin" ? "actions" : "modules"}
                value={{ modules: watchEmp("modulePermissions") ?? [], actions: watchEmp("actionPermissions") ?? [] }}
                onChange={(next) => { setEmpValue("modulePermissions", next.modules, { shouldDirty: true }); setEmpValue("actionPermissions", next.actions, { shouldDirty: true }); }}
                organizationModules={availableOrganizationModules}
                restrictedModules={watchEmp("role") === "sub_admin" ? ["settings"] : []}
                roleLabel={ROLE_LABELS[watchEmp("role")]?.toLowerCase()}
              />
            </div>
          )}

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
            <Button isLoading={isResettingPassword} onClick={() => confirmResetEmployeePassword()}>Save password</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(permissionsTarget)}
        onClose={() => setPermissionsTarget(null)}
        maxWidth="4xl"
        title={permissionsTarget ? `Permissions · ${permissionsTarget.name}` : "Permissions"}
        description={permissionsTarget ? `${permissionsTarget.customRoleName ? `Subadmin · ${permissionsTarget.customRoleName}` : ROLE_LABELS[permissionsTarget.role] ?? permissionsTarget.role} · ${permissionsTarget.email}` : undefined}
      >
        {permissionsTarget && (() => {
          const isSubAdmin = permissionsTarget.role === "sub_admin";
          const assignedRole = isSubAdmin && permissionsTarget.customRoleId ? customRoles.find((role: any) => role.id === permissionsTarget.customRoleId) : null;
          const draft = { modules: permissionDraft, actions: actionPermissionDraft };
          return (
            <div className="space-y-4">
              {assignedRole ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
                    <p className="flex items-start gap-2 text-xs text-violet-900"><KeyRound className="mt-0.5 h-4 w-4 shrink-0" /><span>Permissions come from the <strong>{assignedRole.name}</strong> role and change automatically when the role is edited.</span></p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setPermissionsTarget(null); setSettingsTab("roles"); openRoleEditor(assignedRole); }}>Edit role</Button>
                      <Button size="sm" variant="secondary" onClick={async () => { if (await handleChangeEmployeeRoleChoice(permissionsTarget, "sub_admin")) setPermissionsTarget(null); }}>Use individual permissions</Button>
                    </div>
                  </div>
                  <PermissionEditor readOnly mode="actions" value={{ modules: assignedRole.modulePermissions, actions: assignedRole.actionPermissions }} onChange={() => undefined} organizationModules={availableOrganizationModules} restrictedModules={["settings"]} />
                </>
              ) : (
                <>
                  {isSubAdmin && (
                    <Tabs
                      variant="pills"
                      activeTab={permissionTab}
                      onChange={(id) => setPermissionTab(id as "access" | "scope")}
                      tabs={[
                        { id: "access", label: "Screens & actions", count: permissionSummary(normalizePermissions(draft, "actions"), "actions") },
                        { id: "scope", label: "Data scope", badge: scopeDraft.mode === "selected" ? "Restricted" : undefined },
                      ]}
                    />
                  )}
                  {(!isSubAdmin || permissionTab === "access") && (
                    <PermissionEditor
                      mode={isSubAdmin ? "actions" : "modules"}
                      value={draft}
                      onChange={(next) => { setPermissionDraft(next.modules); setActionPermissionDraft(next.actions); }}
                      organizationModules={availableOrganizationModules}
                      restrictedModules={isSubAdmin ? ["settings"] : []}
                      roleLabel={ROLE_LABELS[permissionsTarget.role]?.toLowerCase()}
                    />
                  )}
                  {isSubAdmin && permissionTab === "scope" && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">Limit which employee records this subadmin can see in Workforce, Attendance, Leave, Overtime and Payroll. Departments and locations combine as an intersection; an empty list leaves that dimension unrestricted.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {([["organization", "Whole organization", "Every employee record"], ["selected", "Selected departments / locations", "Only matching employee records"]] as const).map(([mode, title, hint]) => (
                          <button key={mode} type="button" onClick={() => setScopeDraft({ ...scopeDraft, mode })} className={`rounded-xl border p-3 text-left transition-colors ${scopeDraft.mode === mode ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-100" : "border-slate-200 hover:bg-slate-50"}`}>
                            <span className="block text-sm font-semibold text-slate-900">{title}</span>
                            <span className="text-xs text-slate-500">{hint}</span>
                          </button>
                        ))}
                      </div>
                      {scopeDraft.mode === "selected" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {([["Departments", workforceDepartments, "departmentIds", "No departments available."], ["Work locations", attendanceConfig?.locations ?? [], "locationIds", "Enable Attendance and configure office locations to scope by location."]] as const).map(([label, items, field, empty]) => (
                            <div key={field} className="rounded-xl border border-slate-200 p-3">
                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{label} · {scopeDraft[field].length || "all"}</p>
                              {(items as any[]).length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {(items as any[]).map((item: any) => {
                                    const on = scopeDraft[field].includes(item.id);
                                    return <button key={item.id} type="button" onClick={() => setScopeDraft({ ...scopeDraft, [field]: on ? scopeDraft[field].filter((id) => id !== item.id) : [...scopeDraft[field], item.id] })} className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{item.name}</button>;
                                  })}
                                </div>
                              ) : <p className="text-xs text-slate-500">{empty}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-slate-100 bg-white/95 px-6 py-3 backdrop-blur">
                <span className="text-xs text-slate-500">{assignedRole ? "Managed by role" : permissionSummary(normalizePermissions(draft, isSubAdmin ? "actions" : "modules"), isSubAdmin ? "actions" : "modules")}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setPermissionsTarget(null)}>{assignedRole ? "Close" : "Cancel"}</Button>
                  {!assignedRole && <Button isLoading={isSavingPermissions} onClick={() => saveEmployeePermissions()}>Save permissions</Button>}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
