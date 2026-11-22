import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Download, FileText } from "lucide-react";
import { api } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { useAuth } from "../auth/AuthContext.js";
import { userCanAccessModule } from "../platform/module-registry.js";

type ReportKind = "attendance" | "payroll" | "overtime" | "leave";
const reportLabels: Record<ReportKind, string> = { attendance: "Attendance", payroll: "Payroll", overtime: "Overtime", leave: "Leave" };

function csvValue(value: unknown) { let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }

export function WorkforceReportsPage() {
  const { user } = useAuth();
  const startDefault = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDefault = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(startDefault); const [to, setTo] = useState(endDefault); const [kind, setKind] = useState<ReportKind>("attendance"); const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(false);
  const admin = user?.role === "org_admin";
  const grants = user?.actionPermissions ?? [];
  const can = useMemo(() => ({
    attendance: userCanAccessModule(user?.role, user?.organization?.modules, user?.modulePermissions, "attendance", user?.modulePermissionsConfigured ?? false, grants) && (admin || grants.includes("attendance.view_all")),
    payroll: userCanAccessModule(user?.role, user?.organization?.modules, user?.modulePermissions, "payroll", user?.modulePermissionsConfigured ?? false, grants) && (admin || grants.includes("payroll.view_earnings")),
    overtime: userCanAccessModule(user?.role, user?.organization?.modules, user?.modulePermissions, "overtime", user?.modulePermissionsConfigured ?? false, grants) && (admin || grants.includes("overtime.view")),
    leave: userCanAccessModule(user?.role, user?.organization?.modules, user?.modulePermissions, "leave", user?.modulePermissionsConfigured ?? false, grants) && (admin || grants.includes("leave.view")),
  }), [user, admin, grants]);
  const available = (Object.keys(reportLabels) as ReportKind[]).filter((item) => can[item]);
  useEffect(() => { if (available.length && !can[kind]) setKind(available[0]); }, [available.join(","), kind]);
  const load = async () => { if (!can[kind]) return; setLoading(true); try { setData(await api.getWorkforceReport(kind, from, to)); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load report"); setData(null); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [kind, from, to, can[kind]]);
  const rows = kind === "payroll" ? data ?? [] : kind === "overtime" || kind === "leave" ? data?.byStatus ?? [] : data ? [{ ...data.attendance, adjustmentCounts: data.adjustments, approvedLeave: data.approvedLeave }] : [];
  const download = () => { if (!rows.length) return; const headers: string[] = [...new Set<string>(rows.flatMap((row: any) => Object.keys(row)))]; const content = [headers.map(csvValue).join(","), ...rows.map((row: any) => headers.map((header) => csvValue(row[header])).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `workforce-${kind}-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(url); };
  return <div className="space-y-6"><div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-5 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Workforce insights</p><h1 className="mt-1 text-2xl font-bold">Reports</h1><p className="mt-1 text-sm text-indigo-100">Review workforce activity and export the data available to your account.</p></div>
  {!available.length ? <div className="rounded-2xl border border-indigo-100 bg-white p-10 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50"><FileText className="h-6 w-6 text-indigo-500" /></span><p className="mt-3 font-semibold text-slate-900">No workforce reports assigned</p><p className="mt-1 text-sm text-slate-500">Ask your administrator to grant report and module access.</p></div> : <><div className="flex flex-wrap items-end gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-4 shadow-sm"><CustomSelect label="Report" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)} options={available.map((item) => ({ value: item, label: reportLabels[item] }))} /><label className="text-xs font-semibold text-slate-700">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></label><label className="text-xs font-semibold text-slate-700">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" /></label><Button variant="secondary" onClick={download} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm font-semibold text-indigo-950">{reportLabels[kind]} <span className="font-normal text-indigo-700">· {from} to {to}</span></h2>{loading ? <p className="p-8 text-center text-sm text-slate-500">Loading report…</p> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{Object.keys(rows[0]).map((key) => <th key={key} className="px-4 py-3">{key.replaceAll(/([A-Z])/g, " $1")}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row: any, index: number) => <tr key={row.periodKey ?? row._id ?? index} className="transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-indigo-50/60">{Object.keys(rows[0]).map((key) => <td key={key} className="px-4 py-3 align-top text-slate-700">{typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-slate-500">No results for this period.</p>}</section></>}</div>;
}
