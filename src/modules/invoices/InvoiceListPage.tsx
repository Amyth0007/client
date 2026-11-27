import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Plus, Search, FileText, Clock3, CircleDollarSign } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { DataTable } from "../../components/common/DataTable.js";
import { Badge } from "../../components/common/Badge.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
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
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["invoices", { search, status, acknowledgementStatus, paymentStatus, customerId, overdueOnly, dueTodayOnly, outstandingOnly, sort, dateFrom, dateTo, page, pageSize }],
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
        limit: pageSize,
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
        api.listInvoices({ page: "1", limit: "1", outstandingOnly: "true" }),
        api.listInvoices({ page: "1", limit: "1", overdueOnly: "true" }),
      ]);
      return { all: all.meta?.total ?? 0, drafts: drafts.meta?.total ?? 0, open: open.meta?.total ?? 0, overdue: overdue.meta?.total ?? 0 };
    },
  });

  const quickFilters = [
    { id: "all", label: "All", count: overview?.all, icon: FileText, iconClass: "text-slate-500", countClass: "bg-slate-100 text-slate-700" },
    { id: "draft", label: "Drafts", count: overview?.drafts, icon: FileText, iconClass: "text-amber-500", countClass: "bg-amber-50 text-amber-700" },
    { id: "open", label: "Open balances", count: overview?.open, icon: CircleDollarSign, iconClass: "text-emerald-600", countClass: "bg-emerald-50 text-emerald-700" },
    { id: "overdue", label: "Overdue", count: overview?.overdue, icon: Clock3, iconClass: "text-rose-500", countClass: "bg-rose-50 text-rose-700" },
  ] as const;
  const onlyStatusFilters = !search && !acknowledgementStatus && !paymentStatus && !customerId && !dueTodayOnly && !dateFrom && !dateTo;
  const activeQuickFilter = !onlyStatusFilters ? null
    : overdueOnly && !status && !outstandingOnly ? "overdue"
    : outstandingOnly && !status && !overdueOnly ? "open"
    : status === "draft" && !overdueOnly && !outstandingOnly ? "draft"
    : !status && !overdueOnly && !outstandingOnly ? "all"
    : null;
  const applyQuickFilter = (id: string) => {
    setStatus(id === "draft" ? "draft" : "");
    setOverdueOnly(id === "overdue");
    setOutstandingOnly(id === "open");
    setDueTodayOnly(false);
    setPaymentStatus("");
    setAcknowledgementStatus("");
    setCustomerId("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setPage(1);
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isInvoiceOverdue = (inv: any) => inv.documentStatus === "issued" && inv.outstandingMinor > 0 && inv.dueDate < todayStr;
  const hasFilters = Boolean(search || status || acknowledgementStatus || paymentStatus || customerId || overdueOnly || dueTodayOnly || outstandingOnly || dateFrom || dateTo);

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

      {/* Compact quick filters with counts */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 no-scrollbar">
        {quickFilters.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => applyQuickFilter(chip.id)}
              aria-pressed={activeQuickFilter === chip.id}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${activeQuickFilter === chip.id ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}
            >
              <Icon className={`h-3.5 w-3.5 ${activeQuickFilter === chip.id ? "text-white" : chip.iconClass}`} />
              <span>{chip.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${activeQuickFilter === chip.id ? "bg-white/20 text-white" : chip.countClass}`}>{chip.count ?? "—"}</span>
            </button>
          );
        })}
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
          <CustomSelect label="Customer" portal searchable value={customerId} placeholder="All customers" onChange={(e: any) => { setCustomerId(e.target.value); setPage(1); }} options={(customerOptions ?? []).map((customer: any) => ({ value: customer.id, label: customer.displayName }))} />
          <CustomSelect label="Invoice status" portal value={status} placeholder="All statuses" onChange={(e: any) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "draft", label: "Draft" }, { value: "issued", label: "Issued" }, { value: "cancelled", label: "Cancelled" }]} />
          <CustomSelect label="Payment status" portal value={paymentStatus} placeholder="All payment states" onChange={(e: any) => { setPaymentStatus(e.target.value); setPage(1); }} options={[{ value: "unpaid", label: "Unpaid" }, { value: "partial", label: "Partially paid" }, { value: "paid", label: "Paid" }]} />
          <CustomSelect label="Customer response" portal value={acknowledgementStatus} placeholder="All responses" onChange={(e: any) => { setAcknowledgementStatus(e.target.value); setPage(1); }} options={[{ value: "not_shared", label: "Not shared" }, { value: "shared", label: "Awaiting response" }, { value: "acknowledged", label: "Acknowledged" }, { value: "rejected", label: "Rejected" }, { value: "disputed", label: "Disputed" }]} />
          <CustomSelect label="Sort by" className="sm:col-span-2" portal required value={sort} onChange={(e: any) => { setSort(e.target.value); setPage(1); }} options={[{ value: "-createdAt", label: "Recently added" }, { value: "dueDate", label: "Due date (earliest)" }, { value: "-dueDate", label: "Due date (latest)" }, { value: "-amountMinor", label: "Largest balance" }, { value: "invoiceDate", label: "Oldest invoice" }]} />
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }} />Show overdue invoices only</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={dueTodayOnly} onChange={(e) => { setDueTodayOnly(e.target.checked); setPage(1); }} />Due today only</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input type="checkbox" checked={outstandingOnly} onChange={(e) => { setOutstandingOnly(e.target.checked); setPage(1); }} />Open balances only</label>
        </div>
      </FilterDialog>

      {/* Invoice table */}
      {isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : !isLoading && invoices.length === 0 && !hasFilters ? (
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
        <DataTable
          rows={invoices}
          rowKey={(inv: any) => inv.id}
          isLoading={isLoading}
          isFetching={isFetching}
          onRowClick={(inv: any) => navigate(`/invoices/${inv.id}`)}
          rowLabel={(inv: any) => `Open invoice ${inv.invoiceNumber}`}
          empty={<p className="px-4 py-10 text-center text-sm text-slate-500">No invoices match your search or filters.</p>}
          pagination={{
            page,
            pageSize,
            total: meta?.total ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          }}
          columns={[
            {
              key: "invoice",
              header: "Invoice",
              cell: (inv: any) => (
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{inv.invoiceNumber}</p>
                  <p className="mt-0.5 max-w-[11rem] truncate text-[11px] text-slate-500 sm:hidden">{inv.customer?.displayName || "Unknown customer"}</p>
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    <Badge variant={inv.documentStatus} className="px-1.5! py-0! text-[10px]!">{inv.documentStatus}</Badge>
                    {isInvoiceOverdue(inv) && <Badge variant="overdue" className="px-1.5! py-0! text-[10px]!">Overdue</Badge>}
                  </div>
                </div>
              ),
            },
            {
              key: "customer",
              header: "Customer",
              className: "hidden sm:table-cell",
              cell: (inv: any) => <span className="block max-w-[14rem] truncate font-medium text-slate-800">{inv.customer?.displayName || "Unknown customer"}</span>,
            },
            {
              key: "invoiceDate",
              header: "Invoice date",
              className: "hidden whitespace-nowrap lg:table-cell",
              cell: (inv: any) => inv.invoiceDate,
            },
            {
              key: "dueDate",
              header: "Due date",
              className: "whitespace-nowrap",
              cell: (inv: any) => <span className={isInvoiceOverdue(inv) ? "font-semibold text-rose-700" : ""}>{inv.dueDate}</span>,
            },
            {
              key: "amount",
              header: "Total",
              align: "right",
              className: "hidden whitespace-nowrap md:table-cell",
              cell: (inv: any) => formatMoney(inv.amountMinor),
            },
            {
              key: "balance",
              header: "Balance",
              align: "right",
              className: "whitespace-nowrap",
              cell: (inv: any) => inv.outstandingMinor === 0
                ? <span className="font-semibold text-emerald-700">Paid</span>
                : <div><p className="font-semibold text-slate-900">{formatMoney(inv.outstandingMinor)}</p>{inv.outstandingMinor < inv.amountMinor && <p className="text-[10px] font-semibold text-amber-700">Partially paid</p>}</div>,
            },
            {
              key: "status",
              header: "Status",
              className: "hidden sm:table-cell",
              cell: (inv: any) => (
                <div className="flex flex-wrap gap-1">
                  <Badge variant={inv.documentStatus}>{inv.documentStatus}</Badge>
                  {isInvoiceOverdue(inv) && <Badge variant="overdue">Overdue</Badge>}
                  {inv.acknowledgementStatus && inv.acknowledgementStatus !== "not_shared" && <Badge variant="info" className="hidden xl:inline-flex">{inv.acknowledgementStatus.replace(/_/g, " ")}</Badge>}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
