import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import {
  Check, ChevronRight, Compass, EyeOff, HelpCircle, Info, ShieldCheck, Sparkles,
  Workflow, X,
} from "lucide-react";
import { useAuth } from "../../modules/auth/AuthContext.js";

export type HelpStep = { step: number | string; title: string; description: string; badge?: string };
export type HelpRule = { label: string; value: string };
export type HelpRole = { role: string; summary: string };
export type HelpGuideProps = {
  title: string; description: string; badge?: string; steps?: HelpStep[];
  rules?: HelpRule[]; roles?: HelpRole[]; whyThisExists?: string;
  defaultExpanded?: boolean; className?: string;
  compact?: boolean;
};

export function HelpGuide({
  title, description, badge = "Workflow Guide", steps = [], rules = [], roles = [],
  whyThisExists, className,
  compact = false,
}: HelpGuideProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setIsOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [isOpen]);

  if (user?.organization?.showGuides === false || isHidden) return null;

  const hideGuide = () => {
    setIsHidden(true);
  };

  return (
    <>
      <div className={clsx(compact ? "flex items-center gap-1.5" : "flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-4 py-3 shadow-sm", className)}>
        {!compact && <>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"><Compass className="h-4 w-4" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{title}</p><p className="truncate text-xs text-slate-600">{description}</p></div>
        </div>
        </>}
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setIsOpen(true)} className={clsx("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2", compact ? "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50" : "bg-indigo-600 text-white hover:bg-indigo-700")} aria-haspopup="dialog">
            <HelpCircle className="h-4 w-4" /><span>{compact ? "Guide" : "Open guide"}</span>{!compact && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={hideGuide} className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800" aria-label="Hide this guide" title="Hide this guide">
            <EyeOff className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end" role="presentation">
          <button type="button" className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" aria-label="Close guide" onClick={() => setIsOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-labelledby="help-guide-title" className="relative flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl animate-in slide-in-from-right duration-200">
            <header className="flex items-start justify-between gap-4 border-b border-indigo-100 bg-gradient-to-br from-indigo-700 to-violet-700 px-5 py-5 text-white sm:px-7">
              <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Compass className="h-5 w-5" /></span><div><span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium"><Sparkles className="h-3 w-3" />{badge}</span><h2 id="help-guide-title" className="mt-2 text-lg font-bold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-indigo-100">{description}</p></div></div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Close guide"><X className="h-5 w-5" /></button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
              {whyThisExists && <section className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-slate-700"><Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" /><p><strong className="text-slate-900">Why this section exists: </strong>{whyThisExists}</p></section>}
              {steps.length > 0 && <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Workflow className="h-4 w-4 text-indigo-600" />Standard workflow</h3><ol className="space-y-3">{steps.map((st, idx) => <li key={String(st.step)} className="relative flex gap-3 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{st.step}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-900">{st.title}</h4>{st.badge && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{st.badge}</span>}</div><p className="mt-1 text-xs leading-relaxed text-slate-600">{st.description}</p></div>{idx < steps.length - 1 && <span className="sr-only">Then</span>}</li>)}</ol></section>}
              {(rules.length > 0 || roles.length > 0) && <div className="space-y-4">{rules.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-900"><HelpCircle className="h-4 w-4 text-amber-600" />Key rules & automations</h3><ul className="space-y-3">{rules.map((rule, idx) => <li key={idx} className="flex gap-2 text-xs leading-relaxed text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><strong className="text-slate-900">{rule.label}: </strong>{rule.value}</span></li>)}</ul></section>}{roles.length > 0 && <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-900"><ShieldCheck className="h-4 w-4 text-emerald-600" />Roles & permissions</h3><ul className="space-y-3">{roles.map((r, idx) => <li key={idx} className="flex gap-2 text-xs leading-relaxed text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><strong className="text-slate-900">{r.role}: </strong>{r.summary}</span></li>)}</ul></section>}</div>}
            </div>
            <footer className="border-t bg-white px-5 py-4 text-right sm:px-7"><button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close guide</button></footer>
          </aside>
        </div>, document.body
      )}
    </>
  );
}
