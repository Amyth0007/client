import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Link } from "react-router";
import { AlertTriangle, CalendarClock, FileText, IndianRupee, TrendingUp, Download } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { StatCard } from "../../components/common/StatCard.js";
import { Button } from "../../components/common/Button.js";
import { FilterDialog } from "../../components/common/FilterDialog.js";

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

export function DashboardPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => api.getDashboardMetrics(),
  });

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

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm font-medium text-slate-700">Receivables at a glance</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setFilterOpen(true)}>
          <Download className="h-4 w-4" strokeWidth={2.5} /><span>Invoice report</span>
        </Button>
      </div>

      <section aria-label="Receivables overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard to="/invoices?outstandingOnly=true" title="Outstanding" value={isLoading ? "…" : formatMoney(metrics?.totalOutstandingMinor)} subtitle="Open invoice balances" icon={IndianRupee} variant="primary" />
        <StatCard to="/invoices?overdueOnly=true" title="Overdue" value={isLoading ? "…" : formatMoney(metrics?.totalOverdueMinor)} subtitle="Past due date" icon={AlertTriangle} variant="danger" />
        <StatCard to="/payments" title="Collected" value={isLoading ? "…" : formatMoney(metrics?.totalReceivedMinor)} subtitle="Payments received" icon={TrendingUp} variant="success" />
        <StatCard to="/invoices?dueTodayOnly=true" title="Due today" value={isLoading ? "…" : formatMoney(metrics?.dueTodayMinor)} subtitle="Invoices due today" icon={CalendarClock} variant="warning" />
      </section>

      <nav aria-label="More receivables shortcuts" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
        <span className="text-slate-700">Review:</span>
        <Link to="/invoices?paymentStatus=partial" className="text-indigo-800 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-950">
          {isLoading ? "…" : metrics?.partiallyPaidCount ?? 0} partially paid
        </Link>
        <Link to="/recovery" className="text-indigo-800 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-950">
          {isLoading ? "…" : metrics?.openRecoveryTasks ?? 0} active recovery
        </Link>
        <Link to="/commitments" className="text-indigo-800 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-950">
          {isLoading ? "…" : metrics?.commitmentsDue ?? 0} commitments due
        </Link>
        <Link to="/invoices" className="ml-auto inline-flex items-center gap-1 text-slate-800 underline underline-offset-2 hover:text-slate-950">
          <FileText className="h-4 w-4" strokeWidth={2.5} />All invoices
        </Link>
      </nav>

      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setDateFrom(""); setDateTo(""); }}>
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-800">Choose an invoice date range for the downloadable PDF.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">From<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900" /></label>
            <label className="text-sm font-medium text-slate-700">To<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-900" /></label>
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <Button size="sm" isLoading={isDownloading} onClick={() => void downloadReport()}><Download className="h-4 w-4" strokeWidth={2.5} />Download PDF</Button>
          </div>
        </div>
      </FilterDialog>
    </div>
  );
}
