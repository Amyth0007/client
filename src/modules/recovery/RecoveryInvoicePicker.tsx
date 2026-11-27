import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Check, Search, X } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { Pagination } from "../../components/common/Pagination.js";

type Period = "all" | "this_month" | "last_month" | "last_90" | "custom";

const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "All" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_90", label: "Last 90 days" },
  { id: "custom", label: "Custom" },
];

const SORT_OPTIONS = [
  { value: "dueDate", label: "Due date (oldest first)" },
  { value: "-dueDate", label: "Due date (newest first)" },
  { value: "-outstandingMinor", label: "Largest balance" },
  { value: "outstandingMinor", label: "Smallest balance" },
  { value: "-invoiceDate", label: "Invoice date (newest)" },
  { value: "invoiceDate", label: "Invoice date (oldest)" },
];

/** Local calendar date as YYYY-MM-DD (avoids UTC shifting the month boundary). */
function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function periodRange(period: Period, customFrom: string, customTo: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  if (period === "this_month") return { dateFrom: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: localDate(now) };
  if (period === "last_month") return { dateFrom: localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), dateTo: localDate(new Date(now.getFullYear(), now.getMonth(), 0)) };
  if (period === "last_90") return { dateFrom: localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)), dateTo: localDate(now) };
  if (period === "custom") return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
  return {};
}

type Props = {
  customerId: string;
  selected: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
};

/**
 * Server-side searchable, filterable, paginated invoice picker for recovery assignments.
 * Lists only issued invoices with a balance that are not already part of an open recovery assignment.
 * Selection is kept across pages and filter changes.
 */
export function RecoveryInvoicePicker({ customerId, selected, onChange }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sort, setSort] = useState("dueDate");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce typing so we don't query on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const range = periodRange(period, customFrom, customTo);
  const invalidRange = Boolean(range.dateFrom && range.dateTo && range.dateFrom > range.dateTo);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["recovery-invoice-picker", customerId, { search, ...range, overdueOnly, sort, page, pageSize }],
    queryFn: () => api.listInvoices({
      customerId,
      outstandingOnly: "true",
      excludeActiveRecovery: "true",
      search: search || undefined,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      overdueOnly: overdueOnly ? "true" : undefined,
      sort,
      page,
      limit: pageSize,
    }),
    enabled: Boolean(customerId) && !invalidRange,
    placeholderData: keepPreviousData,
  });

  const rows: any[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const todayStr = localDate(new Date());
  const pageAllSelected = rows.length > 0 && rows.every((inv) => selected[inv.id]);
  const filtersActive = Boolean(search || period !== "all" || overdueOnly);

  const toggle = (inv: any) => {
    const next = { ...selected };
    if (next[inv.id]) delete next[inv.id];
    else next[inv.id] = inv;
    onChange(next);
  };
  const togglePage = () => {
    const next = { ...selected };
    rows.forEach((inv) => { if (pageAllSelected) delete next[inv.id]; else next[inv.id] = inv; });
    onChange(next);
  };
  const resetFilters = () => { setSearchInput(""); setSearch(""); setPeriod("all"); setCustomFrom(""); setCustomTo(""); setOverdueOnly(false); setPage(1); };

  return (
    <div>
      {/* Filters */}
      <div className="space-y-3 border-b border-slate-100 p-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search invoice number…"
              aria-label="Search invoices"
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-8 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {searchInput && (
              <button type="button" onClick={() => setSearchInput("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <CustomSelect className="sm:w-56!" size="sm" portal required searchable={false} aria-label="Sort invoices" value={sort} options={SORT_OPTIONS} onChange={(event: any) => { setSort(event.target.value); setPage(1); }} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invoice date</span>
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setPeriod(item.id); setPage(1); }}
              aria-pressed={period === item.id}
              className={clsx(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                period === item.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {item.label}
            </button>
          ))}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={overdueOnly} onChange={(event) => { setOverdueOnly(event.target.checked); setPage(1); }} className="h-3.5 w-3.5 rounded text-indigo-600" />
            Overdue only
          </label>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-slate-600">From<input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => { setCustomFrom(event.target.value); setPage(1); }} className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" /></label>
            <label className="text-[11px] font-medium text-slate-600">To<input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => { setCustomTo(event.target.value); setPage(1); }} className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" /></label>
          </div>
        )}
      </div>

      {/* Results */}
      {invalidRange ? (
        <p className="px-5 py-8 text-center text-xs text-rose-600">The start date must be on or before the end date.</p>
      ) : isError ? (
        <p className="px-5 py-8 text-center text-xs text-rose-600">Invoices could not be loaded. Please try again.</p>
      ) : isLoading ? (
        <div className="space-y-2 p-4 sm:px-5">
          {[1, 2, 3].map((index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-slate-500">
          {filtersActive ? <>No invoices match these filters. <button type="button" onClick={resetFilters} className="font-semibold text-indigo-700 hover:underline">Reset filters</button></> : "No outstanding invoices available for this customer. Invoices already in an open recovery assignment are hidden."}
        </div>
      ) : (
        <div className={clsx("transition-opacity", isFetching && "opacity-60")}>
          <div className="flex items-center justify-between px-4 pt-3 text-xs sm:px-5">
            <button type="button" onClick={togglePage} className="font-semibold text-indigo-700 hover:underline">
              {pageAllSelected ? "Deselect this page" : "Select all on this page"}
            </button>
            <span className="text-slate-500">{total} available</span>
          </div>
          <ul className="space-y-1.5 p-4 pt-2 sm:px-5">
            {rows.map((inv) => {
              const isSelected = Boolean(selected[inv.id]);
              const overdue = inv.dueDate < todayStr;
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggle(inv)}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs transition",
                      isSelected ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span className={clsx("flex h-4 w-4 shrink-0 items-center justify-center rounded border", isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white")}>
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{inv.invoiceNumber}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                        <span>Inv. {inv.invoiceDate}</span>
                        <span className={overdue ? "font-semibold text-rose-600" : ""}>Due {inv.dueDate}{overdue ? " · overdue" : ""}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-slate-900">{formatMoney(inv.outstandingMinor)}</span>
                      {inv.outstandingMinor < inv.amountMinor && <span className="block text-[10px] text-slate-500">of {formatMoney(inv.amountMinor)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            className="mx-4 mb-3 sm:mx-5"
          />
        </div>
      )}
    </div>
  );
}
