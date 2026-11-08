import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Modal } from "./Modal.js";

export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 sm:w-auto sm:px-2.5 sm:text-xs sm:font-medium" aria-label={count ? `Open filters, ${count} active` : "Open filters"}>
    <SlidersHorizontal className="h-4 w-4 shrink-0" /><span className="sr-only sm:not-sr-only">Filters</span>
    {count > 0 && <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-700 px-1 text-[10px] font-bold leading-none text-white sm:static sm:h-5 sm:min-w-5 sm:text-[11px]">{count}</span>}
  </button>;
}

export function FilterDialog({ isOpen, onClose, onClear, children }: { isOpen: boolean; onClose: () => void; onClear: () => void; children: ReactNode }) {
  return <Modal isOpen={isOpen} onClose={onClose} title="Filters" description="Narrow the records shown on this screen" maxWidth="lg">
    <div className="space-y-5">
      {children}
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button type="button" onClick={onClear} className="text-xs font-medium text-indigo-600 hover:underline">Clear all filters</button>
      </div>
    </div>
  </Modal>;
}
