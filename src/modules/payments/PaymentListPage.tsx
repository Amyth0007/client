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
              className="block rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {p.paymentReference}
                    </span>
                    <Badge variant={p.kind === "collection" ? "success" : "danger"}>
                      {p.kind}
                    </Badge>
                    {p.reversedAt && <Badge variant="warning">Reversed</Badge>}
                  </div>

                  <p className="text-xs font-medium text-slate-700 mt-1">
                    {p.customer?.displayName || "Customer"}
                  </p>

                  <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-slate-500">
                    <span>Date: {p.paymentDate}</span>
                    <span className="capitalize">Mode: {p.mode.replace("_", " ")}</span>
                    {p.transactionReference && <span>Txn: {p.transactionReference}</span>}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-right">
                  <span
                    className={`text-base font-bold ${
                      p.kind === "collection" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {p.kind === "collection" ? "+" : "-"}
                    {formatMoney(p.amountMinor)}
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5">
                    {p.allocations?.length ?? 0} invoice(s) allocated
                  </span>
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
