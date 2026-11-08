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
          <div className="relative min-w-60 flex-1">
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
              className="block rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{c.displayName}</h3>
                    <Badge variant={c.status === "active" ? "success" : "neutral"}>
                      {c.status}
                    </Badge>
                  </div>
                  {c.companyName && (
                    <p className="text-xs text-slate-600 mt-0.5">{c.companyName}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                    {c.gstin && <span>GSTIN: {c.gstin}</span>}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 text-right">
                  <span className="text-xs text-slate-500">Credit Term</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {c.defaultCreditDays} Days
                  </span>
                  {c.creditLimitMinor && (
                    <span className="text-xs text-slate-500">
                      Limit: {formatMoney(c.creditLimitMinor)}
                    </span>
                  )}
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
