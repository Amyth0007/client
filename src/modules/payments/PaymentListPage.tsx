import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Plus, CreditCard } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Badge } from "../../components/common/Badge.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

export function PaymentListPage() {
  const [kind, setKind] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payments", { kind, fromDate, toDate, page }],
    queryFn: () =>
      api.listPayments({
        kind: (kind as any) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: 15,
      }),
  });

  const payments = data?.data ?? [];
  const meta = data?.meta;

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
          <label className="text-xs text-slate-600">Transaction type<select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Transactions</option>
            <option value="collection">Collections (Receipts)</option>
            <option value="reversal">Reversals</option>
          </select></label>
          <label className="text-xs text-slate-600">Payment date from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Payment date to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
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
      ) : payments.length === 0 ? (
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
        <div className="space-y-3">
          {payments.map((p: any) => (
            <Link
              key={p.id}
              to={`/payments/${p.id}`}
              className="block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition-all hover:border-indigo-300 hover:shadow-sm sm:p-4"
            >
              <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-sm font-bold text-slate-950">
                      {p.paymentReference}
                    </span>
                    <Badge variant={p.kind === "collection" ? "success" : "danger"}>
                      {p.kind}
                    </Badge>
                    {p.reversedAt && <Badge variant="warning">Reversed</Badge>}
                  </div>

                  <p className="mt-2 break-words text-sm font-semibold text-slate-800">
                    {p.customer?.displayName || "Customer"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-4">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Payment date</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{p.paymentDate}</p></div>
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Method</p><p className="mt-1 break-words text-sm font-semibold capitalize text-slate-900">{p.mode.replace("_", " ")}</p></div>
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</p><p className={`mt-1 break-words text-sm font-bold ${p.kind === "collection" ? "text-emerald-700" : "text-rose-700"}`}>{p.kind === "collection" ? "+" : "-"}{formatMoney(p.amountMinor)}</p></div>
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Invoices allocated</p><p className="mt-1 text-sm font-semibold text-slate-900">{p.allocations?.length ?? 0}</p></div>
                    {p.transactionReference && <div className="min-w-0 sm:col-span-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Transaction reference</p><p className="mt-1 break-all text-sm font-medium text-slate-800">{p.transactionReference}</p></div>}
                  </div>
              </div>
            </Link>
          ))}

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
