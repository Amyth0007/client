import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Plus, Search, Users, Phone, Mail } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

export function CustomerListPage() {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["customers", { search, fromDate, toDate, page }],
    queryFn: () => api.listCustomers({ search: search || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, page, limit: 15 }),
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage debtors, credit limits, contacts, and account profiles"
        action={
          <Link to="/customers/new">
            <Button>
              <Plus className="h-4 w-4" />
              <span>Add Customer</span>
            </Button>
          </Link>
        }
      />

      {/* Filter / Search Bar */}
      <Card contentClassName="p-2!">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, company, email, or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-9 w-full pl-9 pr-4 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
          <FilterButton count={[fromDate, toDate].filter(Boolean).length} onClick={() => setFilterOpen(true)} />
        </div>
      </Card>
      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setFromDate(""); setToDate(""); setPage(1); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs text-slate-600">Added from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Added to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>
      </FilterDialog>

      {/* Customers List / Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description={
            search
              ? "No customers match your search query."
              : "Add your first B2B debtor to track credit terms and invoices."
          }
          action={
            <Link to="/customers/new">
              <Button size="sm">Add Customer</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {/* Card-based list: Works beautifully on mobile and desktop */}
          {customers.map((c: any) => (
            <Link
              key={c.id}
              to={`/customers/${c.id}`}
              className="block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition-all hover:border-indigo-300 hover:shadow-sm sm:p-4"
            >
              <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="min-w-0 break-words text-sm font-bold text-slate-950">{c.displayName}</h3>
                    <Badge variant={c.status === "active" ? "success" : "neutral"}>
                      {c.status}
                    </Badge>
                  </div>
                  {c.companyName && (
                    <p className="mt-0.5 break-words text-xs font-medium text-slate-700">{c.companyName}</p>
                  )}
                  <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-xs text-slate-700 sm:grid-cols-2">
                    {c.phone && (
                      <span className="flex min-w-0 items-start gap-2">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                        <span className="break-all">{c.phone}</span>
                      </span>
                    )}
                    {c.email && (
                      <span className="flex min-w-0 items-start gap-2">
                        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                        <span className="break-all">{c.email}</span>
                      </span>
                    )}
                    {c.gstin && <span className="min-w-0 break-all font-medium text-slate-600 sm:col-span-2">GSTIN: {c.gstin}</span>}
                  </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Credit term</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{c.defaultCreditDays} days</p>
                  </div>
                  {c.creditLimitMinor != null && <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Credit limit</p>
                    <p className="mt-1 break-words text-sm font-bold text-slate-900">{formatMoney(c.creditLimitMinor)}</p>
                  </div>}
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
