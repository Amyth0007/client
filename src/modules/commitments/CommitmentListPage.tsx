import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { Plus, Handshake } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Badge } from "../../components/common/Badge.js";
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["commitments", { status, fromDate, toDate, page }],
    queryFn: () =>
      api.listCommitments({
        status: (status as any) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: 15,
      }),
  });

  const commitments = data?.data ?? [];
  const meta = data?.meta;
  const todayStr = new Date().toISOString().slice(0, 10);

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
          <label className="text-xs text-slate-600">Commitment status<select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="partially_fulfilled">Partially Fulfilled</option>
            <option value="missed">Missed (Defaulted)</option>
            <option value="cancelled">Cancelled</option>
          </select></label>
          <label className="text-xs text-slate-600">Promise date from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Promise date to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>
      </FilterDialog>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : commitments.length === 0 ? (
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
        <div className="space-y-3">
          {commitments.map((c: any) => {
            const isDueSoon = c.status === "upcoming" && c.promisedDate >= todayStr;
            const isLate = c.status === "upcoming" && c.promisedDate < todayStr;

            return (
              <Link
                key={c.id}
                to={`/commitments/${c.id}`}
                className="block rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {c.customer?.displayName || "Customer"}
                      </span>
                      <Badge
                        variant={
                          c.status === "fulfilled"
                            ? "success"
                            : c.status === "missed"
                            ? "danger"
                            : c.status === "partially_fulfilled"
                            ? "warning"
                            : "info"
                        }
                      >
                        {c.status.replace("_", " ")}
                      </Badge>
                      {isLate && <Badge variant="overdue">Promise Expired</Badge>}
                    </div>

                    <p className="text-xs text-slate-600 mt-1">
                      Promised by:{" "}
                      <span className="font-semibold text-slate-700">
                        {c.responsiblePerson}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                      <span
                        className={
                          isLate
                            ? "text-rose-600 font-semibold"
                            : isDueSoon
                            ? "text-indigo-600 font-medium"
                            : ""
                        }
                      >
                        Promised Date: {c.promisedDate}
                      </span>
                      <span>{c.invoices?.length ?? 0} invoice(s)</span>
                      {c.delayReason && <span>Reason: {c.delayReason}</span>}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-right">
                    <span className="text-xs text-slate-500">Promised Amount</span>
                    <span className="text-base font-bold text-indigo-600">
                      {formatMoney(c.promisedAmountMinor)}
                    </span>
                    {c.fulfilledAmountMinor > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">
                        Fulfilled: {formatMoney(c.fulfilledAmountMinor)}
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
