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
import { Select } from "../../components/common/Select.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { ORGANIZATION_MODULES, organizationModuleEnabled, type OrganizationModuleKey } from "../platform/module-registry.js";

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
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

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

  // Org form
  const { register: regOrg, handleSubmit: handleOrgSubmit } = useForm({
    values: {
      name: organization?.name ?? "",
      legalName: organization?.legalName ?? "",
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
    formState: { errors: empErrors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      role: "field_recovery",
      temporaryPassword: "",
      modulePermissions: [] as string[],
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
      const payload = { ...values, modulePermissions: values.role === "org_admin" ? undefined : values.modulePermissions ?? [] };
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

  const editEmployeePermissions = (employee: any) => {
    setPermissionsTarget(employee);
    const modules = organization?.modules ?? user?.organization?.modules;
    setPermissionDraft(Object.entries(employee.modulePermissions ?? {}).filter(([key, allowed]) => allowed && organizationModuleEnabled(modules, key as OrganizationModuleKey)).map(([key]) => key));
  };
  const saveEmployeePermissions = async () => {
    if (!permissionsTarget) return;
    setIsSavingPermissions(true);
    try {
      await api.updateEmployee(permissionsTarget.id, { modulePermissions: permissionDraft.filter((key) => organizationModuleEnabled(availableOrganizationModules, key as OrganizationModuleKey)) });
      toast.success("Screen access updated");
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

  const handleChangeEmployeeRole = async (emp: any, role: string) => {
    try {
      await api.updateEmployee(emp.id, { role });
      toast.success(`${emp.name}'s role updated`);
      queryClient.invalidateQueries({ queryKey: ["employees-list"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update employee role");
    }
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

      {/* Organization Profile */}
      <Card title="Organization Profile" subtitle="Commercial identity and tenant details">
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

              <Input
                label="GSTIN"
                disabled={!isOrgAdmin}
                {...regOrg("gstin")}
              />

              <Select
                label="Operational Timezone"
                disabled={!isOrgAdmin}
                options={[
                  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
                  { value: "UTC", label: "UTC (+0:00)" },
                  { value: "Asia/Dubai", label: "Asia/Dubai (+4:00)" },
                  { value: "Asia/Singapore", label: "Asia/Singapore (+8:00)" },
                ]}
                {...regOrg("timezone")}
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
      </Card>

      {gmailEnabled && <Card title="Gmail integration" subtitle="Send payment reminders and invoice documents from your organization Gmail account">
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
      {isOrgAdmin && (
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
                          emp.role === "accounts_manager" ? "Account Manager" : emp.role === "field_recovery" ? "Field Executive" : emp.role === "employee" ? "Employee" : "Organization Admin"
                        ) : (
                          <select
                            value={emp.role}
                            onChange={(event) => void handleChangeEmployeeRole(emp, event.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs capitalize"
                            aria-label={`Role for ${emp.name}`}
                          >
                            <option value="org_admin">Organization Admin</option>
                            <option value="accounts_manager">Account Manager</option>
                            <option value="field_recovery">Field Executive</option>
                            <option value="employee">Employee</option>
                          </select>
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

          <Select
            label="Role & Permissions"
            required
            options={[
              { value: "field_recovery", label: "Field Executive (Assigned Visits & Follow-up)" },
              { value: "employee", label: "Employee (Choose screen access)" },
              { value: "accounts_manager", label: "Account Manager (Invoices, Payments & Recovery)" },
              { value: "org_admin", label: "Organization Admin (Full Control)" },
            ]}
            {...regEmp("role")}
          />

          {watchEmp("role") !== "org_admin" && <fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold text-slate-800">Screens this staff member can access</legend><p className="mb-2 text-xs text-slate-500">Select enabled modules. Greyed options must first be enabled by the platform administrator.</p><div className="grid gap-2 sm:grid-cols-2">{ORGANIZATION_MODULES.map((module) => { const enabledForOrganization = organizationModuleEnabled(availableOrganizationModules, module.key); return <label key={module.key} className={`flex items-start gap-2 rounded-lg p-2 text-xs ${enabledForOrganization ? "hover:bg-slate-50" : "cursor-not-allowed opacity-50"}`}><input type="checkbox" value={module.key} disabled={!enabledForOrganization} {...regEmp("modulePermissions")} /><span><span className="block font-medium text-slate-800">{module.name}{module.key === "attendance" && !enabledForOrganization ? " · enable in Platform Administration" : ""}</span><span className="text-slate-500">{module.description}</span></span></label>; })}</div></fieldset>}

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
        <div className="space-y-4"><p className="text-xs text-slate-600">Screens must also be enabled for the organization by the platform administrator. Disabled modules are shown so you can see why they cannot be assigned.</p><div className="grid gap-2 sm:grid-cols-2">{ORGANIZATION_MODULES.map((module) => { const enabledForOrganization = organizationModuleEnabled(availableOrganizationModules, module.key); return <label key={module.key} className={`flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm ${enabledForOrganization ? "" : "cursor-not-allowed opacity-50"}`}><input type="checkbox" checked={permissionDraft.includes(module.key)} disabled={!enabledForOrganization} onChange={(event) => setPermissionDraft((current) => event.target.checked ? [...current, module.key] : current.filter((key) => key !== module.key))} /><span><span className="block font-medium">{module.name}{module.key === "attendance" && !enabledForOrganization ? " · disabled for organization" : ""}</span><span className="text-xs text-slate-500">{module.description}</span></span></label>; })}</div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPermissionsTarget(null)}>Cancel</Button><Button isLoading={isSavingPermissions} onClick={() => void saveEmployeePermissions()}>Save access</Button></div></div>
      </Modal>
    </div>
  );
}
