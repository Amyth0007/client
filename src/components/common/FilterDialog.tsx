import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Modal } from "./Modal.js";

export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="relative inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50" aria-label="Open filters">
    <SlidersHorizontal className="h-3.5 w-3.5" /><span>Filters</span>
    {count > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-bold text-white">{count}</span>}
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
