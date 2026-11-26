import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [10, 25, 50, 100];

/** Client-side pagination for an in-memory list. Resets to page 1 when the list length or page size changes. */
export function usePagination<T>(items: T[] | undefined, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const list = items ?? [];
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const pageItems = useMemo(() => list.slice((page - 1) * pageSize, page * pageSize), [list, page, pageSize]);
  return { page, setPage, pageSize, setPageSize: (size: number) => { setPageSize(size); setPage(1); }, total, pageCount, pageItems };
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
};

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, className = "" }: PaginationProps) {
  if (total <= PAGE_SIZES[0]) return null;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const buttonClass = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount].filter((value) => value >= 1 && value <= pageCount))).sort((a, b) => a - b);
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600 ${className}`}>
      <div className="flex items-center gap-2">
        <span>Showing <strong className="text-slate-900">{from}–{to}</strong> of <strong className="text-slate-900">{total}</strong></span>
        {onPageSizeChange && (
          <select aria-label="Rows per page" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" className={`${buttonClass} border-slate-200 bg-white hover:bg-slate-50`} disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-4 w-4" /></button>
        {pages.map((value, index) => (
          <span key={value} className="flex items-center gap-1">
            {index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
            <button type="button" aria-current={value === page ? "page" : undefined} className={`${buttonClass} ${value === page ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`} onClick={() => onPageChange(value)}>{value}</button>
          </span>
        ))}
        <button type="button" aria-label="Next page" className={`${buttonClass} border-slate-200 bg-white hover:bg-slate-50`} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Render-prop wrapper for paginating a list where a hook can't be used directly (e.g. inside a .map). */
export function Paged<T>({ items, initialPageSize = 10, className, children }: { items: T[] | undefined; initialPageSize?: number; className?: string; children: (pageItems: T[]) => React.ReactNode }) {
  const pages = usePagination(items, initialPageSize);
  return (
    <>
      {children(pages.pageItems)}
      <Pagination page={pages.page} pageSize={pages.pageSize} total={pages.total} onPageChange={pages.setPage} onPageSizeChange={pages.setPageSize} className={className ?? "mt-3"} />
    </>
  );
}
