import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Plus, Target } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Badge } from "../../components/common/Badge.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { useAuth } from "../auth/AuthContext.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

export function RecoveryListPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["recovery-assignments", { status, priority, fromDate, toDate, page }],
    queryFn: () =>
      api.listRecoveryAssignments({
        status: (status as any) || undefined,
        priority: (priority as any) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: 15,
      }),
  });

  const assignments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user?.role === "field_recovery" || user?.role === "employee" ? "My Assigned Visits" : "Recovery Assignments"}
        description={user?.role === "field_recovery" || user?.role === "employee" ? "View your assigned cases and record visit outcomes." : "Field visits, recovery tracking, supervisor assignments, and debtor visits"}
        action={<div className="flex items-center gap-2">
          <FilterButton count={[status, priority, fromDate, toDate].filter(Boolean).length} onClick={() => setFilterOpen(true)} />
          {user?.role !== "field_recovery" && user?.role !== "employee" && <Link to="/recovery/new"><Button><Plus className="h-4 w-4" /><span>New Assignment</span></Button></Link>}
        </div>}
      />
      <FilterDialog isOpen={filterOpen} onClose={() => setFilterOpen(false)} onClear={() => { setStatus(""); setPriority(""); setFromDate(""); setToDate(""); setPage(1); }}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs text-slate-600">Assignment status<select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="visit_scheduled">Visit Scheduled</option>
            <option value="visit_completed">Visit Completed</option>
            <option value="payment_committed">Payment Committed</option>
            <option value="partially_recovered">Partially Recovered</option>
            <option value="fully_recovered">Fully Recovered</option>
            <option value="escalated">Escalated</option>
            <option value="closed">Closed</option>
          </select></label>

          <label className="text-xs text-slate-600">Priority<select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select></label>
          <label className="text-xs text-slate-600">Assigned from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Assigned to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
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
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No recovery assignments"
          description="Assign overdue invoices to field recovery executives to schedule visits and collect promises."
          action={
            <Link to="/recovery/new">
              <Button size="sm">New Assignment</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((item: any) => (
            <Link
              key={item.id}
              to={`/recovery/${item.id}`}
              className="block min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition-all hover:border-indigo-300 hover:shadow-sm sm:p-4"
            >
              <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-sm font-bold text-slate-950">
                      {item.customer?.displayName || "Customer"}
                    </span>
                    <Badge variant={item.priority === "high" ? "danger" : "neutral"}>
                      {item.priority}
                    </Badge>
                    <Badge variant="info">{item.status.replace("_", " ")}</Badge>
                  </div>

                  <p className="text-xs text-slate-600 mt-1">
                    Assignee:{" "}
                    <span className="font-semibold text-slate-700">
                      {item.assignee?.name || "Unassigned"}
                    </span>
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-4">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assigned</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.assignedOn}</p></div>
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Visit deadline</p><p className="mt-1 break-words text-sm font-semibold text-rose-700">{item.visitDeadline}</p></div>
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Invoices</p><p className="mt-1 text-sm font-semibold text-slate-900">{item.invoices?.length ?? 0}</p></div>
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Target balance</p><p className="mt-1 break-words text-sm font-bold text-slate-950">{formatMoney(item.outstandingSnapshotMinor)}</p></div>
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
