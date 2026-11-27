import type React from "react";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { Pagination } from "./Pagination.js";

export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Tailwind classes for both th and td (alignment, width, responsive visibility such as "hidden md:table-cell"). */
  className?: string;
  align?: "left" | "right" | "center";
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** When provided, only rows returning true are clickable. */
  isRowClickable?: (row: T) => boolean;
  rowLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  isLoading?: boolean;
  isFetching?: boolean;
  /** Server- or client-side pagination. Omit to render without a pager. */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };
  empty?: React.ReactNode;
  className?: string;
  /** Render with no outer card border (for use inside an existing Card). */
  bare?: boolean;
  paginationClassName?: string;
};

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

export function DataTable<T>({ columns, rows, rowKey, onRowClick, isRowClickable, rowLabel, rowClassName, isLoading, isFetching, pagination, empty, className, bare, paginationClassName }: DataTableProps<T>) {
  const skeletonRows = Math.min(pagination?.pageSize ?? 5, 6);
  return (
    <div className={clsx(!bare && "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs", className)}>
      <div className={clsx("overflow-x-auto overscroll-x-contain transition-opacity", isFetching && !isLoading && "opacity-60")}>
        <table className="w-full min-w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={clsx("whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 first:pl-4 last:pr-4", alignClass[column.align ?? "left"], column.className)}
                >
                  {column.header}
                </th>
              ))}
              {onRowClick && <th scope="col" aria-hidden className="w-8 pr-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`}>
                    {columns.map((column) => (
                      <td key={column.key} className={clsx("px-3 py-3 first:pl-4 last:pr-4", column.className)}>
                        <div className="h-3.5 w-full max-w-[8rem] animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                    {onRowClick && <td />}
                  </tr>
                ))
              : rows.map((row) => {
                  const clickable = Boolean(onRowClick) && (isRowClickable ? isRowClickable(row) : true);
                  const open = () => onRowClick?.(row);
                  return (
                    <tr
                      key={rowKey(row)}
                      role={clickable ? "link" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={clickable && rowLabel ? rowLabel(row) : undefined}
                      onClick={clickable ? open : undefined}
                      onKeyDown={clickable ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          open();
                        }
                      } : undefined}
                      className={clsx(
                        "group transition-colors",
                        clickable ? "cursor-pointer hover:bg-indigo-50/60 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500" : "hover:bg-slate-50/70",
                        rowClassName?.(row),
                      )}
                    >
                      {columns.map((column) => (
                        <td key={column.key} className={clsx("px-3 py-2.5 align-middle text-slate-700 first:pl-4 last:pr-4", alignClass[column.align ?? "left"], column.className)}>
                          {column.cell(row)}
                        </td>
                      ))}
                      {onRowClick && (
                        <td className="w-8 pr-3 text-right">
                          {clickable && <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />}
                        </td>
                      )}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!isLoading && rows.length === 0 && (empty ?? <p className="px-4 py-10 text-center text-xs text-slate-500">No records found.</p>)}
      </div>
      {pagination && !isLoading && (
        <Pagination
          {...pagination}
          className={clsx("border-slate-100", bare ? "mt-3" : "px-4 pb-3", paginationClassName)}
        />
      )}
    </div>
  );
}
