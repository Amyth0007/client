import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Link } from "react-router";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign, CreditCard, Download, FileText, Handshake, IndianRupee, Plus, Target, TrendingUp, XCircle } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { FilterDialog } from "../../components/common/FilterDialog.js";
import { useAuth } from "../auth/AuthContext.js";
import { canUserAccessModule, type OrganizationModuleKey } from "../platform/module-registry.js";

async function fetchInvoiceRange(dateFrom: string, dateTo: string) {
  const rows: any[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await api.listInvoices({ page, limit: 100, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, sort: "-invoiceDate" });
    rows.push(...result.data);
    total = result.meta?.total ?? rows.length;
    page += 1;
  } while (rows.length < total);
  return rows;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", { month: "short" });
const SERIES = { invoiced: "#6366f1", collected: "#059669" } as const;

const AGING = [
  { key: "current", label: "Not yet due", color: "#94a3b8", to: "/invoices?outstandingOnly=true" },
  { key: "days1to30", label: "1–30 days", color: "#fbbf24", to: "/invoices?overdueOnly=true" },
  { key: "days31to60", label: "31–60 days", color: "#f97316", to: "/invoices?overdueOnly=true" },
  { key: "days61to90", label: "61–90 days", color: "#e11d48", to: "/invoices?overdueOnly=true" },
  { key: "days91Plus", label: "90+ days", color: "#9f1239", to: "/invoices?overdueOnly=true" },
] as const;

const PIPELINE = [
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "visit_scheduled", label: "Visit scheduled" },
  { key: "visit_completed", label: "Visit completed" },
  { key: "payment_committed", label: "Payment committed" },
  { key: "partially_recovered", label: "Partially recovered" },
  { key: "escalated", label: "Escalated" },
] as const;

function compactMoney(amountMinor: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format((amountMinor ?? 0) / 100);
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Six-month grouped bars: invoiced vs collected, with a per-month hover/focus tooltip and a table view. */
function TrendChart({ monthly }: { monthly: { month: string; invoicedMinor: number; collectedMinor: number; invoiceCount: number; paymentCount: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(1, ...monthly.flatMap((row) => [row.invoicedMinor, row.collectedMinor]));
  const label = (month: string) => MONTH_LABEL.format(new Date(`${month}-01T00:00:00`));
  const totals = monthly.reduce((sum, row) => ({ invoiced: sum.invoiced + row.invoicedMinor, collected: sum.collected + Math.max(0, row.collectedMinor) }), { invoiced: 0, collected: 0 });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.invoiced }} />Invoiced <strong className="text-slate-900">{compactMoney(totals.invoiced)}</strong></span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.collected }} />Collected <strong className="text-slate-900">{compactMoney(totals.collected)}</strong></span>
        </div>
        <button type="button" onClick={() => setAsTable((value) => !value)} className="text-xs font-medium text-indigo-700 hover:underline">{asTable ? "Show chart" : "View as table"}</button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500"><th className="py-2">Month</th><th className="py-2 text-right">Invoiced</th><th className="py-2 text-right">Collected</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{monthly.map((row) => <tr key={row.month}><td className="py-2 text-slate-700">{label(row.month)} {row.month.slice(0, 4)}</td><td className="py-2 text-right text-slate-900">{formatMoney(row.invoicedMinor)}</td><td className="py-2 text-right text-slate-900">{formatMoney(row.collectedMinor)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {/* recessive grid */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-slate-100" />)}
          </div>
          <div className="relative flex h-48 items-end gap-1 sm:h-56 sm:gap-3" role="img" aria-label="Invoiced versus collected over the last six months">
            {monthly.map((row, index) => (
              <button
                key={row.month}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${label(row.month)}: invoiced ${formatMoney(row.invoicedMinor)}, collected ${formatMoney(row.collectedMinor)}`}
                className={`relative flex h-full flex-1 flex-col justify-end rounded-lg pb-6 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 ${active === index ? "bg-slate-50" : ""}`}
              >
                <div className="flex h-full items-end justify-center gap-[2px] px-1">
                  <div className="w-full max-w-5 rounded-t-[4px] transition-[height] duration-500" style={{ height: `${(row.invoicedMinor / peak) * 100}%`, background: SERIES.invoiced, minHeight: row.invoicedMinor > 0 ? 2 : 0 }} />
                  <div className="w-full max-w-5 rounded-t-[4px] transition-[height] duration-500" style={{ height: `${(Math.max(0, row.collectedMinor) / peak) * 100}%`, background: SERIES.collected, minHeight: row.collectedMinor > 0 ? 2 : 0 }} />
                </div>
                <span className="absolute inset-x-0 bottom-0 text-center text-[11px] text-slate-500">{label(row.month)}</span>
                {active === index && (
                  <span role="tooltip" className={`pointer-events-none absolute bottom-full z-10 mb-1 w-40 rounded-lg ${index === 0 ? "left-0" : index === monthly.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"} bg-slate-900 px-3 py-2 text-left text-[11px] text-white shadow-lg`}>
                    <span className="block font-semibold">{label(row.month)} {row.month.slice(0, 4)}</span>
                    <span className="mt-1 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: SERIES.invoiced }} />Invoiced</span>{compactMoney(row.invoicedMinor)}</span>
                    <span className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: SERIES.collected }} />Collected</span>{compactMoney(row.collectedMinor)}</span>
                    <span className="mt-1 block text-slate-300">{row.invoiceCount} invoices · {row.paymentCount} payments</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { data: metrics, isLoading } = useQuery({ queryKey: ["dashboard-metrics"], queryFn: () => api.getDashboardMetrics() });
  const { data: overview } = useQuery({ queryKey: ["dashboard-overview"], queryFn: () => api.getOverviewInsights() });
  const { data: aging } = useQuery({ queryKey: ["dashboard-aging"], queryFn: () => api.getAgingBuckets() });
  const { data: debtors = [] } = useQuery({ queryKey: ["dashboard-debtors"], queryFn: () => api.getCustomerOutstanding() });

  const can = (moduleKey: OrganizationModuleKey) => canUserAccessModule(user, moduleKey);
  const canCreate = user?.role !== "employee";

  const downloadReport = async () => {
    setIsDownloading(true);
    try {
      const invoices = await fetchInvoiceRange(dateFrom, dateTo);
      if (!invoices.length) {
        toast.error("No invoices found for this date range");
        return;
      }
      const { downloadInvoiceReportPdf } = await import("../../services/pdf.js");
      downloadInvoiceReportPdf(invoices, dateFrom, dateTo);
      setFilterOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the invoice report");
    } finally {
      setIsDownloading(false);
    }
  };

  const outstanding = metrics?.totalOutstandingMinor ?? 0;
  const invoiced = metrics?.totalInvoicedMinor ?? 0;
  const recoveredShare = invoiced > 0 ? Math.min(1, Math.max(0, (invoiced - outstanding) / invoiced)) : 0;
  const overdueShare = outstanding > 0 ? (metrics?.totalOverdueMinor ?? 0) / outstanding : 0;
  const monthly = overview?.monthly ?? [];
  const thisMonth = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];
  const monthChange = thisMonth && lastMonth && lastMonth.collectedMinor > 0 ? (thisMonth.collectedMinor - lastMonth.collectedMinor) / lastMonth.collectedMinor : null;
  const agingTotal = aging ? AGING.reduce((sum, bucket) => sum + (aging[bucket.key]?.amountMinor ?? 0), 0) : 0;
  const topDebtors = (debtors as any[]).filter((debtor) => debtor.outstandingMinor > 0).slice(0, 5);
  const debtorPeak = Math.max(1, ...topDebtors.map((debtor) => debtor.outstandingMinor));
  const pipeline = PIPELINE.map((stage) => ({ ...stage, count: overview?.recoveryByStatus?.[stage.key] ?? 0 }));
  const pipelinePeak = Math.max(1, ...pipeline.map((stage) => stage.count));
  const pipelineOpen = pipeline.reduce((sum, stage) => sum + stage.count, 0);
  const missed = overview?.commitmentsByStatus?.missed?.count ?? metrics?.missedCommitments ?? 0;

  const attention = [
    { label: "Overdue balance", value: compactMoney(metrics?.totalOverdueMinor), hint: `${Math.round(overdueShare * 100)}% of outstanding`, to: "/invoices?overdueOnly=true", icon: AlertTriangle, tone: "text-rose-600 bg-rose-50", show: (metrics?.totalOverdueMinor ?? 0) > 0 },
    { label: "Due today", value: compactMoney(metrics?.dueTodayMinor), hint: "Follow up before end of day", to: "/invoices?dueTodayOnly=true", icon: CalendarClock, tone: "text-amber-600 bg-amber-50", show: (metrics?.dueTodayMinor ?? 0) > 0 },
    { label: "Promises due in 7 days", value: String(metrics?.commitmentsDue ?? 0), hint: "Check commitments", to: "/commitments?status=upcoming", icon: Handshake, tone: "text-indigo-600 bg-indigo-50", show: (metrics?.commitmentsDue ?? 0) > 0 },
    { label: "Missed promises", value: String(missed), hint: "Escalate or reschedule", to: "/commitments?status=missed", icon: XCircle, tone: "text-rose-600 bg-rose-50", show: missed > 0 },
    { label: "Draft invoices", value: String(overview?.draftInvoices ?? 0), hint: "Review and issue", to: "/invoices?documentStatus=draft", icon: FileText, tone: "text-slate-600 bg-slate-100", show: (overview?.draftInvoices ?? 0) > 0 },
    { label: "Partially paid", value: String(metrics?.partiallyPaidCount ?? 0), hint: "Chase the remaining balance", to: "/invoices?paymentStatus=partial", icon: CircleDollarSign, tone: "text-amber-600 bg-amber-50", show: (metrics?.partiallyPaidCount ?? 0) > 0 },
  ].filter((item) => item.show);

  const firstName = (user?.name ?? "").split(/\s+/)[0];
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-5">
      {/* Greeting + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{today}{user?.organization?.name ? ` · ${user.organization.name}` : ""}</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && can("invoices") && <Link to="/invoices/new"><Button size="sm" variant="outline"><Plus className="h-4 w-4" />Invoice</Button></Link>}
          {canCreate && can("payments") && <Link to="/payments/new"><Button size="sm" variant="outline"><CreditCard className="h-4 w-4" />Payment</Button></Link>}
          {canCreate && can("recovery") && user?.role !== "field_recovery" && <Link to="/recovery/new"><Button size="sm" variant="outline"><Target className="h-4 w-4" />Assign recovery</Button></Link>}
          <Button size="sm" onClick={() => setFilterOpen(true)}><Download className="h-4 w-4" />Report</Button>
        </div>
      </div>

      {/* Hero: outstanding + recovery progress */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 text-white shadow-md sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Total outstanding</p>
            <Link to="/invoices?outstandingOnly=true" className="mt-1 block text-3xl font-bold tracking-tight hover:underline sm:text-4xl" title={formatMoney(outstanding)}>{isLoading ? "…" : formatMoney(outstanding)}</Link>
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-xs text-indigo-100">
                <span>Recovered from issued invoices</span>
                <strong className="text-white">{Math.round(recoveredShare * 100)}%</strong>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-emerald-300 transition-[width] duration-700" style={{ width: `${recoveredShare * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-indigo-200">{compactMoney(invoiced - outstanding)} collected of {compactMoney(invoiced)} invoiced</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Overdue", value: compactMoney(metrics?.totalOverdueMinor), to: "/invoices?overdueOnly=true" },
              { label: "Due today", value: compactMoney(metrics?.dueTodayMinor), to: "/invoices?dueTodayOnly=true" },
              { label: "Next 7 days", value: compactMoney(metrics?.upcomingDue7DaysMinor), to: "/invoices?outstandingOnly=true" },
            ].map((item) => (
              <Link key={item.label} to={item.to} className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm transition hover:bg-white/20">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200">{item.label}</p>
                <p className="mt-0.5 truncate text-base font-bold sm:text-lg">{isLoading ? "…" : item.value}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* KPI tiles */}
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Collected this month", value: compactMoney(thisMonth?.collectedMinor), hint: monthChange == null ? "No payments last month" : `${monthChange >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(monthChange * 100))}% vs last month`, hintTone: monthChange == null ? "text-slate-500" : monthChange >= 0 ? "text-emerald-700" : "text-rose-700", icon: TrendingUp, tone: "text-emerald-600 bg-emerald-50", to: "/payments" },
          { label: "Collected all time", value: compactMoney(metrics?.totalReceivedMinor), hint: "Payments received", icon: IndianRupee, tone: "text-indigo-600 bg-indigo-50", to: "/payments" },
          { label: "Active recoveries", value: String(metrics?.openRecoveryTasks ?? 0), hint: "Open field assignments", icon: Target, tone: "text-violet-600 bg-violet-50", to: "/recovery" },
          { label: "Promises due (7d)", value: String(metrics?.commitmentsDue ?? 0), hint: `${missed} missed so far`, hintTone: missed > 0 ? "text-rose-700" : "text-slate-500", icon: Handshake, tone: "text-amber-600 bg-amber-50", to: "/commitments" },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.label} to={tile.to} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tile.tone}`}><Icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">{isLoading ? "…" : tile.value}</p>
              <p className={`mt-0.5 truncate text-[11px] ${tile.hintTone ?? "text-slate-500"}`}>{tile.hint}</p>
            </Link>
          );
        })}
      </section>

      {/* Trend + aging */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Invoiced vs collected" subtitle="Last 6 months" className="lg:col-span-2">
          {monthly.length ? <TrendChart monthly={monthly} /> : <div className="h-48 animate-pulse rounded-xl bg-slate-50" />}
        </Panel>
        <Panel title="Receivables aging" subtitle="Open balance by days past due">
          {!aging ? <div className="h-40 animate-pulse rounded-xl bg-slate-50" /> : agingTotal === 0 ? <p className="py-10 text-center text-sm text-slate-500">No open balances. 🎉</p> : (
            <div className="space-y-4">
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
                {AGING.map((bucket) => {
                  const amount = aging[bucket.key]?.amountMinor ?? 0;
                  return amount > 0 ? <div key={bucket.key} style={{ width: `${(amount / agingTotal) * 100}%`, background: bucket.color }} title={`${bucket.label}: ${formatMoney(amount)}`} /> : null;
                })}
              </div>
              <ul className="space-y-1">
                {AGING.map((bucket) => {
                  const amount = aging[bucket.key]?.amountMinor ?? 0;
                  const countValue = aging[bucket.key]?.count ?? 0;
                  return (
                    <li key={bucket.key}>
                      <Link to={bucket.to} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-slate-50">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: bucket.color }} />
                        <span className="flex-1 text-slate-700">{bucket.label}</span>
                        <span className="text-slate-400">{countValue} inv.</span>
                        <span className="w-20 text-right font-semibold text-slate-900" title={formatMoney(amount)}>{compactMoney(amount)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Attention + debtors + pipeline */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Needs attention" subtitle="What to act on today">
          {attention.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center"><CheckCircle2 className="h-8 w-8 text-emerald-500" /><p className="mt-2 text-sm font-medium text-slate-700">All caught up</p><p className="text-xs text-slate-500">Nothing urgent right now.</p></div>
          ) : (
            <ul className="space-y-1.5">
              {attention.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <Link to={item.to} className="group flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-indigo-200 hover:bg-indigo-50/40">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-800">{item.label}</span><span className="block truncate text-[11px] text-slate-500">{item.hint}</span></span>
                      <span className="text-sm font-bold text-slate-900">{item.value}</span>
                      <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Top debtors" subtitle="Highest open balances" action={<Link to="/customers" className="text-xs font-medium text-indigo-700 hover:underline">All</Link>}>
          {topDebtors.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No customers with open balances.</p> : (
            <ul className="space-y-3">
              {topDebtors.map((debtor) => (
                <li key={debtor.id}>
                  <Link to={`/customers/${debtor.id}`} className="block rounded-lg transition hover:opacity-80">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-800">{debtor.displayName}</span>
                      <span className="shrink-0 font-semibold text-slate-900" title={formatMoney(debtor.outstandingMinor)}>{compactMoney(debtor.outstandingMinor)}</span>
                    </div>
                    <div className="mt-1.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-l-full bg-rose-500" style={{ width: `${(debtor.overdueMinor / debtorPeak) * 100}%` }} title={`Overdue ${formatMoney(debtor.overdueMinor)}`} />
                      <div className="h-full rounded-r-full bg-indigo-400" style={{ width: `${((debtor.outstandingMinor - debtor.overdueMinor) / debtorPeak) * 100}%` }} title={`Not yet due ${formatMoney(debtor.outstandingMinor - debtor.overdueMinor)}`} />
                    </div>
                  </Link>
                </li>
              ))}
              <li className="flex gap-3 pt-1 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />Overdue</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-400" />Not yet due</span></li>
            </ul>
          )}
        </Panel>

        <Panel title="Recovery pipeline" subtitle={`${pipelineOpen} open assignments`} action={<Link to="/recovery" className="text-xs font-medium text-indigo-700 hover:underline">Open</Link>}>
          {pipelineOpen === 0 ? <p className="py-8 text-center text-sm text-slate-500">No open recovery assignments.</p> : (
            <ul className="space-y-2">
              {pipeline.map((stage) => (
                <li key={stage.key} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 truncate text-slate-600">{stage.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500 transition-[width] duration-500" style={{ width: `${(stage.count / pipelinePeak) * 100}%` }} /></div>
                  <span className="w-6 text-right font-semibold text-slate-900">{stage.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setDateFrom(""); setDateTo(""); }}>
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-800">Choose an invoice date range for the downloadable PDF.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">From<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900" /></label>
            <label className="text-sm font-medium text-slate-700">To<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900" /></label>
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <Button size="sm" isLoading={isDownloading} onClick={() => downloadReport()}><Download className="h-4 w-4" strokeWidth={2.5} />Download PDF</Button>
          </div>
        </div>
      </FilterDialog>
    </div>
  );
}
