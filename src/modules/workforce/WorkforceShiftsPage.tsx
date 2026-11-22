import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeftRight, CalendarDays, Clock3, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { api, type ShiftSwapRequest } from "../../services/api-client.js";
import { Badge } from "../../components/common/Badge.js";
import { Button } from "../../components/common/Button.js";
import { HelpGuide } from "../../components/common/HelpGuide.js";
import { Modal } from "../../components/common/Modal.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Tabs } from "../../components/common/Tabs.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { ConfirmDialog } from "../../components/common/ConfirmDialog.js";
import { useAuth } from "../auth/AuthContext.js";

type ShiftBreakInput = { name: string; startTime: string; endTime: string; paid: boolean };

export function WorkforceShiftsPage() {
  const { user } = useAuth();
  const isAdminOrSubadmin = user?.role === "org_admin" || user?.role === "sub_admin";
  const [activeTab, setActiveTab] = useState<"schedules" | "swaps">("schedules");
  const [scheduleTab, setScheduleTab] = useState<"shifts" | "assignments">("shifts");
  const [shifts, setShifts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapToCancel, setSwapToCancel] = useState<string | null>(null);
  const [shiftToDelete, setShiftToDelete] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [shift, setShift] = useState({
    name: "",
    shiftType: "fixed",
    startTime: "09:00",
    endTime: "17:00",
    flexibleWindowMinutes: 0,
    breaks: [] as ShiftBreakInput[],
    effectiveFrom: new Date().toISOString().slice(0, 10),
    weeklyOffs: [] as number[],
  });

  const [assignment, setAssignment] = useState({
    employeeId: "",
    shiftId: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
  });

  const [swapForm, setSwapForm] = useState({
    targetEmployeeId: "",
    shiftDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const load = async () => {
    try {
      const [result, people, swapList] = await Promise.all([
        api.listWorkforceShifts(),
        api.listWorkforceEmployees({ limit: 100, status: "active" }),
        api.listShiftSwaps(!isAdminOrSubadmin),
      ]);
      setShifts(result.shifts);
      setAssignments(result.assignments);
      setEmployees(people.data);
      setSwaps(swapList);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load shifts");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addBreak = () => {
    setShift((s) => ({
      ...s,
      breaks: [...s.breaks, { name: "Break", startTime: "13:00", endTime: "14:00", paid: false }],
    }));
  };

  const removeBreak = (index: number) => {
    setShift((s) => ({
      ...s,
      breaks: s.breaks.filter((_, i) => i !== index),
    }));
  };

  const updateBreak = (index: number, patch: Partial<ShiftBreakInput>) => {
    setShift((s) => ({
      ...s,
      breaks: s.breaks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...shift,
        flexibleWindowMinutes: Number(shift.flexibleWindowMinutes),
        weeklyOffs: shift.weeklyOffs,
      };
      if (editingShiftId) await api.updateWorkforceShift(editingShiftId, payload);
      else await api.createWorkforceShift(payload);
      toast.success(editingShiftId ? "Shift updated" : "Shift created");
      setCreating(false);
      setEditingShiftId(null);
      setShift({
        name: "",
        shiftType: "fixed",
        startTime: "09:00",
        endTime: "17:00",
        flexibleWindowMinutes: 0,
        breaks: [],
        effectiveFrom: new Date().toISOString().slice(0, 10),
        weeklyOffs: [],
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create shift");
    } finally {
      setSaving(false);
    }
  };

  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.assignWorkforceShift({ ...assignment, effectiveTo: assignment.effectiveTo || null });
      toast.success("Shift assigned");
      setAssigning(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign shift");
    } finally {
      setSaving(false);
    }
  };

  const submitSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.requestShiftSwap(swapForm);
      toast.success("Shift swap requested successfully");
      setSwapping(false);
      setSwapForm({ targetEmployeeId: "", shiftDate: new Date().toISOString().slice(0, 10), reason: "" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit shift swap request");
    } finally {
      setSaving(false);
    }
  };

  const reviewSwap = async (swapId: string, decision: "approved" | "rejected") => {
    try {
      await api.reviewShiftSwap(swapId, decision);
      toast.success(`Shift swap ${decision}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${decision} swap`);
    }
  };

  const cancelSwap = async (swapId: string) => {
    try {
      await api.cancelShiftSwap(swapId);
      toast.success("Shift swap cancelled");
      setSwapToCancel(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel swap");
      setSwapToCancel(null);
    }
  };

  const pendingSwaps = swaps.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts & Schedules"
        description="Create effective-dated work shifts with break policies, assign staff to rosters, and manage shift swap requests."
      />

      <HelpGuide
        title="Shift Scheduling & Swap Management"
        description="Build a shift roster, assign employees to shifts, and configure automated break deductions and lateness thresholds."
        whyThisExists="Shifts drive attendance lateness calculations, automatic break deductions from working hours, half-day thresholds, and payroll-ready daily work logs."
        steps={[
          { step: 1, title: "Create Shifts", description: "Define shifts with start/end times, weekly offs, flexible window, and break periods.", badge: "Admin" },
          { step: 2, title: "Assign to Employees", description: "Assign the correct shift to each employee with an effective-from date.", badge: "Admin" },
          { step: 3, title: "Break Deductions", description: "Unpaid breaks defined in the shift are auto-deducted from total working hours on check-out.", badge: "Auto" },
          { step: 4, title: "Shift Swaps", description: "Employees request shift swaps; managers approve or reject via the Swap Requests tab.", badge: "Staff" },
        ]}
        rules={[
          { label: "Flexible Window", value: "Lateness is only triggered after expected start + flexible window minutes." },
          { label: "Unpaid Breaks", value: "Breaks marked 'unpaid' are automatically deducted from daily working minutes." },
          { label: "Weekly Offs", value: "Shifts with weekly off days configured show 'Weekly Off Today' on employee punch screen." },
          { label: "Overnight Shifts", value: "Crosses midnight detection allows correct duration calculation for night shifts." },
        ]}
        roles={[
          { role: "Org Admin / Sub-admin", summary: "Create, edit, and assign shifts to employees. Review and approve swap requests." },
          { role: "Employees", summary: "View assigned shift on today's punch screen. Submit shift swap requests to colleagues." },
        ]}
      />

      <Tabs
        tabs={[
          { id: "schedules", label: "Schedules", icon: Clock3 },
          { id: "swaps", label: "Shift Swap Requests", icon: ArrowLeftRight, count: pendingSwaps || undefined },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as "schedules" | "swaps")}
      />

      {activeTab === "schedules" && <Tabs
        ariaLabel="Schedule sections"
        variant="underline"
        tabs={[{ id: "shifts", label: `Shift catalog${shifts.length ? ` · ${shifts.length}` : ""}`, icon: Clock3 }, { id: "assignments", label: `Employee assignments${assignments.length ? ` · ${assignments.length}` : ""}`, icon: CalendarDays }]}
        activeTab={scheduleTab}
        onChange={(id) => setScheduleTab(id as "shifts" | "assignments")}
      />}

      {activeTab === "schedules" && isAdminOrSubadmin && <div className="flex justify-end">
        {scheduleTab === "shifts"
          ? <Button onClick={() => { setEditingShiftId(null); setCreating((value) => !value); }}><Plus className="mr-2 h-4 w-4" />New shift</Button>
          : <Button variant="secondary" onClick={() => setAssigning((value) => !value)} disabled={!shifts.length || !employees.length}><CalendarDays className="mr-2 h-4 w-4" />Assign shift</Button>}
      </div>}

      {activeTab === "schedules" && scheduleTab === "shifts" && creating && (
        <form onSubmit={create} className="grid gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="col-span-full flex items-center justify-between border-b border-indigo-100 pb-3"><div><h3 className="font-semibold text-slate-900">{editingShiftId ? "Edit shift" : "Create a shift"}</h3><p className="mt-1 text-xs text-slate-500">Set the hours, breaks, and weekly rest days for this schedule.</p></div><Clock3 className="h-5 w-5 text-indigo-500" /></div>
          <label className="text-xs font-medium text-slate-700">
            Shift name
            <input required value={shift.name} onChange={(e) => setShift({ ...shift, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="e.g. Morning Shift" />
          </label>
          <CustomSelect label="Shift type" required value={shift.shiftType} onChange={(e) => setShift({ ...shift, shiftType: e.target.value })} options={["fixed", "rotational", "night", "flexible", "split"].map((type) => ({ value: type, label: type[0].toUpperCase() + type.slice(1) }))} />
          <label className="text-xs font-medium text-slate-700">
            Start time
            <input type="time" required value={shift.startTime} onChange={(e) => setShift({ ...shift, startTime: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-700">
            End time
            <input type="time" required value={shift.endTime} onChange={(e) => setShift({ ...shift, endTime: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Effective from
            <input type="date" required value={shift.effectiveFrom} onChange={(e) => setShift({ ...shift, effectiveFrom: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          {shift.shiftType === "flexible" && (
            <label className="text-xs font-medium text-slate-700">
              Flexible start window (minutes)
              <input type="number" min={0} max={180} value={shift.flexibleWindowMinutes} onChange={(e) => setShift({ ...shift, flexibleWindowMinutes: Number(e.target.value) })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
          )}

          <fieldset className="col-span-full">
            <legend className="text-xs font-medium text-slate-700">Weekly off days</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                <label key={day} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={shift.weeklyOffs.includes(index)}
                    onChange={(e) => setShift({ ...shift, weeklyOffs: e.target.checked ? [...shift.weeklyOffs, index].sort() : shift.weeklyOffs.filter((v) => v !== index) })}
                  />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="col-span-full space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">Breaks (optional)</span>
              <Button type="button" size="sm" variant="outline" onClick={addBreak}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add break
              </Button>
            </div>
            {shift.breaks.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                <input
                  value={b.name}
                  onChange={(e) => updateBreak(i, { name: e.target.value })}
                  placeholder="Break name"
                  className="rounded border bg-white px-2 py-1"
                />
                <input
                  type="time"
                  value={b.startTime}
                  onChange={(e) => updateBreak(i, { startTime: e.target.value })}
                  className="rounded border bg-white px-2 py-1"
                />
                <span>to</span>
                <input
                  type="time"
                  value={b.endTime}
                  onChange={(e) => updateBreak(i, { endTime: e.target.value })}
                  className="rounded border bg-white px-2 py-1"
                />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={b.paid}
                    onChange={(e) => updateBreak(i, { paid: e.target.checked })}
                  />
                  Paid
                </label>
                <Button type="button" size="sm" variant="outline" onClick={() => removeBreak(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                </Button>
              </div>
            ))}
          </div>

          <div className="col-span-full flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditingShiftId(null); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editingShiftId ? "Save changes" : "Create shift"}</Button>
          </div>
        </form>
      )}

      {activeTab === "schedules" && scheduleTab === "assignments" && assigning && (
        <form onSubmit={assign} className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <h3 className="col-span-full font-semibold text-slate-900">Assign shift to employee</h3>
          <CustomSelect label="Employee" required searchable value={assignment.employeeId} onChange={(e) => setAssignment({ ...assignment, employeeId: e.target.value })} placeholder="Search employee" options={employees.map((person) => ({ value: person.id, label: person.name, sublabel: person.employeeNumber }))} />
          <CustomSelect label="Shift" required value={assignment.shiftId} onChange={(e) => setAssignment({ ...assignment, shiftId: e.target.value })} placeholder="Choose shift" options={shifts.filter((item) => item.status === "active").map((item) => ({ value: item.id, label: item.name, sublabel: `${item.startTime}–${item.endTime}` }))} />
          <label className="text-xs font-medium text-slate-700">
            Effective from
            <input type="date" required value={assignment.effectiveFrom} onChange={(e) => setAssignment({ ...assignment, effectiveFrom: e.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Effective to (optional)
            <input type="date" value={assignment.effectiveTo} onChange={(e) => setAssignment({ ...assignment, effectiveTo: e.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
          </label>
          <div className="col-span-full flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAssigning(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Assign"}</Button>
          </div>
        </form>
      )}

      {activeTab === "schedules" && scheduleTab === "shifts" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b px-4 py-3 text-sm font-semibold">Shift catalog</div>
            {shifts.length ? (
              <div className="divide-y divide-slate-100">
                {shifts.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-indigo-50 p-2 text-indigo-700">
                        <Clock3 className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {item.name}
                          <span className="ml-1 text-xs font-normal capitalize text-slate-500">
                            · {item.shiftType}{item.crossesMidnight ? " · overnight" : ""}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.startTime}–{item.endTime} · starts {item.effectiveFrom}
                          {item.flexibleWindowMinutes > 0 && ` · ${item.flexibleWindowMinutes}m flexible window`}
                        </p>
                        {item.breaks && item.breaks.length > 0 && (
                          <p className="mt-1 text-xs text-slate-400">
                            Breaks: {item.breaks.map((b: any) => `${b.name} (${b.startTime}-${b.endTime}${b.paid ? ", paid" : ""})`).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                      <p className="text-xs text-slate-500">Weekly off: {item.weeklyOffs?.map((day: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ") || "None"}</p>
                      {isAdminOrSubadmin && <><Button size="sm" variant="outline" onClick={() => { setEditingShiftId(item.id); setShift({ name: item.name, shiftType: item.shiftType, startTime: item.startTime, endTime: item.endTime, flexibleWindowMinutes: item.flexibleWindowMinutes, breaks: item.breaks ?? [], effectiveFrom: item.effectiveFrom, weeklyOffs: item.weeklyOffs ?? [] }); setCreating(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button><Button size="sm" variant="danger" onClick={() => setShiftToDelete(item)}>Delete</Button></>}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No shifts configured.</p>
            )}
          </section>

      )}

      {activeTab === "schedules" && scheduleTab === "assignments" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b px-4 py-3 text-sm font-semibold">
              Current and future assignments <span className="ml-1 text-slate-400">{assignments.length}</span>
            </div>
            {assignments.length ? (
              <div className="divide-y divide-slate-100">
                {assignments.map((item) => (
                  <div key={item.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(120px,auto)_minmax(140px,auto)] sm:items-center sm:gap-3">
                    <span className="font-medium text-slate-900">
                      {item.employee?.employeeNumber} · {item.employee?.firstName} {item.employee?.lastName}
                    </span>
                    <span className="text-slate-600">{item.shift?.name}</span>
                    <span className="text-xs text-slate-500">{item.effectiveFrom} – {item.effectiveTo || "Ongoing"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-500">No assignments yet.</p>
            )}
          </section>
      )}

      {activeTab === "swaps" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold flex items-center justify-between">
            <span>Shift swap requests</span>
            <Button size="sm" onClick={() => setSwapping(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New swap request
            </Button>
          </div>
          {swaps.length ? (
            <div className="divide-y divide-slate-100">
              {swaps.map((swap) => {
                const isPending = swap.status === "pending";
                return (
                  <div key={swap.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{swap.shiftDate}</span>
                        <Badge variant={swap.status === "approved" ? "success" : swap.status === "rejected" ? "danger" : swap.status === "cancelled" ? "neutral" : "warning"}>
                          {swap.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-900">{swap.requesterEmployee?.name}</span> ({swap.requesterShift?.name || "Shift"})
                        {" ⇄ "}
                        <span className="font-medium text-slate-900">{swap.targetEmployee?.name}</span> ({swap.targetShift?.name || "Shift"})
                      </p>
                      <p className="mt-1 text-xs text-slate-500 italic">“{swap.reason}”</p>
                      {swap.reviewComment && <p className="text-xs text-slate-400">Admin comment: {swap.reviewComment}</p>}
                    </div>

                    <div className="flex gap-2">
                      {isPending && isAdminOrSubadmin && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => reviewSwap(swap.id, "approved")}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => reviewSwap(swap.id, "rejected")}>
                            <XCircle className="mr-1 h-3.5 w-3.5 text-rose-600" />
                            Reject
                          </Button>
                        </>
                      )}
                      {isPending && (
                        <Button size="sm" variant="outline" onClick={() => setSwapToCancel(swap.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">No shift swap requests found.</p>
          )}
        </section>
      )}

      <Modal isOpen={swapping} onClose={() => setSwapping(false)} title="Request Shift Swap" description="Request to swap your scheduled shift on a specific date with a colleague.">
        <form onSubmit={submitSwap} className="space-y-4">
          <label className="block text-xs font-medium text-slate-700">
            Swap with coworker
            <CustomSelect required searchable value={swapForm.targetEmployeeId} onChange={(e) => setSwapForm({ ...swapForm, targetEmployeeId: e.target.value })} placeholder="Search colleagues" options={employees.map((p) => ({ value: p.id, label: p.name, sublabel: p.employeeNumber }))} />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Date to swap
            <input
              type="date"
              required
              value={swapForm.shiftDate}
              onChange={(e) => setSwapForm({ ...swapForm, shiftDate: e.target.value })}
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-700">
            Reason for swap
            <textarea
              required
              minLength={3}
              rows={3}
              value={swapForm.reason}
              onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
              placeholder="e.g. Personal emergency, doctor appointment"
            />
          </label>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="secondary" onClick={() => setSwapping(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit Request"}</Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={Boolean(swapToCancel)} onClose={() => setSwapToCancel(null)} onConfirm={() => swapToCancel && void cancelSwap(swapToCancel)} title="Cancel shift swap?" description="This will cancel the pending shift swap request." confirmLabel="Cancel request" />
      <ConfirmDialog isOpen={Boolean(shiftToDelete)} onClose={() => setShiftToDelete(null)} onConfirm={() => { if (!shiftToDelete) return; void api.deleteWorkforceShift(shiftToDelete.id).then(async () => { toast.success("Shift deleted"); setShiftToDelete(null); await load(); }).catch((error) => { toast.error(error instanceof Error ? error.message : "Could not delete shift"); setShiftToDelete(null); }); }} title="Delete shift?" description={shiftToDelete ? `Delete “${shiftToDelete.name}”? Shifts already assigned to employees are protected.` : ""} confirmLabel="Delete shift" />
    </div>
  );
}
