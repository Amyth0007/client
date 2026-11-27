import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Plus, CreditCard } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Badge } from "../../components/common/Badge.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { DataTable } from "../../components/common/DataTable.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

export function PaymentListPage() {
  const [kind, setKind] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["payments", { kind, fromDate, toDate, page, pageSize }],
    queryFn: () =>
      api.listPayments({
        kind: (kind as any) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: pageSize,
      }),
  });

  const payments = data?.data ?? [];
  const meta = data?.meta;
  const hasFilters = Boolean(kind || fromDate || toDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Recorded collections, invoice allocations, and reversed receipts"
        action={
          <div className="flex items-center gap-2">
            <FilterButton count={[kind, fromDate, toDate].filter(Boolean).length} onClick={() => setFilterOpen(true)} />
            <Link to="/payments/new"><Button><Plus className="h-4 w-4" /><span>Record Payment</span></Button></Link>
          </div>
        }
      />
      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setKind(""); setFromDate(""); setToDate(""); setPage(1); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CustomSelect label="Transaction type" className="sm:col-span-2" portal value={kind} placeholder="All transactions" onChange={(e: any) => { setKind(e.target.value); setPage(1); }} options={[{ value: "collection", label: "Collections (receipts)" }, { value: "reversal", label: "Reversals" }]} />
          <label className="text-xs text-slate-600">Payment date from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Payment date to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>
      </FilterDialog>

      {isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : !isLoading && payments.length === 0 && !hasFilters ? (
        <EmptyState
          icon={CreditCard}
          title="No payments recorded"
          description="Post received payments and allocate them across open customer invoices."
          action={
            <Link to="/payments/new">
              <Button size="sm">Record Payment</Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          rows={payments}
          rowKey={(p: any) => p.id}
          isLoading={isLoading}
          isFetching={isFetching}
          onRowClick={(p: any) => navigate(`/payments/${p.id}`)}
          rowLabel={(p: any) => `Open payment ${p.paymentReference}`}
          empty={<p className="px-4 py-10 text-center text-sm text-slate-500">No payments match your filters.</p>}
          pagination={{
            page,
            pageSize,
            total: meta?.total ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          }}
          columns={[
            {
              key: "reference",
              header: "Reference",
              cell: (p: any) => (
                <div className="min-w-0">
                  <p className="max-w-[12rem] truncate font-semibold text-slate-900">{p.paymentReference}</p>
                  <p className="mt-0.5 max-w-[12rem] truncate text-[11px] text-slate-500 sm:hidden">{p.customer?.displayName || "Customer"}</p>
                  {p.transactionReference && <p className="hidden max-w-[12rem] truncate text-[11px] text-slate-500 lg:block">Txn: {p.transactionReference}</p>}
                  {p.reversedAt && <Badge variant="warning" className="mt-1 px-1.5! py-0! text-[10px]! sm:hidden">Reversed</Badge>}
                </div>
              ),
            },
            { key: "customer", header: "Customer", className: "hidden sm:table-cell", cell: (p: any) => <span className="block max-w-[14rem] truncate font-medium text-slate-800">{p.customer?.displayName || "Customer"}</span> },
            { key: "date", header: "Date", className: "whitespace-nowrap", cell: (p: any) => p.paymentDate },
            { key: "mode", header: "Method", className: "hidden capitalize md:table-cell", cell: (p: any) => (p.mode ?? "").replace(/_/g, " ") },
            { key: "allocations", header: "Invoices", align: "center", className: "hidden lg:table-cell", cell: (p: any) => p.allocations?.length ?? 0 },
            {
              key: "type",
              header: "Type",
              className: "hidden sm:table-cell",
              cell: (p: any) => (
                <div className="flex flex-wrap gap-1">
                  <Badge variant={p.kind === "collection" ? "success" : "danger"}>{p.kind}</Badge>
                  {p.reversedAt && <Badge variant="warning">Reversed</Badge>}
                </div>
              ),
            },
            { key: "amount", header: "Amount", align: "right", className: "whitespace-nowrap", cell: (p: any) => <span className={`font-semibold ${p.kind === "collection" ? "text-emerald-700" : "text-rose-700"}`}>{p.kind === "collection" ? "+" : "-"}{formatMoney(p.amountMinor)}</span> },
          ]}
        />
      )}
    </div>
  );
}
