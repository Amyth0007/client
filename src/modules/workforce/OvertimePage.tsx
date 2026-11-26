import { useEffect, useState } from "react";
import { Paged } from "../../components/common/Pagination.js";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Clock,
  Cog,
  ListOrdered,
  PlusCircle,
  Timer,
  XCircle,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { HelpGuide } from "../../components/common/HelpGuide.js";
import { Input } from "../../components/common/Input.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Modal } from "../../components/common/Modal.js";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.js";
import { Tabs } from "../../components/common/Tabs.js";
import { Badge } from "../../components/common/Badge.js";
import { InfoTip } from "../../components/common/InfoTip.js";
import { useAuth } from "../auth/AuthContext.js";

export function OvertimePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "org_admin" || user?.role === "sub_admin";
  const canManagePolicy = user?.role === "org_admin" || (user?.role === "sub_admin" && (user.actionPermissions ?? []).includes("overtime.manage_policy"));
  const canRecordEntry = user?.role === "org_admin" || (user?.role === "sub_admin" && (user.actionPermissions ?? []).includes("overtime.create"));
  const canApprove = user?.role === "org_admin" || (user?.role === "sub_admin" && (user.actionPermissions ?? []).includes("overtime.approve"));

  const [data, setData] = useState<any>({ policies: [], entries: [] });
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(isAdmin ? "entries" : "my-overtime");

  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyToDelete, setPolicyToDelete] = useState<any | null>(null);
  const [policy, setPolicy] = useState({
    name: "Standard overtime",
    calculation: "fixed_hourly",
    hourlyRateMinor: "",
    multiplierBasisPoints: "1.5",
    roundingMinutes: "15",
    maximumMinutesPerDay: "240",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entry, setEntry] = useState({
    employeeId: "",
    policyId: "",
    workDate: new Date().toISOString().slice(0, 10),
    actualMinutes: "",
    reason: "",
  });

  const load = async (tab = activeTab) => {
    setLoading(true);
    try {
      const result = await api.getOvertime(tab === "policies" ? "policies" : "entries");
      // Keep the other section's data: the entries call returns no policies (and vice versa).
      setData((prev: any) => tab === "policies" ? { ...prev, policies: result.policies ?? [] } : { ...prev, entries: result.entries ?? [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load overtime");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeTab]);

  useEffect(() => {
    if (!showEntryForm || !(activeTab === "entries" || activeTab === "my-overtime")) return;
    let cancelled = false;
    // The policy dropdown needs policies, which the entries list does not include.
    void api.getOvertime("policies").then((result) => {
      if (!cancelled) setData((prev: any) => ({ ...prev, policies: result.policies ?? [] }));
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load overtime policies"));
    if (isAdmin) void api.listWorkforceEmployees({ limit: 100, status: "active" }).then((people) => {
      if (!cancelled) setEmployees(people.data);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load employees"));
    return () => { cancelled = true; };
  }, [activeTab, showEntryForm]);

  const submitPolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...policy,
        hourlyRateMinor: Math.round(Number(policy.hourlyRateMinor || 0) * 100),
        multiplierBasisPoints: Math.round(Number(policy.multiplierBasisPoints) * 10000),
        roundingMinutes: Number(policy.roundingMinutes),
        maximumMinutesPerDay: Number(policy.maximumMinutesPerDay),
        minimumMinutes: 1,
      };
      if (editingPolicyId) await api.updateOvertimePolicy(editingPolicyId, payload);
      else await api.createOvertimePolicy(payload);
      toast.success(editingPolicyId ? "Overtime policy updated" : "Overtime policy saved");
      setShowPolicyForm(false);
      setEditingPolicyId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save policy");
    } finally {
      setSaving(false);
    }
  };

  const editPolicy = (item: any) => {
    setEditingPolicyId(item.id);
    setPolicy({ name: item.name, calculation: item.calculation, hourlyRateMinor: String(item.hourlyRateMinor / 100), multiplierBasisPoints: String(item.multiplierBasisPoints / 10000), roundingMinutes: String(item.roundingMinutes), maximumMinutesPerDay: String(item.maximumMinutesPerDay), effectiveFrom: item.effectiveFrom });
    setShowPolicyForm(true);
  };

  const removePolicy = async (item: any) => {
    try { await api.deleteOvertimePolicy(item.id); toast.success("Overtime policy deleted"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete policy"); }
    finally { setPolicyToDelete(null); }
  };

  const submitEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createOvertimeEntry({ ...entry, actualMinutes: Number(entry.actualMinutes) });
      toast.success("Overtime recorded – pending manager approval");
      setShowEntryForm(false);
      setEntry({
        employeeId: "",
        policyId: "",
        workDate: new Date().toISOString().slice(0, 10),
        actualMinutes: "",
        reason: "",
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save entry");
    } finally {
      setSaving(false);
    }
  };

  const reviewEntry = async (id: string, action: "approved" | "rejected") => {
    try {
      await api.reviewOvertime(id, action);
      toast.success(action === "approved" ? "Overtime approved" : "Overtime rejected");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review failed");
    }
  };

  const pendingEntries = data.entries.filter((e: any) => e.status === "pending");
  const myEntries = data.entries.filter((e: any) => e.employee?.userId === user?.id);

  const tabs = isAdmin
    ? [
        {
          id: "entries",
          label: "All Overtime Entries",
          icon: ListOrdered,
        },
        {
          id: "approvals",
          label: "Pending Approvals",
          icon: CheckCircle2,
          count: pendingEntries.length || undefined,
        },
        {
          id: "policies",
          label: "Overtime Policies",
          icon: Cog,
        },
      ]
    : [
        { id: "my-overtime", label: "My Overtime", icon: Timer },
        { id: "policies", label: "Overtime Policies", icon: Cog },
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overtime Management"
        description="Track, approve, and calculate payable overtime with configurable rounding and rate policies."
        action={<>
          {canRecordEntry && (activeTab === "entries" || activeTab === "my-overtime") && <Button size="sm" onClick={() => setShowEntryForm(!showEntryForm)}><PlusCircle className="h-4 w-4" />Record overtime</Button>}
          {canManagePolicy && activeTab === "policies" && <Button size="sm" onClick={() => { setEditingPolicyId(null); setShowPolicyForm(!showPolicyForm); }}><Cog className="h-4 w-4" />Configure new policy</Button>}
          <HelpGuide compact title="Overtime Approval Workflow" description="Record actual overtime minutes, get manager approval, and feed approved amounts to payroll." whyThisExists="Only manager reviewed overtime becomes payable, keeping payroll aligned with approved work." steps={[{ step: 1, title: "Set OT policy", description: "Set calculation, rounding, and daily cap.", badge: "Admin" }, { step: 2, title: "Record entry", description: "Submit actual extra minutes and a reason.", badge: "Staff / Admin" }, { step: 3, title: "Manager approves", description: "Review and approve or reject entries.", badge: "Admin" }, { step: 4, title: "Payroll processing", description: "Approved overtime is included in payroll.", badge: "Payroll" }]} rules={[{ label: "Rounding", value: "Minutes round down to the configured interval." }, { label: "Daily cap", value: "Payable minutes are capped by policy." }, { label: "Multiplier", value: "Use 1.5 for time-and-a-half or 2 for double time." }]} roles={[{ role: "Org Admin / Managers", summary: "Create policies, record overtime, and review entries." }, { role: "Employees", summary: "View submitted overtime and its status." }]} />
        </>}
      />


      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <Modal isOpen={showEntryForm} onClose={() => setShowEntryForm(false)} title="Record overtime" description="Add one employee’s overtime for one work date and send it for approval." maxWidth="lg">
          <form onSubmit={submitEntry} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin && (
              <div className="sm:col-span-2 lg:col-span-4">
                <CustomSelect
                  label="Employee"
                  required
                  value={entry.employeeId}
                  onChange={(e) => setEntry({ ...entry, employeeId: e.target.value })}
                  placeholder="Select employee"
                  searchable
                  options={employees.map((emp) => ({
                    value: emp.id,
                    label: emp.name,
                    sublabel: emp.employeeNumber,
                  }))}
                />
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-2 space-y-3">

            <CustomSelect
              label="Overtime Policy"
              required 
              value={entry.policyId}
              onChange={(e) => setEntry({ ...entry, policyId: e.target.value })}
              placeholder="Choose the policy for this entry"
              options={data.policies.filter((item: any) => item.status === "active" && item.effectiveFrom <= entry.workDate && (!item.effectiveTo || item.effectiveTo >= entry.workDate)).map((item: any) => ({ value: item.id, label: item.name, sublabel: item.calculation === "fixed_hourly" ? `${formatMoney(item.hourlyRateMinor)}/hour` : `${item.multiplierBasisPoints / 10000}× employee hourly rate` }))}
              />
              <Input
              label="Actual Extra Minutes"
              type="number"
              min="0"
              max="1440"
              step="1"
              required
              helperText=""
              value={entry.actualMinutes}
              onChange={(e) => setEntry({ ...entry, actualMinutes: e.target.value })}
              />
            <Input
              label="Work Date"
              type="date"
              required
              value={entry.workDate}
              onChange={(e) => setEntry({ ...entry, workDate: e.target.value })}
              />
            
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Reason / Justification"
                required
                placeholder="e.g. Quarter-end data processing, urgent client deliverable"
                value={entry.reason}
                onChange={(e) => setEntry({ ...entry, reason: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="button" variant="secondary" onClick={() => setShowEntryForm(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={saving}>
                Submit for Approval
              </Button>
            </div>
          </form>
      </Modal>
      <ConfirmDialog isOpen={Boolean(policyToDelete)} onClose={() => setPolicyToDelete(null)} onConfirm={() => policyToDelete ? removePolicy(policyToDelete) : undefined} title="Delete overtime policy?" description={policyToDelete ? `Delete “${policyToDelete.name}”? Policies used by overtime records cannot be deleted.` : ""} confirmLabel="Delete policy" />

      {/* TAB: ALL ENTRIES (admin) */}
      {activeTab === "entries" && (
        <Card title="All Overtime Entries" subtitle="Complete log of actual and approved overtime with payable amounts">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading overtime records…</p>
          ) : data.entries.length === 0 ? (
            <EmptyState icon={Timer} title="No overtime entries" description="Record the first overtime entry using the button above." />
          ) : (
            <div className="overflow-x-auto">
              <Paged items={data.entries} initialPageSize={25}>{(rows) => (<table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Actual Minutes</th>
                    <th className="px-4 py-3">Rounded (Approved)</th>
                    <th className="px-4 py-3">Payable Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.workDate}</td>
                      <td className="px-4 py-3 text-slate-700">{item.actualMinutes} min</td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.calculatedMinutes ?? "—"} / {item.approvedMinutes ?? "—"} min
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatMoney(item.payableAmountMinor)}
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
                        {canApprove && item.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => reviewEntry(item.id, "approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => reviewEntry(item.id, "rejected")}>
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

      {/* TAB: PENDING APPROVALS (admin) */}
      {activeTab === "approvals" && (
        <Card title="Overtime Pending Approval" subtitle="Entries awaiting manager review">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading…</p>
          ) : pendingEntries.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All entries reviewed" description="No overtime entries are pending approval." />
          ) : (
            <div className="space-y-3">
              {pendingEntries.map((item: any) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {item.workDate} · {item.actualMinutes} actual minutes · {item.reason}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewEntry(item.id, "approved")}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reviewEntry(item.id, "rejected")}>
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

      {/* TAB: MY OVERTIME (employee view) */}
      {activeTab === "my-overtime" && (
        <Card title="My Overtime Entries" subtitle="Your submitted overtime with current approval status">
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading…</p>
          ) : myEntries.length === 0 ? (
            <EmptyState icon={Clock} title="No overtime entries yet" description="Submit overtime entries using the button above." />
          ) : (
            <div className="divide-y divide-slate-100">
              {myEntries.map((item: any) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.workDate} · {item.actualMinutes} minutes
                    </p>
                    <p className="text-xs text-slate-500">{item.reason}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {formatMoney(item.payableAmountMinor)}
                    </span>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB: OVERTIME POLICIES */}
      {activeTab === "policies" && (
        <div className="space-y-4">
          {canManagePolicy && showPolicyForm && (
            <Card title={editingPolicyId ? "Edit Overtime Policy" : "New Overtime Policy"} subtitle="Set a per-hour rate or pay multiplier, plus rounding rules">
              <form onSubmit={submitPolicy} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Policy Name"
                  value={policy.name}
                  required
                  onChange={(e) => setPolicy({ ...policy, name: e.target.value })}
                  placeholder="e.g. Standard OT, Holiday Rate"
                />
                <CustomSelect
                  label="Calculation Method"
                  value={policy.calculation}
                  onChange={(e) => setPolicy({ ...policy, calculation: e.target.value })}
                  options={[
                    { value: "fixed_hourly", label: "Fixed Hourly Rate", sublabel: "Set a specific rate per OT hour" },
                    { value: "multiplier", label: "Multiplier on Base Pay", sublabel: "1.5× or 2× of assigned wage" },
                  ]}
                />
                {policy.calculation === "fixed_hourly" ? (
                  <Input
                    label="Overtime rate per hour (₹)"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    helperText="Enter the amount in rupees, for example 75"
                    value={policy.hourlyRateMinor}
                    onChange={(e) => setPolicy({ ...policy, hourlyRateMinor: e.target.value })}
                  />
                ) : (
                  <Input
                    label="Pay multiplier (×)"
                    type="number"
                    min="1"
                    max="10"
                    step="0.01"
                    helperText="Enter 1.5 for one and a half times the hourly wage."
                    value={policy.multiplierBasisPoints}
                    onChange={(e) => setPolicy({ ...policy, multiplierBasisPoints: e.target.value })}
                  />
                )}
                <CustomSelect
                  label="Round Down to Nearest (minutes)"
                  value={policy.roundingMinutes}
                  onChange={(e) => setPolicy({ ...policy, roundingMinutes: e.target.value })}
                  helperText="Rounds overtime down before payable time is calculated."
                  options={[1, 5, 10, 15, 30, 60].map((v) => ({
                    value: String(v),
                    label: `${v} minute${v > 1 ? "s" : ""}`,
                  }))}
                />
                <Input
                  label="Daily Maximum (minutes)"
                  type="number"
                  min="1"
                  max="1440"
                  helperText="Minutes above this daily cap are not payable."
                  value={policy.maximumMinutesPerDay}
                  onChange={(e) => setPolicy({ ...policy, maximumMinutesPerDay: e.target.value })}
                />
                <Input
                  label="Effective From"
                  type="date"
                  value={policy.effectiveFrom}
                  onChange={(e) => setPolicy({ ...policy, effectiveFrom: e.target.value })}
                />
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="button" variant="secondary" onClick={() => setShowPolicyForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    {editingPolicyId ? "Save Changes" : "Save Policy"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.policies.map((pol: any) => (
              <div
                key={pol.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{pol.name}</h3>
                  <Badge variant="info">{pol.calculation === "fixed_hourly" ? "Fixed Rate" : "Multiplier"}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="flex items-center gap-1 text-slate-500">Rate / Multiplier <InfoTip label="Overtime rate">{pol.calculation === "fixed_hourly" ? "The fixed rupee amount paid for each approved overtime hour." : "The employee’s hourly base pay multiplied by this factor for approved overtime."}</InfoTip></p>
                    <p className="font-semibold">
                      {pol.calculation === "fixed_hourly"
                        ? formatMoney(pol.hourlyRateMinor)
                        : `${pol.multiplierBasisPoints / 10000}×`}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="flex items-center gap-1 text-slate-500">Rounding <InfoTip label="Rounding rule">Approved overtime is rounded down to the nearest {pol.roundingMinutes} minutes before pay is calculated. For example, with 15-minute rounding, 52 minutes counts as 45.</InfoTip></p>
                    <p className="font-semibold">{pol.roundingMinutes}m</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="flex items-center gap-1 text-slate-500">Daily Cap <InfoTip label="Daily overtime cap">This is the maximum overtime counted for one employee on one work date. Any minutes above the cap are excluded from payable overtime.</InfoTip></p>
                    <p className="font-semibold">{pol.maximumMinutesPerDay}m</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="flex items-center gap-1 text-slate-500">Minimum time <InfoTip label="Minimum overtime time">At least {pol.minimumMinutes ?? 1} minute(s) must be recorded before a request can be submitted.</InfoTip></p>
                    <p className="font-semibold">{pol.minimumMinutes ?? 1}m</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-500">Effective From</p>
                    <p className="font-semibold">{pol.effectiveFrom}</p>
                  </div>
                </div>
                {canManagePolicy && <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => editPolicy(pol)}>Edit</Button><Button size="sm" variant="danger" onClick={() => setPolicyToDelete(pol)}>Delete</Button></div>}
              </div>
            ))}
            {data.policies.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  icon={Cog}
                  title="No overtime policies"
                  description="Create an overtime policy before recording overtime entries."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
