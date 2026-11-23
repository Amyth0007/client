import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Building2,
  FileSpreadsheet,
  PlusCircle,
  Search,
  ShieldCheck,
  Upload,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { HelpGuide } from "../../components/common/HelpGuide.js";
import { Input } from "../../components/common/Input.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Tabs } from "../../components/common/Tabs.js";
import { Badge } from "../../components/common/Badge.js";
import { useAuth } from "../auth/AuthContext.js";

type Employee = {
  id: string;
  employeeNumber: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  notes: string;
  userId: string | null;
  joiningDate: string;
  employmentType: string;
  status: string;
  departmentId: string | null;
  designationId: string | null;
};

type DirectoryData = {
  employees: Employee[];
  departments: any[];
  designations: any[];
  accounts: Array<{ id: string; name: string; email: string; linkedEmployeeId: string | null }>;
};

const emptyForm = {
  employeeNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentType: "permanent",
  status: "active",
  departmentId: "",
  designationId: "",
  notes: "",
  userId: "",
};

export function WorkforceEmployeesPage() {
  const { user } = useAuth();
  const canManageEmployees =
    user?.role === "org_admin" || (user?.actionPermissions ?? []).includes("workforce.manage_employees");
  const canManageStructure =
    user?.role === "org_admin" || (user?.actionPermissions ?? []).includes("workforce.manage_departments");
  const canImport = canManageEmployees;

  const [data, setData] = useState<DirectoryData>({ employees: [], departments: [], designations: [], accounts: [] });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [activeTab, setActiveTab] = useState("directory");
  const [directoryOptionsLoaded, setDirectoryOptionsLoaded] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [departmentName, setDepartmentName] = useState("");
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);

  const [designationName, setDesignationName] = useState("");
  const [showDesignationForm, setShowDesignationForm] = useState(false);

  const load = async () => {
    if (activeTab === "import") { setLoading(false); return; }
    setLoading(true);
    try {
      if (activeTab === "directory") {
        const employees = await api.listWorkforceEmployees({ search, limit: 100 });
        setData((current) => ({ ...current, employees: employees.data }));
      } else {
        const [departments, designations] = await Promise.all([
          api.listWorkforceDepartments(),
          api.listWorkforceDesignations(),
        ]);
        setData((current) => ({ ...current, departments, designations }));
        setDirectoryOptionsLoaded(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, activeTab === "directory" && search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [search, canManageEmployees, activeTab]);

  useEffect(() => {
    if (activeTab !== "directory" || !showForm || directoryOptionsLoaded) return;
    let cancelled = false;
    void Promise.all([
      api.listWorkforceDepartments(),
      api.listWorkforceDesignations(),
      canManageEmployees ? api.listWorkforceLoginAccounts() : Promise.resolve([]),
    ]).then(([departments, designations, accounts]) => {
      if (cancelled) return;
      setData((current) => ({ ...current, departments, designations, accounts }));
      setDirectoryOptionsLoaded(true);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load employee form options"));
    return () => { cancelled = true; };
  }, [activeTab, showForm, directoryOptionsLoaded, canManageEmployees]);

  const submitEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        dateOfBirth: form.dateOfBirth || null,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        userId: form.userId || null,
      };
      if (editingEmployee) {
        await api.updateWorkforceEmployee(editingEmployee.id, payload);
        toast.success("Employee profile updated");
      } else {
        await api.createWorkforceEmployee(payload);
        toast.success("Employee profile created");
      }
      setShowForm(false);
      setEditingEmployee(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save employee");
    } finally {
      setSaving(false);
    }
  };

  const submitDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createWorkforceDepartment({ name: departmentName });
      toast.success("Department created");
      setDepartmentName("");
      setShowDepartmentForm(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save department");
    } finally {
      setSaving(false);
    }
  };

  const submitDesignation = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createWorkforceDesignation({ name: designationName });
      toast.success("Designation created");
      setDesignationName("");
      setShowDesignationForm(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save designation");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "directory", label: "Employee Directory", icon: Users },
    ...(canManageStructure
      ? [{ id: "structure", label: "Departments & Designations", icon: Building2 }]
      : []),
    ...(canImport ? [{ id: "import", label: "Import / Export", icon: FileSpreadsheet }] : []),
  ];

  const statusVariant = (status: string) =>
    status === "active"
      ? "success"
      : status === "on_leave"
        ? "warning"
        : status === "terminated"
          ? "danger"
          : "neutral";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory"
        description="Manage employment profiles independently from login accounts. Profiles can exist without app access."
      />

      <HelpGuide
        title="Workforce Employee Management"
        description="Separate employment records from authentication accounts for clean HR data and flexible access control."
        whyThisExists="Employees can be recorded in the system (for payroll, attendance, leave) without requiring app login credentials — supporting field staff, daily workers, and contractors."
        steps={[
          {
            step: 1,
            title: "Create Departments",
            description: "Set up organizational departments (e.g. Sales, Engineering) and job designations.",
            badge: "Setup",
          },
          {
            step: 2,
            title: "Add Employees",
            description: "Create employee profiles with employment type, joining date, department, and designation.",
            badge: "Admin",
          },
          {
            step: 3,
            title: "Link Login Accounts",
            description: "Optionally link the profile to an app login account for the employee to self-serve.",
            badge: "Optional",
          },
          {
            step: 4,
            title: "Assign Payroll",
            description: "Go to Payroll → Employee Assignments to link a pay structure to this profile.",
            badge: "Next Step",
          },
        ]}
        rules={[
          { label: "Profile vs Account", value: "An employee profile can exist without an app login (userId can be null)." },
          {
            label: "Employment Type",
            value: "Permanent, Contract, Daily Wage, Part-time, Intern — drives payroll calculation basis.",
          },
          { label: "Bulk Import", value: "Upload .xlsx files with required columns to onboard multiple employees at once." },
        ]}
        roles={[
          {
            role: "Org Admin",
            summary: "Full create/edit/import employee profiles, departments, and designations.",
          },
          {
            role: "Sub-admin with workforce.manage_employees",
            summary: "Same abilities as admin if the permission is granted.",
          },
          { role: "Employees", summary: "Cannot view or edit employee directory. Access is admin-only." },
        ]}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===== TAB: EMPLOYEE DIRECTORY ===== */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs min-w-0 max-w-sm">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, name, email, or phone…"
                className="w-full border-0 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
              />
            </div>
            {canManageEmployees && (
              <Button
                onClick={() => {
                  setEditingEmployee(null);
                  setForm(emptyForm);
                  setShowForm(!showForm);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            )}
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <Card title={editingEmployee ? `Edit Profile: ${editingEmployee.name}` : "New Employee Profile"}>
              <form onSubmit={submitEmployee} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Employee ID / Number"
                  required
                  placeholder="e.g. EMP001"
                  value={form.employeeNumber}
                  onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                />
                <Input
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
                <Input
                  label="Last Name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
                <Input
                  label="Joining Date"
                  type="date"
                  required
                  value={form.joiningDate}
                  onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                />
                <CustomSelect
                  label="Employment Type"
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  options={[
                    { value: "permanent", label: "Permanent" },
                    { value: "contract", label: "Contract" },
                    { value: "temporary", label: "Temporary" },
                    { value: "daily_wage", label: "Daily Wage" },
                    { value: "hourly", label: "Hourly" },
                    { value: "part_time", label: "Part-time" },
                    { value: "intern", label: "Intern" },
                    { value: "freelance", label: "Freelance" },
                  ]}
                />
                <CustomSelect
                  label="Employment Status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  options={[
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "on_leave", label: "On Extended Leave" },
                    { value: "terminated", label: "Terminated" },
                  ]}
                />
                <CustomSelect
                  label="Department"
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...data.departments
                      .filter((d) => d.status === "active")
                      .map((d) => ({ value: d._id, label: d.name })),
                  ]}
                />
                <CustomSelect
                  label="Designation / Job Title"
                  value={form.designationId}
                  onChange={(e) => setForm({ ...form, designationId: e.target.value })}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...data.designations
                      .filter((d) => d.status === "active")
                      .map((d) => ({ value: d._id, label: d.name })),
                  ]}
                />
                <CustomSelect
                  label="Linked Login Account (optional)"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  options={[
                    { value: "", label: "No login account" },
                    ...data.accounts
                      .filter(
                        (account) =>
                          !account.linkedEmployeeId || account.linkedEmployeeId === editingEmployee?.id
                      )
                      .map((account) => ({
                        value: account.id,
                        label: account.name,
                        sublabel: account.email,
                      })),
                  ]}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    maxLength={2000}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                    placeholder="Any relevant HR notes…"
                  />
                </div>
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowForm(false);
                      setEditingEmployee(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    {saving ? "Saving…" : editingEmployee ? "Save Changes" : "Create Profile"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Import Errors */}
          {importErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-800">Import stopped — no profiles were created</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-rose-700">
                {importErrors.map((issue, index) => (
                  <li key={`${issue.row}-${index}`}>
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Employee Table */}
          <Card>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Employee Directory{" "}
                  <span className="ml-1 text-slate-400">{data.employees.length}</span>
                </h3>
              </div>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500">Loading employees…</p>
            ) : data.employees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No employee profiles yet"
                description="Add your first employee profile or use the Import tab to upload from Excel."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Designation</th>
                      <th className="px-4 py-3">Employment</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3">Status</th>
                      {canManageEmployees && <th className="px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.employees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{employee.name}</p>
                          <p className="text-xs text-slate-500">
                            {employee.employeeNumber}
                            {employee.email ? ` · ${employee.email}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {data.departments.find((d) => d._id === employee.departmentId)?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {data.designations.find((d) => d._id === employee.designationId)?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">
                          {employee.employmentType.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{employee.joiningDate}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(employee.status)}>
                            {employee.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        {canManageEmployees && (
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingEmployee(employee);
                                setForm({
                                  employeeNumber: employee.employeeNumber,
                                  firstName: employee.firstName,
                                  lastName: employee.lastName ?? "",
                                  email: employee.email ?? "",
                                  phone: employee.phone ?? "",
                                  dateOfBirth: employee.dateOfBirth ?? "",
                                  joiningDate: employee.joiningDate,
                                  employmentType: employee.employmentType,
                                  status: employee.status,
                                  departmentId: employee.departmentId ?? "",
                                  designationId: employee.designationId ?? "",
                                  notes: employee.notes ?? "",
                                  userId: employee.userId ?? "",
                                });
                                setShowForm(true);
                                setActiveTab("directory");
                              }}
                            >
                              <UserCog className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===== TAB: DEPARTMENTS & DESIGNATIONS ===== */}
      {canManageStructure && activeTab === "structure" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Departments Panel */}
          <div className="space-y-4">
            <Card title="Departments" subtitle="Organizational units for grouping employees">
              <div className="mb-4 flex justify-end">
                <Button size="sm" onClick={() => setShowDepartmentForm(!showDepartmentForm)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </div>
              {showDepartmentForm && (
                <form
                  onSubmit={submitDepartment}
                  className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <Input
                    label="Department Name"
                    required
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="e.g. Sales, Engineering, HR"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" isLoading={saving}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowDepartmentForm(false);
                        setDepartmentName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              {data.departments.length === 0 ? (
                <EmptyState icon={Building2} title="No departments" description="Add departments to organize your team structure." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.departments.map((dept) => (
                    <div key={dept._id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-medium text-slate-900">{dept.name}</span>
                      <Badge variant={dept.status === "active" ? "success" : "neutral"}>{dept.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Designations Panel */}
          <div className="space-y-4">
            <Card title="Designations" subtitle="Job titles and position levels for employees">
              <div className="mb-4 flex justify-end">
                <Button size="sm" onClick={() => setShowDesignationForm(!showDesignationForm)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Designation
                </Button>
              </div>
              {showDesignationForm && (
                <form
                  onSubmit={submitDesignation}
                  className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <Input
                    label="Designation Name"
                    required
                    value={designationName}
                    onChange={(e) => setDesignationName(e.target.value)}
                    placeholder="e.g. Senior Engineer, Field Executive"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" isLoading={saving}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowDesignationForm(false);
                        setDesignationName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              {data.designations.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No designations" description="Add job titles to assign to employee profiles." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.designations.map((desg) => (
                    <div key={desg._id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-medium text-slate-900">{desg.name}</span>
                      <Badge variant={desg.status === "active" ? "success" : "neutral"}>{desg.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ===== TAB: IMPORT / EXPORT ===== */}
      {canImport && activeTab === "import" && (
        <div className="space-y-4">
          <Card title="Bulk Employee Import" subtitle="Upload an Excel (.xlsx) file to onboard multiple employees at once">
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs text-indigo-900">
                <p className="font-semibold mb-2">Required Excel columns:</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  <span>• <strong>employeeNumber</strong> (required)</span>
                  <span>• <strong>firstName</strong> (required)</span>
                  <span>• <strong>joiningDate</strong> (required, YYYY-MM-DD)</span>
                  <span>• <strong>employmentType</strong> (required)</span>
                </div>
                <p className="mt-2 font-semibold mb-1">Optional columns:</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  <span>• lastName</span>
                  <span>• email</span>
                  <span>• phone</span>
                  <span>• dateOfBirth</span>
                  <span>• status</span>
                  <span>• department (name)</span>
                  <span>• designation (name)</span>
                </div>
                <p className="mt-2 text-indigo-700">Maximum file size: 4MB. If any row fails validation, the entire import is aborted.</p>
              </div>

              <div className="flex items-center gap-4">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? "Importing…" : "Upload Excel File"}
                  <input
                    type="file"
                    accept=".xlsx"
                    className="sr-only"
                    disabled={importing}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setImportErrors([]);
                      setImporting(true);
                      try {
                        const result = await api.importWorkforceEmployees(file);
                        if (result.data.errors.length) {
                          setImportErrors(result.data.errors);
                          toast.error(`Import stopped: ${result.data.errors.length} row issue(s)`);
                        } else {
                          toast.success(`${result.data.createdCount} employee profiles imported`);
                          await load();
                        }
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not import workbook");
                      } finally {
                        setImporting(false);
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
                {importing && <span className="text-sm text-slate-600 animate-pulse">Processing file…</span>}
              </div>
            </div>
          </Card>

          {importErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-800">Import stopped — no profiles created</p>
              <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-xs text-rose-700">
                {importErrors.map((issue, index) => (
                  <li key={`${issue.row}-${index}`} className="flex items-start gap-2">
                    <span className="font-bold">Row {issue.row}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
