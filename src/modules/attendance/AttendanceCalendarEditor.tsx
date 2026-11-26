import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { CalendarDays, CheckCircle2, Search, UserRound, Users, XCircle } from "lucide-react";
import { api, type AttendancePolicy, type AttendanceRecord } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { Input } from "../../components/common/Input.js";
import { Pagination, usePagination } from "../../components/common/Pagination.js";
import { zonedDateTimeToIso } from "./time-zone.js";

type AttendanceEmployee = { id: string; name: string; email: string; employeeNumber?: string; profileId?: string | null; hasLogin?: boolean };
type DayStatus = "present" | "half_day" | "absent" | "leave" | "checked_in" | "missing" | "day_off" | "future";
type AdjustStatus = "present" | "half_day" | "absent" | "leave";
type PeriodPreset = "this_month" | "last_month" | "custom";

const STATUS_STYLE: Record<DayStatus, { label: string; cell: string; dot: string }> = {
  present: { label: "Present", cell: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  half_day: { label: "Half day", cell: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  absent: { label: "Absent", cell: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  leave: { label: "Leave", cell: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500" },
  checked_in: { label: "Checked in (no check-out)", cell: "bg-teal-50 text-teal-800 border-teal-200", dot: "bg-teal-500" },
  missing: { label: "No record", cell: "bg-white text-slate-700 border-dashed border-slate-300", dot: "bg-slate-300" },
  day_off: { label: "Weekly off", cell: "bg-slate-100 text-slate-400 border-slate-100", dot: "bg-slate-400" },
  future: { label: "Upcoming", cell: "bg-white text-slate-300 border-slate-100", dot: "bg-slate-200" },
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthRange(today: string, offset: number) {
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 + offset, 1));
  const end = new Date(Date.UTC(year, month + offset, 0));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: iso(start), to: offset === 0 && iso(end) > today ? today : iso(end) };
}

function recordStatus(record: AttendanceRecord): DayStatus {
  if (record.status === "completed") return record.halfDay ? "half_day" : "present";
  return record.status;
}

function timeIn(value: string | null | undefined, timeZone: string) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { timeZone, hour: "2-digit", minute: "2-digit" });
}

export function AttendanceCalendarEditor({ policy, timeZone, today, organizationId }: { policy?: AttendancePolicy; timeZone: string; today: string; organizationId?: string | null }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [customFrom, setCustomFrom] = useState(monthRange(today, 0).from);
  const [customTo, setCustomTo] = useState(today);
  const [selected, setSelected] = useState<string[]>([]);
  const [checkInTime, setCheckInTime] = useState(policy?.expectedCheckIn ?? "09:00");
  const [checkOutTime, setCheckOutTime] = useState(policy?.expectedCheckOut ?? "17:00");
  const [reason, setReason] = useState("Attendance corrected by admin");

  const period = preset === "custom" ? { from: customFrom, to: customTo > today ? today : customTo } : monthRange(today, preset === "this_month" ? 0 : -1);
  const periodValid = Boolean(period.from && period.to && period.from <= period.to);

  const { data: employeesResult, isLoading: employeesLoading } = useQuery({
    queryKey: ["attendance-employees", organizationId],
    queryFn: () => api.listAttendanceEmployees(),
  });
  const employees: AttendanceEmployee[] = employeesResult?.data ?? [];
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? employees.filter((employee) => [employee.name, employee.email, employee.employeeNumber].some((value) => value?.toLowerCase().includes(term))) : employees;
  }, [employees, search]);
  const employeePages = usePagination(filteredEmployees, 10);
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? null;

  const { data: records = [], isFetching: recordsLoading } = useQuery({
    queryKey: ["attendance-records", "calendar", employeeId, period.from, period.to],
    enabled: Boolean(employeeId) && periodValid,
    queryFn: async () => {
      const all: AttendanceRecord[] = [];
      for (let page = 1; page <= 20; page += 1) {
        const result: any = await api.listAttendanceRecords({ employeeId, from: period.from, to: period.to, page, limit: 100 });
        all.push(...result.data);
        if (!result.data.length || all.length >= (result.meta?.total ?? all.length)) break;
      }
      return all;
    },
  });

  const recordByDate = useMemo(() => new Map(records.map((record) => [record.attendanceDate, record])), [records]);
  const weeklyHolidays = policy?.weeklyHolidays ?? [0];

  const days = useMemo(() => {
    if (!periodValid) return [];
    const result: Array<{ date: string; status: DayStatus; record?: AttendanceRecord }> = [];
    const cursor = new Date(`${period.from}T12:00:00Z`);
    const last = new Date(`${period.to}T12:00:00Z`);
    while (cursor <= last && result.length < 370) {
      const date = cursor.toISOString().slice(0, 10);
      const record = recordByDate.get(date);
      const status: DayStatus = date > today ? "future" : record ? recordStatus(record) : weeklyHolidays.includes(cursor.getUTCDay()) ? "day_off" : "missing";
      result.push({ date, status, record });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }, [period.from, period.to, periodValid, recordByDate, today, weeklyHolidays]);

  const months = useMemo(() => {
    const groups = new Map<string, typeof days>();
    for (const day of days) groups.set(day.date.slice(0, 7), [...(groups.get(day.date.slice(0, 7)) ?? []), day]);
    return [...groups.entries()].map(([key, items]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        key,
        label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }),
        offset: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
        totalDays: new Date(Date.UTC(year, month, 0)).getUTCDate(),
        byDay: new Map(items.map((item) => [Number(item.date.slice(8, 10)), item])),
      };
    });
  }, [days]);

  const counts = useMemo(() => days.reduce<Record<string, number>>((acc, day) => ({ ...acc, [day.status]: (acc[day.status] ?? 0) + 1 }), {}), [days]);
  const focusDay = selected.length === 1 ? days.find((day) => day.date === selected[0]) : undefined;

  const toggleDay = (date: string) => setSelected((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort());
  const selectWhere = (statuses: DayStatus[]) => setSelected(days.filter((day) => statuses.includes(day.status)).map((day) => day.date));

  const applyMutation = useMutation({
    mutationFn: async (status: AdjustStatus) => {
      if (!employeeId) throw new Error("Select an employee first.");
      if (!selected.length) throw new Error("Select one or more days on the calendar.");
      if (reason.trim().length < 3) throw new Error("Enter a reason for the audit log.");
      const now = Date.now();
      let saved = 0;
      const failures: string[] = [];
      for (const date of selected) {
        try {
          let times: { checkInAt?: string; checkOutAt?: string } = {};
          if (status === "present" || status === "half_day") {
            const checkInAt = zonedDateTimeToIso(`${date}T${checkInTime || "09:00"}`, timeZone);
            const checkOutAt = checkOutTime ? zonedDateTimeToIso(`${date}T${checkOutTime}`, timeZone) : undefined;
            if (new Date(checkInAt).getTime() > now) throw new Error("check-in time is in the future");
            times = { checkInAt, ...(checkOutAt && new Date(checkOutAt).getTime() <= now && checkOutAt > checkInAt ? { checkOutAt } : {}) };
          }
          await api.adjustAttendance({ employeeId, attendanceDate: date, status, ...times, reason: reason.trim() });
          saved += 1;
        } catch (error) {
          failures.push(`${date}: ${error instanceof Error ? error.message : "failed"}`);
        }
      }
      return { saved, failures, status };
    },
    onSuccess: async ({ saved, failures, status }) => {
      if (saved) toast.success(`${saved} day${saved === 1 ? "" : "s"} marked ${STATUS_STYLE[status].label.toLowerCase()}`);
      if (failures.length) toast.error(`Could not update ${failures.length} day${failures.length === 1 ? "" : "s"} — ${failures.slice(0, 2).join("; ")}`);
      setSelected([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance-records"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-dashboard"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const presetButton = (value: PeriodPreset, label: string) => (
    <button type="button" onClick={() => { setPreset(value); setSelected([]); }} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${preset === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{label}</button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Employee picker */}
      <Card title="Employees" subtitle={`${employees.length} active employee${employees.length === 1 ? "" : "s"}`} contentClassName="p-3">
        <label className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); employeePages.setPage(1); }} placeholder="Search name, ID or email" className="w-full border-0 bg-transparent text-sm outline-none" />
        </label>
        {employeesLoading ? <p className="py-6 text-center text-sm text-slate-500">Loading employees…</p> : filteredEmployees.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No employees found.</p> : (
          <ul className="space-y-1">
            {employeePages.pageItems.map((employee) => (
              <li key={employee.id}>
                <button type="button" onClick={() => { setEmployeeId(employee.id); setSelected([]); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${employee.id === employeeId ? "bg-indigo-600 text-white" : "hover:bg-slate-50"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${employee.id === employeeId ? "bg-white/20" : "bg-indigo-50 text-indigo-700"}`}>{employee.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{employee.name}</span>
                    <span className={`block truncate text-[11px] ${employee.id === employeeId ? "text-indigo-100" : "text-slate-500"}`}>{[employee.employeeNumber, employee.email].filter(Boolean).join(" · ") || (employee.hasLogin ? "App login" : "No app login")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={employeePages.page} pageSize={employeePages.pageSize} total={employeePages.total} onPageChange={employeePages.setPage} className="mt-3" />
      </Card>

      {/* Calendar */}
      <Card
        title={selectedEmployee ? `Attendance · ${selectedEmployee.name}` : "Attendance calendar"}
        subtitle="Select an employee and period, tap days on the calendar, then mark them present, absent, half day or leave. Every change is audit-logged."
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Time period</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-1">{presetButton("this_month", "This month")}{presetButton("last_month", "Last month")}{presetButton("custom", "Custom")}</div>
          </div>
          {preset === "custom" && (
            <>
              <div className="w-40"><Input label="From" type="date" value={customFrom} max={today} onChange={(event) => { setCustomFrom(event.target.value); setSelected([]); }} /></div>
              <div className="w-40"><Input label="To" type="date" value={customTo} max={today} onChange={(event) => { setCustomTo(event.target.value); setSelected([]); }} /></div>
            </>
          )}
          <span className="ml-auto text-xs text-slate-500"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{periodValid ? `${period.from} → ${period.to}` : "Choose a valid date range"}</span>
        </div>

        {!selectedEmployee ? (
          <EmptyState icon={Users} title="Select an employee" description="Choose an employee from the list to view and correct their attendance on a calendar." />
        ) : !periodValid ? (
          <EmptyState icon={CalendarDays} title="Invalid period" description="The start date must be on or before the end date." />
        ) : (
          <div className="mt-4 space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              {(["present", "half_day", "absent", "leave", "checked_in", "missing", "day_off"] as DayStatus[]).map((status) => (
                <span key={status} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${STATUS_STYLE[status].cell}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLE[status].dot}`} />{STATUS_STYLE[status].label}: {counts[status] ?? 0}
                </span>
              ))}
              {recordsLoading && <span className="self-center text-slate-500">Refreshing…</span>}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Quick select:</span>
              <button type="button" className="rounded-md border border-slate-200 px-2 py-1 font-medium hover:bg-slate-50" onClick={() => selectWhere(["missing"])}>Days with no record</button>
              <button type="button" className="rounded-md border border-slate-200 px-2 py-1 font-medium hover:bg-slate-50" onClick={() => selectWhere(["missing", "absent", "present", "half_day", "leave", "checked_in"])}>All working days</button>
              {selected.length > 0 && <button type="button" className="rounded-md px-2 py-1 font-medium text-rose-700 hover:bg-rose-50" onClick={() => setSelected([])}>Clear selection ({selected.length})</button>}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {months.map((month) => (
                <section key={month.key} className="rounded-xl border border-slate-200 p-3">
                  <h4 className="mb-2 text-sm font-semibold text-slate-900">{month.label}</h4>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-slate-400">{WEEKDAY_LABELS.map((label) => <span key={label} className="py-1">{label}</span>)}</div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: month.offset }, (_, index) => <span key={`blank-${index}`} />)}
                    {Array.from({ length: month.totalDays }, (_, index) => {
                      const dayNumber = index + 1;
                      const day = month.byDay.get(dayNumber);
                      if (!day) return <span key={dayNumber} className="flex aspect-square items-center justify-center rounded-lg text-xs text-slate-200">{dayNumber}</span>;
                      const isSelected = selected.includes(day.date);
                      const disabled = day.status === "future";
                      return (
                        <button
                          key={day.date}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleDay(day.date)}
                          aria-pressed={isSelected}
                          aria-label={`${day.date} ${STATUS_STYLE[day.status].label}`}
                          title={`${day.date} · ${STATUS_STYLE[day.status].label}`}
                          className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-semibold transition disabled:cursor-not-allowed ${STATUS_STYLE[day.status].cell} ${isSelected ? "ring-2 ring-indigo-600 ring-offset-1" : "hover:ring-2 hover:ring-indigo-300"}`}
                        >
                          {dayNumber}
                          {day.record?.manualAdjustment && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-indigo-600" title="Manually adjusted" />}
                          {isSelected && <CheckCircle2 className="absolute bottom-0.5 h-3 w-3 text-indigo-700" />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <p className="text-[11px] text-slate-500"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-600 align-middle" />Manually adjusted day. Weekly offs can also be marked if the employee worked.</p>

            {/* Selected day detail */}
            {focusDay && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-slate-900">{new Date(`${focusDay.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</h4>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[focusDay.status].cell}`}>{STATUS_STYLE[focusDay.status].label}</span>
                </div>
                {focusDay.record ? (
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div><dt className="text-slate-500">Check-in</dt><dd className="font-semibold text-slate-900">{timeIn(focusDay.record.checkIn?.at, timeZone)}</dd></div>
                    <div><dt className="text-slate-500">Check-out</dt><dd className="font-semibold text-slate-900">{timeIn(focusDay.record.checkOut?.at ?? focusDay.record.correctedCheckOutAt, timeZone)}</dd></div>
                    <div><dt className="text-slate-500">Worked</dt><dd className="font-semibold text-slate-900">{focusDay.record.totalWorkingMinutes != null ? `${Math.floor(focusDay.record.totalWorkingMinutes / 60)}h ${focusDay.record.totalWorkingMinutes % 60}m` : "—"}</dd></div>
                    <div><dt className="text-slate-500">Late</dt><dd className="font-semibold text-slate-900">{focusDay.record.lateArrival ? "Yes" : "No"}</dd></div>
                    {focusDay.record.manualAdjustment && <div className="col-span-full"><dt className="text-slate-500">Last adjustment reason</dt><dd className="text-slate-800">{focusDay.record.manualAdjustment.reason}</dd></div>}
                  </dl>
                ) : <p className="mt-2 text-xs text-slate-500">No attendance was recorded for this day.</p>}
              </section>
            )}

            {/* Action bar */}
            <section className={`rounded-xl border p-4 transition ${selected.length ? "border-indigo-200 bg-indigo-50/60" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{selected.length ? `Mark ${selected.length} selected day${selected.length === 1 ? "" : "s"} as` : "Select days on the calendar to correct them"}</h4>
                {selected.length > 0 && <span className="truncate text-[11px] text-slate-500">{selected.length <= 4 ? selected.join(", ") : `${selected[0]} … ${selected[selected.length - 1]}`}</span>}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Input label="Check-in time (present / half day)" type="time" value={checkInTime} onChange={(event) => setCheckInTime(event.target.value)} />
                <Input label="Check-out time (optional)" type="time" value={checkOutTime} onChange={(event) => setCheckOutTime(event.target.value)} />
                <Input label="Reason (audit log)" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Biometric failure verified by manager" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={!selected.length} isLoading={applyMutation.isPending && applyMutation.variables === "present"} onClick={() => applyMutation.mutate("present")}><CheckCircle2 className="mr-1.5 h-4 w-4" />Present</Button>
                <Button size="sm" variant="danger" disabled={!selected.length} isLoading={applyMutation.isPending && applyMutation.variables === "absent"} onClick={() => applyMutation.mutate("absent")}><XCircle className="mr-1.5 h-4 w-4" />Absent</Button>
                <Button size="sm" variant="outline" disabled={!selected.length} isLoading={applyMutation.isPending && applyMutation.variables === "half_day"} onClick={() => applyMutation.mutate("half_day")}>Half day</Button>
                <Button size="sm" variant="outline" disabled={!selected.length} isLoading={applyMutation.isPending && applyMutation.variables === "leave"} onClick={() => applyMutation.mutate("leave")}><UserRound className="mr-1.5 h-4 w-4" />Leave</Button>
              </div>
            </section>
          </div>
        )}
      </Card>
    </div>
  );
}
