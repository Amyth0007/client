import { useEffect, useState } from "react";
import { Paged } from "../../components/common/Pagination.js";
import toast from "react-hot-toast";
import {
  CalendarDays,
  CheckCircle2,
  ListFilter,
  PlusCircle,
  Umbrella,
  XCircle,
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
import { ConfirmDialog } from "../../components/common/ConfirmDialog.js";

export function LeavePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "org_admin" || user?.role === "sub_admin";
  const isEmployee = !isAdmin;

  const [types, setTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isEmployee ? "my-requests" : "approvals");

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<any | null>(null);
  const [leaveType, setLeaveType] = useState({
    code: "",
    name: "",
    paid: true,
    annualEntitlementDays: "12",
  });

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [request, setRequest] = useState({
    leaveTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    days: "1",
    reason: "",
  });

  const load = async (tab = activeTab) => {
    setLoading(true);
    try {
      const needsTypes = isEmployee ? tab === "my-requests" || tab === "balances" : tab === "types" || tab === "balances";
      const needsRequests = ["my-requests", "approvals", "all-requests"].includes(tab);
      const [typeResult, requestResult] = await Promise.all([
        needsTypes ? (isEmployee ? api.getLeaveTypes() : api.getLeaveAdmin()) : Promise.resolve(null),
        needsRequests ? api.listLeaveRequests(isEmployee) : Promise.resolve(null),
      ]);
      if (typeResult) { setTypes(typeResult.types); setBalances(typeResult.balances); }
      if (requestResult) setRequests(requestResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load leave data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [isEmployee, activeTab]);

  const submitType = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...leaveType,
        annualEntitlementDays: Number(leaveType.annualEntitlementDays),
        status: "active",
      };
      if (editingTypeId) await api.updateLeaveType(editingTypeId, payload);
      else await api.createLeaveType(payload);
      toast.success(editingTypeId ? "Leave type updated" : "Leave type created");
      setShowTypeForm(false);
      setEditingTypeId(null);
      setLeaveType({ code: "", name: "", paid: true, annualEntitlementDays: "12" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createLeaveRequest({ ...request, days: Number(request.days) });
      toast.success("Leave request submitted for approval");
      setShowRequestForm(false);
      setRequest({
        leaveTypeId: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        days: "1",
        reason: "",
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit request");
    } finally {
      setSaving(false);
    }
  };

  const reviewRequest = async (id: string, action: "approved" | "rejected") => {
    try {
      await api.reviewLeaveRequest(id, action);
      toast.success(action === "approved" ? "Leave approved" : "Leave rejected");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed");
    }
  };

  const pendingApprovals = requests.filter((r) => r.status === "pending");
  const myRequests = requests.filter((r) => !isAdmin || r.employeeId === user?.id);

  const tabs = isEmployee
    ? [
        { id: "my-requests", label: "My Leave Requests", icon: CalendarDays },
        { id: "balances", label: "Leave Balances", icon: ListFilter },
      ]
    : [
        { id: "approvals", label: "Pending Approvals", icon: CheckCircle2, count: pendingApprovals.length || undefined },
        { id: "all-requests", label: "All Requests", icon: CalendarDays },
        { id: "balances", label: "Leave Balances", icon: ListFilter },
        { id: "types", label: "Leave Types", icon: Umbrella },
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEmployee ? "My Leave Management" : "Leave & Approvals"}
        description={
          isEmployee
            ? "Request time off, track approval status, and check your remaining leave balances."
            : "Review pending leave applications, manage leave type policies, and monitor team balances."
        }
      />

      {/* Help Guide */}
      <HelpGuide
        title="Leave Management System"
        description="Apply for leave, track approvals, and manage organizational leave policies."
        whyThisExists="Tracks employee time-off as attendance records to ensure payroll accuracy, leave balance deductions, and coverage planning."
        steps={[
          {
            step: 1,
            title: "Configure Leave Types",
            description: "Admin creates leave types (Casual, Sick, Annual) and sets whether each type is paid and how many days are available each year.",
            badge: "Admin",
          },
          {
            step: 2,
            title: "Employee Applies",
            description: "Employee selects leave type, dates, number of days, and submits reason.",
            badge: "Staff",
          },
          {
            step: 3,
            title: "Manager Reviews",
            description: "Admin or manager approves or rejects the leave application.",
            badge: "Admin",
          },
          {
            step: 4,
            title: "Attendance Updated",
            description: "Approved leave days are reflected in attendance records and leave balances are deducted.",
            badge: "Auto",
          },
        ]}
        rules={[
          { label: "Available days", value: "The balance shows the yearly days available, days already used, and the remaining balance." },
          { label: "Half-Day Leave", value: "Set days to 0.5 to record a half-day leave application." },
          { label: "Attendance Integration", value: "Approved leave automatically marks attendance as 'leave' status for those dates." },
        ]}
        roles={[
          { role: "Org Admin / Managers", summary: "Create leave types, approve/reject requests, and view full team balances." },
          { role: "Employees", summary: "Submit leave requests, track approval status, and check remaining balance." },
        ]}
      />

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB: MY REQUESTS / EMPLOYEE VIEW */}
      {activeTab === "my-requests" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowRequestForm(!showRequestForm)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Apply for Leave
            </Button>
          </div>

          {showRequestForm && (
            <Card title="New Leave Application" subtitle="Submit a leave request for manager approval">
              <form onSubmit={submitRequest} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <CustomSelect
                    label="Leave Type"
                    required
                    value={request.leaveTypeId}
                    onChange={(e) => setRequest({ ...request, leaveTypeId: e.target.value })}
                    placeholder="Select leave type"
                    options={types.map((item) => ({
                      value: item._id ?? item.id,
                      label: item.name,
                      sublabel: item.paid ? "Paid" : "Unpaid",
                    }))}
                  />
                </div>
                <Input
                  label="Start Date"
                  type="date"
                  required
                  value={request.startDate}
                  onChange={(e) => setRequest({ ...request, startDate: e.target.value })}
                />
                <Input
                  label="End Date"
                  type="date"
                  required
                  value={request.endDate}
                  onChange={(e) => setRequest({ ...request, endDate: e.target.value })}
                />
                <Input
                  label="Number of Days"
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  helperText="Use 0.5 for half-day"
                  value={request.days}
                  onChange={(e) => setRequest({ ...request, days: e.target.value })}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Input
                    label="Reason / Note"
                    required
                    value={request.reason}
                    onChange={(e) => setRequest({ ...request, reason: e.target.value })}
                    placeholder="e.g. Family function, doctor appointment, vacation"
                  />
                </div>
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="button" variant="secondary" onClick={() => setShowRequestForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    Submit Request
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="My Leave Requests" subtitle="All applications with live approval status">
            {loading ? (
              <p className="p-6 text-center text-sm text-slate-500">Loading requests…</p>
            ) : myRequests.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No leave requests yet"
                description="Apply for leave using the button above and track approval status here."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {myRequests.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.leaveType?.name ?? "Leave"}{" "}
                        <span className="text-slate-500 font-normal">· {item.days} day(s)</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.startDate} – {item.endDate} · {item.reason}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB: PENDING APPROVALS (admin) */}
      {activeTab === "approvals" && (
        <Card
          title="Pending Leave Approvals"
          subtitle="Review and act on employee leave applications"
        >
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading…</p>
          ) : pendingApprovals.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No pending approvals"
              description="All leave requests have been reviewed."
            />
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {item.leaveType?.name} · {item.days} day(s) · {item.startDate} – {item.endDate}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 italic">{item.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewRequest(item.id, "approved")}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reviewRequest(item.id, "rejected")}>
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB: ALL REQUESTS (admin) */}
      {activeTab === "all-requests" && (
        <Card title="All Leave Requests" subtitle="Complete history of all employee leave applications">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading…</p>
          ) : requests.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No leave requests yet" description="Employee applications will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Paged items={requests} initialPageSize={25}>{(rows) => (<table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.leaveType?.name}</td>
                      <td className="px-4 py-3 text-slate-700">{item.days} day(s)</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.startDate} – {item.endDate}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            item.status === "approved"
                              ? "success"
                              : item.status === "rejected"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => reviewRequest(item.id, "approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => reviewRequest(item.id, "rejected")}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>)}</Paged>
            </div>
          )}
        </Card>
      )}

      {/* TAB: LEAVE BALANCES */}
      {activeTab === "balances" && (
        <Card title="Leave Balances" subtitle={isAdmin ? "Current year leave utilization for all employees" : "Your available leave balance for the current year"}>
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading balances…</p>
          ) : balances.length === 0 ? (
            <EmptyState icon={ListFilter} title="No balance data" description="Leave balances will appear here once leave types are created and assigned." />
          ) : (
            <div className="overflow-x-auto">
              <Paged items={balances} initialPageSize={25}>{(rows) => (<table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    {!isEmployee && <th className="px-4 py-3">Employee</th>}
                    <th className="px-4 py-3">Leave Type</th>
                    <th className="px-4 py-3">Year</th>
                    <th className="px-4 py-3">Days Available</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Utilized</th>
                    <th className="px-4 py-3">Balance Bar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => {
                    const utilized = item.entitlementDays - item.availableDays;
                    const pct = Math.min(100, Math.round((utilized / item.entitlementDays) * 100)) || 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        {!isEmployee && (
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                          </td>
                        )}
                        <td className="px-4 py-3">{item.leaveType?.name}</td>
                        <td className="px-4 py-3 text-slate-600">{item.year}</td>
                        <td className="px-4 py-3">{item.entitlementDays}d</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{item.availableDays}d</td>
                        <td className="px-4 py-3 text-rose-600">{utilized}d</td>
                        <td className="px-4 py-3 w-32">
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500">{pct}% used</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>)}</Paged>
            </div>
          )}
        </Card>
      )}

      {/* TAB: LEAVE TYPES (admin) */}
      {!isEmployee && activeTab === "types" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setShowTypeForm(!showTypeForm); setEditingTypeId(null); setLeaveType({ code: "", name: "", paid: true, annualEntitlementDays: "12" }); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Leave Type
            </Button>
          </div>

          {showTypeForm && (
            <Card title={editingTypeId ? "Edit Leave Type" : "New Leave Type"} subtitle="Choose a clear name, whether it is paid, and the number of days available each year.">
              <form onSubmit={submitType} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="Short Code"
                  required
                  placeholder="e.g. CL, SL, EL"
                  value={leaveType.code}
                  onChange={(e) => setLeaveType({ ...leaveType, code: e.target.value })}
                />
                <Input
                  label="Leave Type Name"
                  required
                  placeholder="e.g. Casual Leave, Sick Leave"
                  value={leaveType.name}
                  onChange={(e) => setLeaveType({ ...leaveType, name: e.target.value })}
                />
                <Input
                  label="Days Available Per Year"
                  type="number"
                  min="0"
                  max="366"
                  value={leaveType.annualEntitlementDays}
                  onChange={(e) => setLeaveType({ ...leaveType, annualEntitlementDays: e.target.value })}
                />
                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={leaveType.paid}
                      onChange={(e) => setLeaveType({ ...leaveType, paid: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                    />
                    <span>Paid Leave Type</span>
                  </label>
                </div>
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
                  <Button type="button" variant="secondary" onClick={() => setShowTypeForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    {editingTypeId ? "Save Changes" : "Create Leave Type"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types.filter((item) => item.status !== "inactive").map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Umbrella className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  </div>
                  <Badge variant={item.paid ? "success" : "neutral"}>{item.paid ? "Paid" : "Unpaid"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-medium text-slate-900">{item.annualEntitlementDays}</p>
                    <p>Days / Year</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-medium text-slate-900">{item.code}</p>
                    <p>Code</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button size="sm" variant="outline" onClick={() => { setEditingTypeId(item.id); setLeaveType({ code: item.code, name: item.name, paid: item.paid, annualEntitlementDays: String(item.annualEntitlementDays) }); setShowTypeForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setTypeToDelete(item)}>Delete</Button>
                </div>
              </div>
            ))}
            {types.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  icon={Umbrella}
                  title="No leave types configured"
                  description="Create leave types like Casual Leave, Sick Leave, and Earned Leave to enable employee applications."
                />
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog isOpen={Boolean(typeToDelete)} onClose={() => setTypeToDelete(null)} onConfirm={() => { if (!typeToDelete) return; return api.deleteLeaveType(typeToDelete.id).then(async () => { toast.success("Leave type deleted"); setTypeToDelete(null); await load(); }).catch((error) => { toast.error(error instanceof Error ? error.message : "Could not delete leave type"); setTypeToDelete(null); }); }} title="Delete leave type?" description={typeToDelete ? `Delete “${typeToDelete.name}”? Leave types with requests or balances are protected; you can edit them or mark inactive instead.` : ""} confirmLabel="Delete leave type" />
    </div>
  );
}
