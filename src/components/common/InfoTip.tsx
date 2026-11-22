import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(280, window.innerWidth - 24);
      const estimatedHeight = Math.min(150, window.innerHeight - 24);
      const below = window.innerHeight - rect.bottom;
      const top = below > estimatedHeight + 12 ? rect.bottom + 6 : Math.max(12, rect.top - estimatedHeight - 6);
      setPosition({ top, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) });
    };
    const closeOutside = (event: MouseEvent) => {
      if (!buttonRef.current?.contains(event.target as Node) && !chipRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    updatePosition();
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return <>
    <button ref={buttonRef} type="button" aria-label={`Information: ${label}`} aria-expanded={open} onClick={() => setOpen((current) => !current)} className="inline-flex rounded-full p-0.5 text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300">
      <Info className="h-3.5 w-3.5" />
    </button>
    {open && createPortal(<div ref={chipRef} role="tooltip" style={{ position: "fixed", top: position.top, left: position.left, width: "min(17.5rem, calc(100vw - 1.5rem))" }} className="z-[1000] rounded-xl border border-indigo-200 bg-white px-3 py-2.5 text-left text-xs leading-relaxed text-slate-700 shadow-xl ring-1 ring-indigo-100">
      <p className="mb-0.5 font-semibold text-indigo-900">{label}</p>
      {children}
    </div>, document.body)}
  </>;
}
