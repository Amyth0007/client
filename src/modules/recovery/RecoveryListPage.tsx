import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { Plus, Target } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Badge } from "../../components/common/Badge.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { DataTable } from "../../components/common/DataTable.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { QueryError } from "../../components/common/QueryError.js";
import { useAuth } from "../auth/AuthContext.js";
import { FilterButton, FilterDialog } from "../../components/common/FilterDialog.js";

const RECOVERY_STATUS_OPTIONS = [
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "visit_scheduled", label: "Visit scheduled" },
  { value: "visit_completed", label: "Visit completed" },
  { value: "payment_committed", label: "Payment committed" },
  { value: "partially_recovered", label: "Partially recovered" },
  { value: "fully_recovered", label: "Fully recovered" },
  { value: "escalated", label: "Escalated" },
  { value: "closed", label: "Closed" },
];

export function RecoveryListPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const navigate = useNavigate();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ["recovery-assignments", { status, priority, fromDate, toDate, page, pageSize }],
    queryFn: () =>
      api.listRecoveryAssignments({
        status: (status as any) || undefined,
        priority: (priority as any) || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: pageSize,
      }),
  });

  const assignments = data?.data ?? [];
  const meta = data?.meta;
  const isFieldUser = user?.role === "field_recovery" || user?.role === "employee";
  const hasFilters = Boolean(status || priority || fromDate || toDate);
  const todayStr = new Date().toISOString().slice(0, 10);

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
          <CustomSelect label="Assignment status" portal value={status} placeholder="All statuses" onChange={(e: any) => { setStatus(e.target.value); setPage(1); }} options={RECOVERY_STATUS_OPTIONS} />
          <CustomSelect label="Priority" portal value={priority} placeholder="All priorities" onChange={(e: any) => { setPriority(e.target.value); setPage(1); }} options={[{ value: "high", label: "High priority" }, { value: "medium", label: "Medium priority" }, { value: "low", label: "Low priority" }]} />
          <label className="text-xs text-slate-600">Assigned from<input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs text-slate-600">Assigned to<input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>
      </FilterDialog>

      {isError ? (
        <QueryError message={error instanceof Error ? error.message : undefined} onRetry={() => void refetch()} />
      ) : !isLoading && assignments.length === 0 && !hasFilters ? (
        <EmptyState
          icon={Target}
          title="No recovery assignments"
          description="Assign overdue invoices to field recovery executives to schedule visits and collect promises."
          action={isFieldUser ? undefined : (
            <Link to="/recovery/new">
              <Button size="sm">New Assignment</Button>
            </Link>
          )}
        />
      ) : (
        <DataTable
          rows={assignments}
          rowKey={(item: any) => item.id}
          isLoading={isLoading}
          isFetching={isFetching}
          onRowClick={(item: any) => navigate(`/recovery/${item.id}`)}
          rowLabel={(item: any) => `Open recovery assignment for ${item.customer?.displayName || "customer"}`}
          empty={<p className="px-4 py-10 text-center text-sm text-slate-500">No assignments match your filters.</p>}
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
              cell: (item: any) => (
                <div className="min-w-0">
                  <p className="max-w-[13rem] truncate font-semibold text-slate-900">{item.customer?.displayName || "Customer"}</p>
                  <p className="mt-0.5 max-w-[13rem] truncate text-[11px] text-slate-500 md:hidden">{item.assignee?.name || "Unassigned"}</p>
                  <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                    <Badge variant="info" className="px-1.5! py-0! text-[10px]!">{item.status.replace(/_/g, " ")}</Badge>
                    {item.priority === "high" && <Badge variant="danger" className="px-1.5! py-0! text-[10px]!">high</Badge>}
                  </div>
                </div>
              ),
            },
            { key: "assignee", header: "Assignee", className: "hidden md:table-cell", cell: (item: any) => <span className="block max-w-[10rem] truncate">{item.assignee?.name || "Unassigned"}</span> },
            { key: "priority", header: "Priority", className: "hidden sm:table-cell", cell: (item: any) => <Badge variant={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "neutral"}>{item.priority}</Badge> },
            { key: "status", header: "Status", className: "hidden sm:table-cell", cell: (item: any) => <Badge variant="info">{item.status.replace(/_/g, " ")}</Badge> },
            { key: "assignedOn", header: "Assigned", className: "hidden whitespace-nowrap lg:table-cell", cell: (item: any) => item.assignedOn },
            { key: "deadline", header: "Deadline", className: "whitespace-nowrap", cell: (item: any) => <span className={item.visitDeadline && item.visitDeadline < todayStr && !["fully_recovered", "closed"].includes(item.status) ? "font-semibold text-rose-700" : ""}>{item.visitDeadline || "—"}</span> },
            { key: "invoices", header: "Invoices", align: "center", className: "hidden lg:table-cell", cell: (item: any) => item.invoices?.length ?? 0 },
            { key: "target", header: "Target", align: "right", className: "whitespace-nowrap", cell: (item: any) => <span className="font-semibold text-slate-900">{formatMoney(item.outstandingSnapshotMinor)}</span> },
          ]}
        />
      )}
    </div>
  );
}
