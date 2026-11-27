import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Plus, Handshake } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Badge } from "../../components/common/Badge.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { DataTable } from "../../components/common/DataTable.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

export function CommitmentListPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>(() => searchParams.get("status") || "");
  const [fromDate, setFromDate] = useState(() => searchParams.get("fromDate") || "");
  const [toDate, setToDate] = useState(() => searchParams.get("toDate") || "");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["commitments", { status, fromDate, toDate, page, pageSize }],
    queryFn: () =>
      api.listCommitments({
        status: (status as any) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: pageSize,
      }),
  });

  const commitments = data?.data ?? [];
  const meta = data?.meta;
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasFilters = Boolean(status || fromDate || toDate);
  const statusVariant = (value: string) => value === "fulfilled" ? "success" : value === "missed" ? "danger" : value === "partially_fulfilled" ? "warning" : value === "cancelled" ? "neutral" : "info";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commitments (Promise-to-Pay)"
        description="Debtor payment promises, fulfillment tracking, and default alerts"
        action={
          <div className="flex items-center gap-2">
            <FilterButton count={[status, fromDate, toDate].filter(Boolean).length} onClick={() => setFilterOpen(true)} />
            <Link to="/commitments/new"><Button><Plus className="h-4 w-4" /><span>Record Commitment</span></Button></Link>
          </div>
        }
      />
      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setStatus(""); setFromDate(""); setToDate(""); setPage(1); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CustomSelect label="Commitment status" className="sm:col-span-2" portal value={status} placeholder="All statuses" onChange={(e: any) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "upcoming", label: "Upcoming" }, { value: "fulfilled", label: "Fulfilled" }, { value: "partially_fulfilled", label: "Partially fulfilled" }, { value: "missed", label: "Missed (defaulted)" }, { value: "cancelled", label: "Cancelled" }]} />
          <label className="text-xs text-slate-600">Promise date from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Promise date to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>
      </FilterDialog>

      {isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : !isLoading && commitments.length === 0 && !hasFilters ? (
        <EmptyState
          icon={Handshake}
          title="No commitments found"
          description="Log formal payment commitments received from customers during collection calls or field visits."
          action={
            <Link to="/commitments/new">
              <Button size="sm">Record Commitment</Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          rows={commitments}
          rowKey={(c: any) => c.id}
          isLoading={isLoading}
          isFetching={isFetching}
          onRowClick={(c: any) => navigate(`/commitments/${c.id}`)}
          rowLabel={(c: any) => `Open commitment from ${c.customer?.displayName || "customer"}`}
          empty={<p className="px-4 py-10 text-center text-sm text-slate-500">No commitments match your filters.</p>}
          pagination={{
            page,
            pageSize,
            total: meta?.total ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
          }}
          columns={[
            {
              key: "customer",
              header: "Customer",
              cell: (c: any) => (
                <div className="min-w-0">
                  <p className="max-w-[13rem] truncate font-semibold text-slate-900">{c.customer?.displayName || "Customer"}</p>
                  <p className="mt-0.5 max-w-[13rem] truncate text-[11px] text-slate-500">By {c.responsiblePerson || "—"}</p>
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    <Badge variant={statusVariant(c.status)} className="px-1.5! py-0! text-[10px]!">{c.status.replace(/_/g, " ")}</Badge>
                    {c.status === "upcoming" && c.promisedDate < todayStr && <Badge variant="overdue" className="px-1.5! py-0! text-[10px]!">Expired</Badge>}
                  </div>
                </div>
              ),
            },
            {
              key: "date",
              header: "Promise date",
              className: "whitespace-nowrap",
              cell: (c: any) => <span className={c.status === "upcoming" && c.promisedDate < todayStr ? "font-semibold text-rose-700" : c.status === "upcoming" ? "font-medium text-indigo-700" : ""}>{c.promisedDate}</span>,
            },
            {
              key: "status",
              header: "Status",
              className: "hidden sm:table-cell",
              cell: (c: any) => (
                <div className="flex flex-wrap gap-1">
                  <Badge variant={statusVariant(c.status)}>{c.status.replace(/_/g, " ")}</Badge>
                  {c.status === "upcoming" && c.promisedDate < todayStr && <Badge variant="overdue">Expired</Badge>}
                </div>
              ),
            },
            { key: "invoices", header: "Invoices", align: "center", className: "hidden lg:table-cell", cell: (c: any) => c.invoices?.length ?? 0 },
            { key: "fulfilled", header: "Fulfilled", align: "right", className: "hidden whitespace-nowrap md:table-cell", cell: (c: any) => <span className="text-emerald-700">{formatMoney(c.fulfilledAmountMinor)}</span> },
            { key: "promised", header: "Promised", align: "right", className: "whitespace-nowrap", cell: (c: any) => <span className="font-semibold text-slate-900">{formatMoney(c.promisedAmountMinor)}</span> },
          ]}
        />
      )}
    </div>
  );
}
