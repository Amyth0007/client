import { Fragment, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Blocks,
  CheckCircle2,
  CircleDollarSign,
  Layers,
  Pencil,
  PlusCircle,
  Receipt,
  Trash2,
  Wallet,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { HelpGuide } from "../../components/common/HelpGuide.js";
import { Input } from "../../components/common/Input.js";
import { InfoTip } from "../../components/common/InfoTip.js";
import { Modal } from "../../components/common/Modal.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Tabs } from "../../components/common/Tabs.js";
import { Badge } from "../../components/common/Badge.js";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.js";
import { Paged } from "../../components/common/Pagination.js";
import { useAuth } from "../auth/AuthContext.js";
import { hasActionPermission } from "../platform/module-registry.js";

export async function downloadEmployeePayslip(run: any, employee: any, company?: any) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pdfMoney = (minor: number, currency: string) => `${currency || "INR"} ${(Number(minor || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const companyName = company?.legalName || company?.name || "Company";
  const employeeName = employee.employeeName || "Employee";
  doc.setFillColor(20, 48, 85); doc.rect(0, 0, 210, 50, "F");
  doc.setFillColor(32, 177, 166); doc.roundedRect(15, 13, 3, 25, 1, 1, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(companyName, 23, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const companyLines = doc.splitTextToSize(company?.address || "Company address not provided", 116);
  companyLines.slice(0, 2).forEach((line: string, index: number) => doc.text(String(line), 23, 27 + index * 4));
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("PAYSLIP", 194, 20, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`${run.periodStart} — ${run.periodEnd}`, 194, 28, { align: "right" });

  doc.setTextColor(30, 41, 59); doc.setFillColor(241, 245, 249); doc.roundedRect(15, 58, 180, 47, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(employeeName, 21, 68);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(`Employee ID  ${employee.employeeNumber || "—"}`, 21, 77);
  doc.text(`Email  ${employee.email || "—"}`, 21, 84);
  doc.text(`Phone  ${employee.phone || "—"}`, 21, 91);
  doc.text(`Department  ${employee.departmentName || "—"}`, 108, 68);
  doc.text(`Designation  ${employee.designationName || "—"}`, 108, 77);
  doc.text(`Joining date  ${employee.joiningDate || "—"}`, 108, 84);

  const absentDays = employee.attendanceDays?.filter((day: any) => day.status === "absent") ?? [];
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Attendance summary", 16, 116);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const presentDays = employee.attendanceDays?.filter((day: any) => day.status === "present").length ?? 0;
  const leaveDays = employee.attendanceDays?.filter((day: any) => day.status === "leave").length ?? 0;
  const missingDays = employee.attendanceDays?.filter((day: any) => day.status === "missing").length ?? 0;
  doc.text(`Present: ${presentDays}     Absent: ${absentDays.length}     Leave: ${leaveDays}     Missing records: ${missingDays}`, 16, 123);
  let y = 135;
  doc.setFillColor(224, 231, 255); doc.roundedRect(15, y - 6, 180, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setTextColor(30, 41, 59); doc.text("Pay item", 19, y); doc.text("Category", 130, y); doc.text("Amount", 191, y, { align: "right" });
  doc.setFont("helvetica", "normal"); y += 8;
  for (const line of employee.lines ?? []) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setTextColor(51, 65, 85); doc.text(doc.splitTextToSize(String(line.name), 100)[0], 19, y);
    doc.text(String(line.kind).replaceAll("_", " "), 130, y);
    doc.text(pdfMoney(line.amountMinor, employee.currency ?? run.currency), 191, y, { align: "right" });
    y += 7; doc.setDrawColor(226, 232, 240); doc.line(17, y - 3, 193, y - 3);
  }
  if (y > 235) { doc.addPage(); y = 25; }
  y += 6; doc.setFillColor(241, 245, 249); doc.roundedRect(15, y, 180, 31, 3, 3, "F"); y += 9;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("Gross earnings", 20, y); doc.text(pdfMoney(employee.grossEarningsMinor, run.currency), 190, y, { align: "right" }); y += 7;
  doc.text("Total deductions", 20, y); doc.setTextColor(190, 40, 60); doc.text(`- ${pdfMoney(employee.deductionsMinor, run.currency)}`, 190, y, { align: "right" }); y += 9;
  doc.setFillColor(20, 48, 85); doc.roundedRect(15, y, 180, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("NET PAY", 21, y + 10); doc.text(pdfMoney(employee.netPayMinor, run.currency), 190, y + 10, { align: "right" });
  if (absentDays.length) { y += 24; doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(`Absent dates: ${absentDays.map((day: any) => day.date).join(", ")}`, 16, y); }
  doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text("Generated by Workforce Payroll", 16, 286);
  doc.save(`salary-slip-${employee.employeeNumber}-${run.periodStart}.pdf`);
}

function attendanceMonthGroups(days: any[]) {
  const groups = new Map<string, any[]>();
  for (const day of days ?? []) {
    const key = String(day.date).slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), day]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, monthDays]) => {
    const [year, month] = key.split("-").map(Number);
    return { key, label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }), offset: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(), totalDays: new Date(Date.UTC(year, month, 0)).getUTCDate(), dayMap: new Map(monthDays.map((day: any) => [Number(String(day.date).slice(-2)), day])) };
  });
}

export function PayrollFoundationPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>({ components: [], structures: [], assignments: [] });
  const [earnings, setEarnings] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [previewRunId, setPreviewRunId] = useState<string | null>(() => typeof window === "undefined" ? null : window.sessionStorage.getItem("workforce-current-payroll-preview"));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("runs");
  const [runAction, setRunAction] = useState<{ run: any; action: "cancel" | "delete" } | null>(null);
  const [attendanceReview, setAttendanceReview] = useState<{ run: any; employee: any } | null>(null);
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: "structure" | "assignment"; name: string } | null>(null);

  const [revisionRun, setRevisionRun] = useState<any | null>(null);
  const [revisionForm, setRevisionForm] = useState({
    reason: "",
    adjustments: [] as Array<{
      employeeId: string;
      grossDeltaMinor: string;
      deductionsDeltaMinor: string;
      employerContributionsDeltaMinor: string;
    }>,
  });

  const [period, setPeriod] = useState({
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  });
  const [payrollName, setPayrollName] = useState("");

  const [showComponent, setShowComponent] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [showAssignment, setShowAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [showEarning, setShowEarning] = useState(false);

  const [component, setComponent] = useState({
    code: "",
    name: "",
    kind: "earning",
    calculation: "fixed",
    amountMinor: "",
    rateBasisPoints: "",
    basisComponentCode: "BASE",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const [structure, setStructure] = useState({
    name: "",
    mode: "simple",
    payBasis: "monthly",
    baseRateMinor: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    componentIds: [] as string[],
  });

  const [assignment, setAssignment] = useState({
    employeeId: "",
    structureId: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
  });

  const [earning, setEarning] = useState({
    employeeId: "",
    earningDate: new Date().toISOString().slice(0, 10),
    source: "manual",
    description: "",
    quantity: "1",
    rateMinor: "",
  });

  const load = async (tab = activeTab) => {
    setLoading(true);
    try {
      const wantsCompensation = ["structures", "components", "assignments"].includes(tab);
      const [comp, entryList, people, payrollRuns] = await Promise.all([
        wantsCompensation ? api.getPayrollCompensation() : Promise.resolve(null),
        tab === "earnings" ? api.listDailyEarnings() : Promise.resolve(null),
        ["earnings", "assignments"].includes(tab) ? api.listPayrollEmployees({ limit: 100 }) : Promise.resolve(null),
        ["runs", "pastRuns"].includes(tab) ? api.listPayrollRuns() : Promise.resolve(null),
      ]);
      if (comp) setData(comp);
      if (entryList) setEarnings(entryList);
      if (people) setEmployees(people.data);
      if (payrollRuns) setRuns(payrollRuns);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load payroll setup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeTab]);

  const save = async (event: React.FormEvent, operation: () => Promise<unknown>, close: () => void) => {
    event.preventDefault();
    setSaving(true);
    try {
      await operation();
      close();
      toast.success("Saved successfully");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const submitRevision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!revisionRun) return;
    setSaving(true);
    try {
      await api.createPayrollRevision(revisionRun.id, {
        reason: revisionForm.reason,
        adjustments: revisionForm.adjustments.map((item) => ({
          employeeId: item.employeeId,
          grossDeltaMinor: Math.round(Number(item.grossDeltaMinor) * 100),
          deductionsDeltaMinor: Math.round(Number(item.deductionsDeltaMinor) * 100),
          employerContributionsDeltaMinor: Math.round(Number(item.employerContributionsDeltaMinor) * 100),
        })),
      });
      setRevisionRun(null);
      await load();
      toast.success("Revision draft created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create revision");
    } finally {
      setSaving(false);
    }
  };

  const pendingEarnings = earnings.filter((e) => e.status === "pending");
  const currentPreview = runs.find((run) => run.id === previewRunId && run.state === "draft") ?? null;
  const pastRuns = runs.filter((run) => run.id !== currentPreview?.id);
  const visibleRuns = activeTab === "pastRuns" ? pastRuns : currentPreview ? [currentPreview] : [];

  const tabs = [
    { id: "runs", label: "Run payroll", icon: Receipt },
    { id: "pastRuns", label: "Past runs", icon: Receipt, count: pastRuns.length || undefined },
    { id: "earnings", label: "Daily Earnings", icon: CircleDollarSign, count: pendingEarnings.length || undefined },
    { id: "structures", label: "Pay Structures", icon: Layers },
    { id: "components", label: "Pay Components", icon: Blocks },
    { id: "assignments", label: "Employee Assignments", icon: Wallet },
  ];

  const updateReviewedAttendance = (status: string, date: string, checkInAt: string | null = null) => {
    if (!attendanceReview) return;
    const patchEmployee = (employee: any) => employee.employeeId !== attendanceReview.employee.employeeId ? employee : {
      ...employee,
      attendanceDays: employee.attendanceDays.map((day: any) => day.date === date ? { ...day, status, ...(status === "present" ? { checkInAt, checkOutAt: null } : status === "half_day" ? { checkInAt: null, checkOutAt: null } : { checkInAt: null, checkOutAt: null }) } : day),
    };
    setRuns((current) => current.map((run) => run.id === attendanceReview.run.id ? { ...run, employees: run.employees.map(patchEmployee) } : run));
    setAttendanceReview((current) => current ? { ...current, employee: patchEmployee(current.employee) } : current);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll & Compensation"
        description="Set employee pay, choose any date range, review the preview, then approve and finalize."
      />

      {/* Help Guide */}
      <HelpGuide
        title="Payroll Engine — Full Workflow"
        description="A payroll run totals each employee’s pay for chosen dates, creates a payslip, and tracks approval and locking."
        whyThisExists="The run calculates what the company owes each employee and creates a dated pay record. It does not transfer money; pay employees through your own bank or payment method after it is finalized and locked."
        steps={[
          {
            step: 1,
            title: "Pay Components",
            description: "Create earning, deduction, or employer-contribution components (Base, HRA, PF, etc.).",
            badge: "Setup",
          },
          {
            step: 2,
            title: "Pay Structures",
            description: "Bundle components into a named pay structure (e.g. 'Monthly Salaried'). Set base rate and pay frequency.",
            badge: "Setup",
          },
          {
            step: 3,
            title: "Assign to Employees",
            description: "Assign the correct pay structure to each employee with effective dates.",
            badge: "Setup",
          },
          {
            step: 4,
            title: "Approve Earnings",
            description: "Review and approve daily earnings (bonus, OT, manual entries) before including in payroll.",
            badge: "Pre-Payroll",
          },
          {
            step: 5,
            title: "Preview Run",
            description: "Choose any start and end dates. The preview calculates pay for those dates using approved earnings, attendance, and assigned pay.",
            badge: "Payroll",
          },
          {
            step: 6,
            title: "Approve & Finalize",
            description: "Submit for approval → Approve → Finalize & Lock → Download payslips.",
            badge: "Payroll",
          },
        ]}
        rules={[
          { label: "Pay amounts", value: "Enter pay in rupees. The system stores the smaller currency units automatically." },
          { label: "No employee login", value: "Employee profiles can be paid without an app account. Assign pay, record their attendance at the guard station, and add daily earnings. Admins can download and deliver their payslips; link a login for self-service." },
          { label: "Flexible dates", value: "Choose a pay period with any start and end date. Monthly pay is split across scheduled workdays, excluding weekly holidays, then adjusted for paid attendance." },
          { label: "Missing a record", value: "If a draft preview is missing attendance or earnings, add the record first, cancel the unsubmitted preview, then create a fresh preview for the same dates." },
          { label: "Dated Snapshots", value: "Pay structure values are snapshotted at the time of payroll run creation." },
          { label: "Revisions", value: "Finalized runs with no payments can be revised — a replacement run is created." },
          { label: "Lock on Finalize", value: "Once finalized, the run is immutable. Pay employees through your own bank or payment method." },
        ]}
        roles={[
          { role: "Org Admin", summary: "Full control — configure structures, run payroll, approve, finalize, and download payslips." },
          { role: "Sub-admin with payroll access", summary: "Same as admin if workforce.payroll permission is granted." },
        ]}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===== TAB: PAYROLL RUNS ===== */}
      {["runs", "pastRuns"].includes(activeTab) && (
        <div className="space-y-4">
          {/* Create Preview */}
          {activeTab === "runs" && <Card className="border-indigo-100" contentClassName="!p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-900">Create payroll preview</h3>
              <p className="text-[11px] text-slate-500">Choose a period; payroll uses attendance, approved OT, and assigned pay.</p>
            </div>
            <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto]">
              <Input className="col-span-2 py-1.5 md:col-span-1" label="Payroll name (optional)" value={payrollName} onChange={(e) => setPayrollName(e.target.value)} placeholder="e.g. November payroll" />
              <Input className="py-1.5" label="Start date" type="date" value={period.periodStart} onChange={(e) => setPeriod({ ...period, periodStart: e.target.value })} />
              <Input className="py-1.5" label="End date" type="date" value={period.periodEnd} onChange={(e) => setPeriod({ ...period, periodEnd: e.target.value })} />
              <Button className="col-span-2 w-full md:col-span-1" size="sm" isLoading={previewing} disabled={previewing || !period.periodStart || !period.periodEnd || period.periodEnd < period.periodStart} onClick={async () => {
                if (previewing) return;
                setPreviewing(true);
                try {
                  const preview = await api.createPayrollRun({ ...period, name: payrollName.trim() || undefined });
                  if (preview?.id) {
                    setPreviewRunId(preview.id);
                    window.sessionStorage.setItem("workforce-current-payroll-preview", preview.id);
                  }
                  await load();
                  setPayrollName("");
                  toast.success("Payroll preview created — review employees then submit");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Preview failed");
                } finally { setPreviewing(false); }
              }}><Receipt className="mr-2 h-4 w-4" />{previewing ? "Creating preview…" : "Preview period"}</Button>
            </div>
          </Card>}
          {activeTab === "runs" && !loading && !currentPreview && <EmptyState icon={Receipt} title="No current preview" description="Choose a date range above to create a payroll preview. Submitted and older runs are kept in Past runs." />}

          {/* Payroll Runs List */}
          {((activeTab === "pastRuns") || (activeTab === "runs" && Boolean(currentPreview))) && (loading ? (
            <p className="p-8 text-center text-sm text-slate-500">Loading payroll runs…</p>
          ) : visibleRuns.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={activeTab === "pastRuns" ? "No past payroll runs" : "No current preview"}
              description={activeTab === "pastRuns" ? "Submitted payroll runs will appear here." : "Choose a date range above to create a payroll preview."}
            />
          ) : (
            <div className="space-y-4">
              {visibleRuns.map((run) => (
                <Card key={run.id}>
                  {/* Run Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900">
                          {run.name || "Payroll"}
                        </h3>
                        {run.revision > 1 && (
                          <Badge variant="info">Revision {run.revision}</Badge>
                        )}
                        <Badge
                          variant={
                            run.state === "finalized" || run.state === "partially_paid" || run.state === "paid"
                              ? "success"
                              : run.state === "approved"
                                ? "info"
                                : run.state === "pending_approval"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {["partially_paid", "paid"].includes(run.state) ? "finalized" : run.state.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Period: {run.periodStart} – {run.periodEnd}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {run.revisionReason && <>{run.revisionReason} · </>}
                        {run.revisionOf && <>Replacement run · </>}
                        {run.totals.employees} employees · Gross{" "}
                        <strong>{formatMoney(run.totals.grossEarningsMinor, run.currency)}</strong> · Net{" "}
                        <strong>{formatMoney(run.totals.netPayMinor, run.currency)}</strong>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {run.state === "draft" && !run.revisionOf && <Button size="sm" variant="secondary" onClick={() => setRunAction({ run, action: "cancel" })}>Cancel Preview</Button>}
                      {run.payments.length === 0 && run.employees.every((employee: any) => employee.paidMinor === 0) && <Button size="sm" variant="danger" onClick={() => setRunAction({ run, action: "delete" })}>Delete Run</Button>}
                      {run.state === "finalized" &&
                        run.employees.every((emp: any) => emp.paidMinor === 0) &&
                        run.payments.length === 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setRevisionRun(run);
                              setRevisionForm({
                                reason: "",
                                adjustments: run.employees[0]
                                  ? [
                                      {
                                        employeeId: run.employees[0].employeeId,
                                        grossDeltaMinor: "0",
                                        deductionsDeltaMinor: "0",
                                        employerContributionsDeltaMinor: "0",
                                      },
                                    ]
                                  : [],
                              });
                            }}
                          >
                            Create Revision
                          </Button>
                        )}
                      {run.revisionOf && ["draft", "pending_approval"].includes(run.state) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await api.cancelPayrollRevision(run.id);
                              await load();
                              toast.success("Revision cancelled");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not cancel revision");
                            }
                          }}
                        >
                          Cancel Revision
                        </Button>
                      )}
                      {run.state === "draft" && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await api.submitPayrollRun(run.id);
                              await load();
                              setActiveTab("pastRuns");
                              toast.success("Payroll submitted for approval");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Submit failed");
                            }
                          }}
                        >
                          Submit for Approval
                        </Button>
                      )}
                      {run.state === "pending_approval" && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await api.approvePayrollRun(run.id);
                              await load();
                              toast.success("Payroll approved");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Approval failed");
                            }
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Approve Run
                        </Button>
                      )}
                      {run.state === "approved" && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await api.finalizePayrollRun(run.id);
                              await load();
                              toast.success("Payroll finalized and locked");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Finalize failed");
                            }
                          }}
                        >
                          Finalize & Lock
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Employee Breakdown Table */}
                  <div className="mt-4 space-y-3 md:hidden">
                    <Paged items={run.employees} initialPageSize={10}>{(rows: any[]) => <>{rows.map((employee: any) => <article key={employee.employeeId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-sm font-semibold text-slate-900">{employee.employeeNumber} · {employee.employeeName}</h4>{employee.dailyRateMinor != null && <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-indigo-700">Monthly daily rate <InfoTip label="Monthly daily rate">{formatMoney(employee.dailyRateMinor, run.currency)} per scheduled workday. This is monthly pay divided by {employee.scheduledWorkDays} scheduled workdays, excluding weekly holidays.</InfoTip></span>}</div><button type="button" className="shrink-0 text-xs font-semibold text-indigo-700" onClick={() => { setAttendanceReview({ run, employee }); setSelectedAttendanceDate(employee.attendanceDays?.find((day: any) => day.status !== "day_off")?.date ?? null); }}>Review days</button></div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">Gross</span><strong className="text-slate-900">{formatMoney(employee.grossEarningsMinor, run.currency)}</strong></div><div className="rounded-lg bg-rose-50 p-2"><span className="block text-rose-600">Deductions</span><strong className="text-rose-800">{formatMoney(employee.deductionsMinor, run.currency)}</strong></div><div className="rounded-lg bg-indigo-50 p-2"><span className="block text-indigo-600">Net pay</span><strong className="text-indigo-900">{formatMoney(employee.netPayMinor, run.currency)}</strong></div><div className="rounded-lg bg-emerald-50 p-2"><span className="block text-emerald-600">Paid</span><strong className="text-emerald-800">{formatMoney(employee.paidMinor, run.currency)}</strong></div></div>
                      {["finalized", "partially_paid", "paid"].includes(run.state) && <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => downloadEmployeePayslip(run, employee, user?.organization)}>Download payslip</Button>}
                    </article>)}</>}</Paged>
                  </div>
                  <div className="mt-4 hidden overflow-x-auto md:block">
                    <Paged items={run.employees} initialPageSize={25}>{(rows: any[]) => (<table className="w-full min-w-[1000px] text-left text-xs">
                      <thead>
                        <tr className="text-slate-500 font-semibold border-b border-slate-100">
                          <th className="py-2 pr-4">Employee</th>
                          <th className="py-2 pr-4">Gross</th>
                          <th className="py-2 pr-4">Deductions</th>
                          <th className="py-2 pr-4">Net Pay</th>
                          <th className="py-2 text-center">Payslip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map((employee: any) => (
                          <Fragment key={employee.employeeId}>
                          <tr key={employee.employeeId} className="hover:bg-slate-50/50">
            <td className="py-2.5 pr-4 font-medium text-slate-900">
                              <span className="block">{employee.employeeNumber} · {employee.employeeName}</span>
                              {employee.dailyRateMinor != null && <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-normal text-indigo-700">Monthly daily rate <InfoTip label="Monthly daily rate">{formatMoney(employee.dailyRateMinor, run.currency)} per scheduled workday. This is monthly pay divided by {employee.scheduledWorkDays} scheduled workdays, excluding weekly holidays.</InfoTip></span>}
                              {employee.structureSnapshot?.payBasis === "none" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Pay structure missing</span>}
                              <button type="button" className="ml-2 text-[11px] font-semibold text-indigo-700 hover:underline" onClick={() => { setAttendanceReview({ run, employee }); setSelectedAttendanceDate(employee.attendanceDays?.find((day: any) => day.status !== "day_off")?.date ?? null); }}>Review days</button>
                            </td>
                            <td className="py-2.5 pr-4 text-slate-700">
                              {formatMoney(employee.grossEarningsMinor, run.currency)}
                            </td>
                            <td className="py-2.5 pr-4 text-rose-600">
                              -{formatMoney(employee.deductionsMinor, run.currency)}
                            </td>
                            <td className="py-2.5 pr-4 font-semibold text-slate-900">
                              {formatMoney(employee.netPayMinor, run.currency)}
                            </td>
                            <td className="min-w-[150px] py-2.5 px-3 text-center">{["finalized", "partially_paid", "paid"].includes(run.state) && <Button className="whitespace-nowrap" size="sm" variant="outline" onClick={() => downloadEmployeePayslip(run, employee, user?.organization)}>Download payslip</Button>}</td>
                          </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>)}</Paged>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ===== TAB: DAILY EARNINGS ===== */}
      {activeTab === "earnings" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowEarning(!showEarning)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Daily Earning
            </Button>
          </div>

          {showEarning && (
            <Card title="New Daily Earning Entry" subtitle="Record a manual earning, bonus, or task-based payment for approval">
              <form
                onSubmit={(e) =>
                  void save(
                    e,
                    () =>
                      api.createDailyEarning({
                        ...earning,
                        quantityThousandths: Math.round(Number(earning.quantity) * 1000),
                        rateMinor: Math.round(Number(earning.rateMinor) * 100),
                      }),
                    () => setShowEarning(false)
                  )
                }
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <div className="sm:col-span-2 lg:col-span-3">
                  <CustomSelect
                    label="Employee"
                    required
                    value={earning.employeeId}
                    onChange={(e) => setEarning({ ...earning, employeeId: e.target.value })}
                    placeholder="Select employee"
                    options={employees.map((item) => ({
                      value: item.id,
                      label: item.name,
                      sublabel: item.employeeNumber,
                    }))}
                  />
                </div>
                <Input
                  label="Earning Date"
                  type="date"
                  required
                  value={earning.earningDate}
                  onChange={(e) => setEarning({ ...earning, earningDate: e.target.value })}
                />
                <CustomSelect
                  label="Earning Type / Source"
                  value={earning.source}
                  onChange={(e) => setEarning({ ...earning, source: e.target.value })}
                  options={[
                    { value: "manual", label: "Manual Entry" },
                    { value: "task", label: "Task-Based" },
                    { value: "piece_rate", label: "Piece Rate" },
                    { value: "bonus", label: "Bonus" },
                    { value: "overtime", label: "Overtime" },
                    { value: "attendance", label: "Attendance Incentive" },
                    { value: "adjustment", label: "Adjustment" },
                  ]}
                />
                <Input
                  label="Description"
                  required
                  placeholder="e.g. Q4 performance bonus, Extra shift allowance"
                  value={earning.description}
                  onChange={(e) => setEarning({ ...earning, description: e.target.value })}
                />
                <Input
                  label="Quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  helperText="Units produced, hours, or 1 for flat amounts"
                  value={earning.quantity}
                  onChange={(e) => setEarning({ ...earning, quantity: e.target.value })}
                />
                <Input
                  label="Rate per unit (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  helperText="Enter the amount in rupees per unit"
                  value={earning.rateMinor}
                  onChange={(e) => setEarning({ ...earning, rateMinor: e.target.value })}
                />
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="button" variant="secondary" onClick={() => setShowEarning(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    Create Earning Entry
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="Daily Earning Entries" subtitle="All manual earnings, bonuses, and OT — pending entries must be approved to include in payroll">
            {loading ? (
              <p className="p-6 text-center text-sm text-slate-500">Loading earnings…</p>
            ) : earnings.length === 0 ? (
              <EmptyState icon={CircleDollarSign} title="No daily earnings" description="Add daily earnings for employees that will be included in payroll runs." />
            ) : (
              <div className="overflow-x-auto">
                <Paged items={earnings} initialPageSize={25}>{(rows) => (<table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Amount</th>
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
                        <td className="px-4 py-3 text-slate-700">{item.earningDate}</td>
                        <td className="px-4 py-3 text-slate-700">{item.description}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{item.source?.replace("_", " ")}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatMoney(item.amountMinor, item.currency)}
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
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await api.reviewDailyEarning(item.id, "approved");
                                    await load();
                                    toast.success("Earning approved");
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "Review failed");
                                  }
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    await api.reviewDailyEarning(item.id, "rejected");
                                    await load();
                                  } catch (error) {
                                    toast.error(error instanceof Error ? error.message : "Review failed");
                                  }
                                }}
                              >
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
        </div>
      )}

      {/* ===== TAB: PAY STRUCTURES ===== */}
      {activeTab === "structures" && (
        <div className="space-y-4">
          <div className="flex justify-end">
              <Button onClick={() => { setEditingStructureId(null); setShowStructure(!showStructure); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Pay Structure
            </Button>
          </div>

          {showStructure && (
            <Card title={editingStructureId ? "Edit Pay Structure" : "Create Pay Structure"} subtitle="Bundle components and define the pay mode for a group of employees">
              <form
                onSubmit={(e) =>
                  void save(
                    e,
                    () =>
                      (editingStructureId ? api.updatePayStructure(editingStructureId, {
                        ...structure,
                        baseRateMinor: Math.round(Number(structure.baseRateMinor) * 100),
                        componentIds: structure.componentIds,
                      }) : api.createPayStructure({
                        ...structure,
                        baseRateMinor: Math.round(Number(structure.baseRateMinor) * 100),
                        componentIds: structure.componentIds,
                      })),
                    () => setShowStructure(false)
                  )
                }
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <Input
                  label="Structure Name"
                  required
                  placeholder="e.g. Monthly Salaried, Daily Wage, Field Executive"
                  value={structure.name}
                  onChange={(e) => setStructure({ ...structure, name: e.target.value })}
                />
                <CustomSelect
                  label="Mode"
                  value={structure.mode}
                  onChange={(e) => setStructure({ ...structure, mode: e.target.value })}
                  options={[
                    { value: "simple", label: "Simple (Base only)", sublabel: "CTC without component breakdown" },
                    { value: "professional", label: "Professional (With components)", sublabel: "HRA, PF, etc." },
                  ]}
                />
                <CustomSelect
                  label="Pay Frequency / Basis"
                  value={structure.payBasis}
                  onChange={(e) => setStructure({ ...structure, payBasis: e.target.value })}
                  options={["monthly", "daily", "hourly", "shift", "piece"].map((basis) => ({
                    value: basis,
                    label: basis.charAt(0).toUpperCase() + basis.slice(1),
                  }))}
                />
                <Input
                  label={`Base rate (₹ per ${structure.payBasis === "monthly" ? "month" : structure.payBasis === "daily" ? "day" : structure.payBasis === "hourly" ? "hour" : structure.payBasis})`}
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  helperText="Enter the employee's base pay directly in rupees"
                  value={structure.baseRateMinor}
                  onChange={(e) => setStructure({ ...structure, baseRateMinor: e.target.value })}
                />
                <Input
                  label="Effective From"
                  type="date"
                  required
                  value={structure.effectiveFrom}
                  onChange={(e) => setStructure({ ...structure, effectiveFrom: e.target.value })}
                />
                {data.components.length > 0 && (
                  <fieldset className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-200 p-3">
                    <legend className="px-2 text-xs font-semibold text-slate-700">
                      Attach Pay Components (optional)
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {data.components.map((item: any) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={structure.componentIds.includes(item.id)}
                            onChange={(e) =>
                              setStructure({
                                ...structure,
                                componentIds: e.target.checked
                                  ? [...structure.componentIds, item.id]
                                  : structure.componentIds.filter((id) => id !== item.id),
                              })
                            }
                          />
                          <span className="font-medium">{item.name}</span>
                          <span className="text-slate-500 capitalize">({item.kind})</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="button" variant="secondary" onClick={() => setShowStructure(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    {editingStructureId ? "Save Changes" : "Save Pay Structure"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {data.structures.map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900">{item.name}</h3>
                  <div className="flex gap-1">
                    <Badge variant="neutral">{item.mode}</Badge>
                    <Badge variant="info">{item.payBasis}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-500">Base Rate</p>
                    <p className="font-semibold text-slate-900">{formatMoney(item.baseRateMinor)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-500">Effective</p>
                    <p className="font-semibold text-slate-900">{item.effectiveFrom}</p>
                  </div>
                </div>
                {item.components?.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Components: {item.components.map((c: any) => c.name).join(", ")}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditingStructureId(item.id); setStructure({ name: item.name, mode: item.mode, payBasis: item.payBasis, baseRateMinor: String(item.baseRateMinor / 100), effectiveFrom: item.effectiveFrom, componentIds: (item.components ?? []).map((c: any) => String(c.componentId)) }); setShowStructure(true); }}><Pencil className="mr-1 h-3.5 w-3.5"/>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget({ id: item.id, kind: "structure", name: item.name })}><Trash2 className="mr-1 h-3.5 w-3.5"/>Delete</Button>
                </div>
              </div>
            ))}
            {data.structures.length === 0 && (
              <div className="sm:col-span-2">
                <EmptyState
                  icon={Layers}
                  title="No pay structures"
                  description="Create pay structures to define how employee salaries and wages are calculated."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: PAY COMPONENTS ===== */}
      {activeTab === "components" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowComponent(!showComponent)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Component
            </Button>
          </div>

          {showComponent && (
            <Card title="New Pay Component" subtitle="Create an earning, deduction, or employer contribution component">
              <form
                onSubmit={(e) =>
                  void save(
                    e,
                    () =>
                      api.createPayrollComponent({
                        code: component.code,
                        name: component.name,
                        kind: component.kind,
                        calculation: component.calculation,
                        amountMinor: Math.round(Number(component.amountMinor || 0) * 100),
                        rateBasisPoints: Math.round(Number(component.rateBasisPoints || 0) * 100),
                        basisComponentCode: component.basisComponentCode,
                        effectiveFrom: component.effectiveFrom,
                      }),
                    () => setShowComponent(false)
                  )
                }
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <Input
                  label="Component Code"
                  required
                  placeholder="e.g. HRA, PF, BASIC"
                  value={component.code}
                  onChange={(e) => setComponent({ ...component, code: e.target.value })}
                />
                <Input
                  label="Component Name"
                  required
                  placeholder="e.g. House Rent Allowance"
                  value={component.name}
                  onChange={(e) => setComponent({ ...component, name: e.target.value })}
                />
                <CustomSelect
                  label="Category"
                  value={component.kind}
                  onChange={(e) => setComponent({ ...component, kind: e.target.value })}
                  options={[
                    { value: "earning", label: "Earning", sublabel: "Added to gross pay" },
                    { value: "deduction", label: "Deduction", sublabel: "Subtracted from gross" },
                    { value: "employer_contribution", label: "Employer Contribution", sublabel: "PF, ESI, etc." },
                  ]}
                />
                <CustomSelect
                  label="Calculation Method"
                  value={component.calculation}
                  onChange={(e) => setComponent({ ...component, calculation: e.target.value })}
                  options={[
                    { value: "fixed", label: "Fixed Amount", sublabel: "Same value every period" },
                    { value: "percentage", label: "Percentage of Another", sublabel: "% of a basis component" },
                  ]}
                />
                {component.calculation === "fixed" ? (
                  <Input
                    label="Fixed amount (₹)"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    helperText="Enter the amount directly in rupees"
                    value={component.amountMinor}
                    onChange={(e) => setComponent({ ...component, amountMinor: e.target.value })}
                  />
                ) : (
                  <>
                    <Input
                      label="Percentage (%)"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.01"
                      required
                      helperText="Enter a percentage, such as 40 for 40% of the selected pay component."
                      value={component.rateBasisPoints}
                      onChange={(e) => setComponent({ ...component, rateBasisPoints: e.target.value })}
                    />
                    <Input
                      label="Basis Component Code"
                      required
                      helperText="Code of the component to calculate % from"
                      value={component.basisComponentCode}
                      onChange={(e) => setComponent({ ...component, basisComponentCode: e.target.value })}
                    />
                  </>
                )}
                <Input
                  label="Effective From"
                  type="date"
                  required
                  value={component.effectiveFrom}
                  onChange={(e) => setComponent({ ...component, effectiveFrom: e.target.value })}
                />
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
                  <Button type="button" variant="secondary" onClick={() => setShowComponent(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    Save Component
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.components.map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                      {item.code}
                    </span>
                    <h3 className="mt-1.5 font-semibold text-slate-900">{item.name}</h3>
                  </div>
                  <Badge
                    variant={item.kind === "earning" ? "success" : item.kind === "deduction" ? "danger" : "info"}
                  >
                    {item.kind.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-500">Calculation</p>
                    <p className="font-semibold capitalize">{item.calculation}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-slate-500">Value</p>
                    <p className="font-semibold">
                      {item.calculation === "fixed"
                        ? formatMoney(item.amountMinor)
                        : `${item.rateBasisPoints / 100}% of ${item.basisComponentCode}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {data.components.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  icon={Blocks}
                  title="No pay components"
                  description="Create pay components like Basic Pay, HRA, PF, and professional tax to build structured pay packages."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: EMPLOYEE ASSIGNMENTS ===== */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              disabled={!data.structures.length || !employees.length}
              onClick={() => { setEditingAssignmentId(null); setShowAssignment(!showAssignment); }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Assign Pay Structure
            </Button>
          </div>

          {!data.structures.length && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              Create at least one pay structure before assigning compensation to employees.
            </div>
          )}

          {showAssignment && (
            <Card title={editingAssignmentId ? "Edit Employee Pay Assignment" : "Assign Pay Structure"} subtitle="Link an employee to a compensation structure with effective dates">
              <form
                onSubmit={(e) =>
                  void save(
                    e,
                    () => editingAssignmentId ? api.updateCompensationAssignment(editingAssignmentId, { ...assignment, effectiveTo: assignment.effectiveTo || null }) : api.assignCompensation({ ...assignment, effectiveTo: assignment.effectiveTo || null }),
                    () => setShowAssignment(false)
                  )
                }
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <CustomSelect
                  label="Employee"
                  required
                  value={assignment.employeeId}
                  onChange={(e) => setAssignment({ ...assignment, employeeId: e.target.value })}
                  placeholder="Select employee"
                  options={employees.map((item) => ({
                    value: item.id,
                    label: item.name,
                    sublabel: item.employeeNumber,
                  }))}
                />
                <CustomSelect
                  label="Pay Structure"
                  required
                  value={assignment.structureId}
                  onChange={(e) => setAssignment({ ...assignment, structureId: e.target.value })}
                  placeholder="Select structure"
                  options={data.structures
                    .filter((item: any) => item.status === "active")
                    .map((item: any) => ({
                      value: item.id,
                      label: item.name,
                      sublabel: `${item.payBasis} · ${formatMoney(item.baseRateMinor)}`,
                    }))}
                />
                <Input
                  label="Effective From"
                  type="date"
                  required
                  value={assignment.effectiveFrom}
                  onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })}
                />
                <Input
                  label="Effective To (optional)"
                  type="date"
                  helperText="Leave blank for open-ended assignment"
                  value={assignment.effectiveTo}
                  onChange={(e) => setAssignment({ ...assignment, effectiveTo: e.target.value })}
                />
                <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                  <Button type="button" variant="secondary" onClick={() => setShowAssignment(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" isLoading={saving}>
                    {editingAssignmentId ? "Save Changes" : "Save Assignment"}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <Card title="Current Pay Structure Assignments" subtitle="Employee-to-structure links with effective date ranges">
            {data.assignments?.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No assignments yet"
                description="Assign pay structures to employees after configuring your compensation model."
              />
            ) : (
              <div className="overflow-x-auto">
                <Paged items={data.assignments} initialPageSize={25}>{(rows) => (<table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Pay Structure</th>
                      <th className="px-4 py-3">Effective From</th>
                      <th className="px-4 py-3">Effective To</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.structure?.name}</td>
                        <td className="px-4 py-3 text-slate-600">{item.effectiveFrom}</td>
                        <td className="px-4 py-3 text-slate-600">{item.effectiveTo ?? "Open"}</td>
                        <td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingAssignmentId(item.id); setAssignment({ employeeId: item.employee?._id ?? item.employee?.id ?? "", structureId: item.structure?._id ?? item.structure?.id ?? "", effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? "" }); setShowAssignment(true); }}><Pencil className="mr-1 h-3.5 w-3.5"/>Edit</Button><Button size="sm" variant="danger" onClick={() => setDeleteTarget({ id: item.id, kind: "assignment", name: `${item.employee?.firstName ?? "Employee"} pay assignment` })}><Trash2 className="mr-1 h-3.5 w-3.5"/>Delete</Button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>)}</Paged>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal: Create Payroll Revision */}
      <Modal
        isOpen={Boolean(revisionRun)}
        onClose={() => setRevisionRun(null)}
        title="Create Payroll Revision"
        description="The replacement starts from the finalized snapshot. Enter any increases or deductions in rupees."
        maxWidth="lg"
      >
        {revisionRun && (
          <form onSubmit={(event) => void submitRevision(event)} className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <strong>Note:</strong> Only finalized runs with no recorded payments can be revised. Finalizing the
              replacement will reverse and supersede the original run.
            </div>
            <Input
              label="Revision Reason"
              required
              maxLength={500}
              value={revisionForm.reason}
              onChange={(event) => setRevisionForm({ ...revisionForm, reason: event.target.value })}
              placeholder="e.g. Missing statutory deductions, TDS correction"
            />

            <div className="space-y-3">
              {revisionForm.adjustments.map((adjustment, index) => (
                <div key={`${index}-${adjustment.employeeId}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <CustomSelect
                      label="Employee"
                      required
                      value={adjustment.employeeId}
                      onChange={(event) =>
                        setRevisionForm({
                          ...revisionForm,
                          adjustments: revisionForm.adjustments.map((item, i) =>
                            i === index ? { ...item, employeeId: event.target.value } : item
                          ),
                        })
                      }
                      options={revisionRun.employees
                        .filter(
                          (employee: any) =>
                            employee.employeeId === adjustment.employeeId ||
                            !revisionForm.adjustments.some(
                              (item, i) => i !== index && item.employeeId === employee.employeeId
                            )
                        )
                        .map((employee: any) => ({
                          value: employee.employeeId,
                          label: employee.employeeName,
                          sublabel: employee.employeeNumber,
                        }))}
                      className="flex-1"
                    />
                    <div className="mt-5">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setRevisionForm({
                            ...revisionForm,
                            adjustments: revisionForm.adjustments.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["grossDeltaMinor", "Gross change (₹)"],
                        ["deductionsDeltaMinor", "Deductions change (₹)"],
                        ["employerContributionsDeltaMinor", "Employer contribution change (₹)"],
                      ] as const
                    ).map(([key, label]) => (
                      <Input
                        key={key}
                        label={label}
                        type="number"
                        step="0.01"
                        helperText="Enter rupees. Positive adds to payroll; negative reduces it."
                        value={adjustment[key]}
                        onChange={(event) =>
                          setRevisionForm({
                            ...revisionForm,
                            adjustments: revisionForm.adjustments.map((item, i) =>
                              i === index ? { ...item, [key]: event.target.value } : item
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const available = revisionRun.employees.find(
                  (employee: any) =>
                    !revisionForm.adjustments.some((item) => item.employeeId === employee.employeeId)
                );
                if (available)
                  setRevisionForm({
                    ...revisionForm,
                    adjustments: [
                      ...revisionForm.adjustments,
                      {
                        employeeId: available.employeeId,
                        grossDeltaMinor: "0",
                        deductionsDeltaMinor: "0",
                        employerContributionsDeltaMinor: "0",
                      },
                    ],
                  });
              }}
              disabled={revisionForm.adjustments.length >= revisionRun.employees.length}
            >
              Add Employee Adjustment
            </Button>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setRevisionRun(null)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={saving} disabled={!revisionForm.adjustments.length}>
                Create Revision Draft
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(attendanceReview)}
        onClose={() => { setAttendanceReview(null); setSelectedAttendanceDate(null); }}
        title={attendanceReview ? `Attendance calendar · ${attendanceReview.employee.employeeName}` : "Attendance calendar"}
        description={attendanceReview ? `${attendanceReview.run.periodStart} to ${attendanceReview.run.periodEnd} · Select a date to see attendance and overtime recorded for that day.` : undefined}
        maxWidth="xl"
      >
        {attendanceReview && <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">{[["Present", "bg-emerald-100 text-emerald-800"], ["Half day", "bg-amber-100 text-amber-800"], ["Absent", "bg-rose-100 text-rose-800"], ["Leave", "bg-sky-100 text-sky-800"], ["No record", "bg-amber-100 text-amber-800"], ["Day off", "bg-slate-100 text-slate-500"]].map(([label, cls]) => <span key={label} className={`rounded-full px-2 py-1 font-medium ${cls}`}>{label}</span>)}<span className="ml-auto rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-800">Approved OT: {formatMoney(attendanceReview.employee.attendanceDays.reduce((sum: number, item: any) => sum + (item.overtimeAmountMinor ?? 0), 0), attendanceReview.run.currency)}</span></div>
          <div className="grid gap-4 md:grid-cols-2">{attendanceMonthGroups(attendanceReview.employee.attendanceDays).map((month) => <section key={month.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{month.label}</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{Array.from({ length: month.offset }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: month.totalDays }, (_, index) => {
              const dayNumber = index + 1; const day = month.dayMap.get(dayNumber); const date = `${month.key}-${String(dayNumber).padStart(2, "0")}`;
              const status = day?.status ?? "outside";
              const cls = status === "present" ? "bg-emerald-100 text-emerald-800" : status === "half_day" ? "bg-amber-100 text-amber-800" : status === "absent" ? "bg-rose-100 text-rose-800" : status === "leave" ? "bg-sky-100 text-sky-800" : status === "missing" ? "bg-amber-100 text-amber-900" : status === "day_off" ? "bg-slate-100 text-slate-500" : "text-slate-300";
              return <button key={date} type="button" onClick={() => day && setSelectedAttendanceDate(date)} disabled={!day} aria-label={`${date} ${status}`} className={`relative aspect-square rounded-lg text-xs font-semibold transition hover:ring-2 hover:ring-indigo-300 disabled:cursor-default ${cls} ${selectedAttendanceDate === date ? "ring-2 ring-indigo-600" : ""}`}>{dayNumber}{day?.overtimeAmountMinor > 0 && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-600" />}</button>;
            })}</div>
          </section>)}</div>
          {(() => { const day = attendanceReview.employee.attendanceDays?.find((item: any) => item.date === selectedAttendanceDate); if (!day) return null; return <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{day.date}</h3><p className="mt-1 text-sm capitalize text-slate-600">{day.status === "missing" ? "No attendance record" : day.status}</p><p className="mt-2 text-xs text-slate-600">Check-in: {day.checkInAt ? new Date(day.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} · Check-out: {day.checkOutAt ? new Date(day.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p>{day.overtimeAmountMinor > 0 && <p className="mt-1 text-xs font-semibold text-violet-800">Approved overtime included: {formatMoney(day.overtimeAmountMinor, attendanceReview.run.currency)}</p>}</div>{attendanceReview.run.state === "draft" && !["day_off", "leave"].includes(day.status) && hasActionPermission(user, "attendance.adjust") && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={async () => { try { await api.adjustAttendance({ employeeId: attendanceReview.employee.employeeId, attendanceDate: day.date, status: "present", checkInAt: new Date(`${day.date}T09:00:00+05:30`).toISOString(), reason: "Attendance corrected during payroll review" }); updateReviewedAttendance("present", day.date, new Date(`${day.date}T09:00:00+05:30`).toISOString()); toast.success("Attendance updated in this review. Recreate the draft to recalculate pay."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update attendance"); } }}>Mark present</Button><Button size="sm" variant="outline" onClick={async () => { try { await api.adjustAttendance({ employeeId: attendanceReview.employee.employeeId, attendanceDate: day.date, status: "half_day", reason: "Half day confirmed during payroll review" }); updateReviewedAttendance("half_day", day.date); toast.success("Attendance updated in this review. Recreate the draft to recalculate pay."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update attendance"); } }}>Half day</Button><Button size="sm" variant="outline" onClick={async () => { try { await api.adjustAttendance({ employeeId: attendanceReview.employee.employeeId, attendanceDate: day.date, status: "absent", reason: "Absence confirmed during payroll review" }); updateReviewedAttendance("absent", day.date); toast.success("Attendance updated in this review. Recreate the draft to recalculate pay."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update attendance"); } }}>Mark absent</Button></div>}</div><div className="mt-3 border-t border-indigo-100 pt-3">{(attendanceReview.employee.lines ?? []).filter((line: any) => line.source === "attendance_absence" || line.source === "approved_overtime").map((line: any, index: number) => <div key={`${line.code}-${index}`} className="flex justify-between text-xs text-slate-700"><span>{line.name}</span><span>{formatMoney(line.amountMinor, attendanceReview.run.currency)}</span></div>)}{attendanceReview.run.state === "draft" && <p className="mt-2 text-[11px] text-indigo-800">Correct attendance or overtime, then delete and recreate the draft to refresh payroll amounts.</p>}</div></section>; })()}
        </div>}
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(runAction)}
        onClose={() => setRunAction(null)}
        title={runAction?.action === "delete" ? "Delete this payroll run?" : "Cancel this payroll preview?"}
        description={runAction?.action === "delete" ? "This permanently removes the run because no employee payment has been recorded. Keep a copy if you need it for your records." : "The draft will be marked cancelled. Create a new preview after correcting any missing records."}
        confirmLabel={runAction?.action === "delete" ? "Delete run" : "Cancel preview"}
        onConfirm={async () => { if (!runAction) return; const action = runAction; try { if (action.action === "delete") { await api.deletePayrollRun(action.run.id); if (previewRunId === action.run.id) { setPreviewRunId(null); window.sessionStorage.removeItem("workforce-current-payroll-preview"); } } else await api.cancelPayrollRun(action.run.id); toast.success(action.action === "delete" ? "Payroll run deleted" : "Preview cancelled"); setRunAction(null); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update payroll run"); setRunAction(null); } }}
      />
      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title={`Delete ${deleteTarget?.kind === "structure" ? "pay structure" : "pay assignment"}?`} description={deleteTarget?.kind === "structure" ? `Delete “${deleteTarget.name}”? Structures assigned to employees are protected.` : "Delete this employee’s pay assignment? Assignments used in payroll runs are protected."} confirmLabel="Delete" onConfirm={async () => { if (!deleteTarget) return; try { if (deleteTarget.kind === "structure") await api.deletePayStructure(deleteTarget.id); else await api.deleteCompensationAssignment(deleteTarget.id); toast.success(deleteTarget.kind === "structure" ? "Pay structure deleted" : "Assignment deleted"); setDeleteTarget(null); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete record"); setDeleteTarget(null); } }} />
    </div>
  );
}
