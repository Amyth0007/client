import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { Plus, Search, FileText, Clock3, CircleDollarSign } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { StatCard } from "../../components/common/StatCard.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

export function InvoiceListPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(() => searchParams.get("documentStatus") || "");
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("overdueOnly") === "true");
  const [dueTodayOnly, setDueTodayOnly] = useState(() => searchParams.get("dueTodayOnly") === "true");
  const [outstandingOnly, setOutstandingOnly] = useState(() => searchParams.get("outstandingOnly") === "true");
  const [acknowledgementStatus, setAcknowledgementStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(() => searchParams.get("paymentStatus") || "");
  const [customerId, setCustomerId] = useState(() => searchParams.get("customerId") || "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["invoices", { search, status, acknowledgementStatus, paymentStatus, customerId, overdueOnly, dueTodayOnly, outstandingOnly, sort, dateFrom, dateTo, page }],
    queryFn: () =>
      api.listInvoices({
        search: search || undefined,
        documentStatus: status || undefined,
        acknowledgementStatus: acknowledgementStatus || undefined,
        paymentStatus: paymentStatus || undefined,
        customerId: customerId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        overdueOnly: overdueOnly ? "true" : undefined,
        dueTodayOnly: dueTodayOnly ? "true" : undefined,
        outstandingOnly: outstandingOnly ? "true" : undefined,
        sort,
        page,
        limit: 15,
      }),
  });

  const invoices = data?.data ?? [];
  const meta = data?.meta;

  const { data: customerOptions } = useQuery({ queryKey: ["invoice-customer-options"], queryFn: async () => {
    const customers: any[] = [];
    let page = 1;
    let total = 0;
    do {
      const result = await api.listCustomers({ page, limit: 100 });
      customers.push(...result.data);
      total = result.meta?.total ?? customers.length;
      page += 1;
    } while (customers.length < total);
    return customers;
  } });

  const { data: overview } = useQuery({
    queryKey: ["invoice-overview"],
    queryFn: async () => {
      const [all, drafts, open, overdue] = await Promise.all([
        api.listInvoices({ page: "1", limit: "1" }),
        api.listInvoices({ page: "1", limit: "1", documentStatus: "draft" }),
        api.listInvoices({ page: "1", limit: "1", documentStatus: "issued" }),
        api.listInvoices({ page: "1", limit: "1", overdueOnly: "true" }),
      ]);
      return { all: all.meta?.total ?? 0, drafts: drafts.meta?.total ?? 0, open: open.meta?.total ?? 0, overdue: overdue.meta?.total ?? 0 };
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Draft, issue, and monitor receivables, aging, and dispute statuses"
        action={
          <Link to="/invoices/new">
            <Button>
              <Plus className="h-4 w-4" />
              <span>Create Invoice</span>
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="All invoices" value={overview?.all ?? "—"} subtitle="Across every status" icon={FileText} variant="neutral" />
        <StatCard title="Drafts" value={overview?.drafts ?? "—"} subtitle="Ready to review and issue" icon={FileText} />
        <StatCard title="Open balances" value={overview?.open ?? "—"} subtitle="Issued invoices" icon={CircleDollarSign} variant="success" />
        <StatCard title="Overdue" value={overview?.overdue ?? "—"} subtitle="Needs follow-up" icon={Clock3} variant="danger" />
      </div>

      <Card contentClassName="p-2!">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search invoice or customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full pl-9 pr-4 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

      <FilterButton count={[status, acknowledgementStatus, paymentStatus, customerId, overdueOnly, dueTodayOnly, outstandingOnly, dateFrom, dateTo, sort !== "-createdAt"].filter(Boolean).length} onClick={() => setFilterOpen(true)} />
        </div>
      </Card>
      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setDateFrom(""); setDateTo(""); setStatus(""); setAcknowledgementStatus(""); setPaymentStatus(""); setCustomerId(""); setOverdueOnly(false); setDueTodayOnly(false); setOutstandingOnly(false); setSort("-createdAt"); setPage(1); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs text-slate-600">Invoice date from<input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Invoice date to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Customer<select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All customers</option>{customerOptions?.map((customer: any) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}</select></label>
          <label className="text-xs text-slate-600">Invoice status<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All statuses</option><option value="draft">Draft</option><option value="issued">Issued</option><option value="cancelled">Cancelled</option></select></label>
          <label className="text-xs text-slate-600">Payment status<select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All payment states</option><option value="unpaid">Unpaid</option><option value="partial">Partially paid</option><option value="paid">Paid</option></select></label>
          <label className="text-xs text-slate-600">Customer response<select value={acknowledgementStatus} onChange={(e) => { setAcknowledgementStatus(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All responses</option><option value="not_shared">Not shared</option><option value="shared">Awaiting response</option><option value="acknowledged">Acknowledged</option><option value="rejected">Rejected</option><option value="disputed">Disputed</option></select></label>
          <label className="text-xs text-slate-600 sm:col-span-2">Sort by<select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="-createdAt">Recently added</option><option value="dueDate">Due date (earliest)</option><option value="-dueDate">Due date (latest)</option><option value="-amountMinor">Largest balance</option><option value="invoiceDate">Oldest invoice</option></select></label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }} />Show overdue invoices only</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={dueTodayOnly} onChange={(e) => { setDueTodayOnly(e.target.checked); setPage(1); }} />Due today only</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={outstandingOnly} onChange={(e) => { setOutstandingOnly(e.target.checked); setPage(1); }} />Open balances only</label>
        </div>
      </FilterDialog>

      {/* Invoice List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices found"
          description="Create your first invoice draft to begin tracking receivable ledger entries."
          action={
            <Link to="/invoices/new">
              <Button size="sm">Create Invoice</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => {
            const isOverdue =
              inv.documentStatus === "issued" &&
              inv.outstandingMinor > 0 &&
              inv.dueDate < todayStr;

            return (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="block rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {inv.invoiceNumber}
                      </span>
                      <Badge variant={inv.documentStatus}>{inv.documentStatus}</Badge>
                      {isOverdue && <Badge variant="overdue">Overdue</Badge>}
                      {inv.acknowledgementStatus !== "not_shared" && (
                        <Badge variant="info">
                          {inv.acknowledgementStatus.replace("_", " ")}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs font-medium text-slate-700 mt-1">
                      {inv.customer?.displayName || "Unknown Customer"}
                    </p>

                    <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                      <span>Invoice Date: {inv.invoiceDate}</span>
                      <span className={isOverdue ? "text-rose-600 font-medium" : ""}>
                        Due: {inv.dueDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-right">
                    <span className="text-xs text-slate-500">
                      Amount: {formatMoney(inv.amountMinor)}
                    </span>
                    <span
                      className={`text-base font-bold ${
                        inv.outstandingMinor > 0 ? "text-slate-900" : "text-emerald-600"
                      }`}
                    >
                      {inv.outstandingMinor === 0 ? "PAID" : formatMoney(inv.outstandingMinor)}
                    </span>
                    {inv.outstandingMinor > 0 && inv.outstandingMinor < inv.amountMinor && (
                      <span className="text-xs text-amber-600 font-semibold">
                        Partial Balance
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Pagination */}
          {meta && meta.total > meta.limit && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-600">
                Page {meta.page} of {Math.ceil(meta.total / meta.limit)} ({meta.total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= Math.ceil(meta.total / meta.limit)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
