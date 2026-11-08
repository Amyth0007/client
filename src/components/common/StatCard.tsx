import { clsx } from "clsx";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "success" | "warning" | "danger" | "neutral";
  className?: string;
  to?: string;
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "primary",
  className,
  to,
}: StatCardProps) {
  const iconColor = {
    primary: "text-indigo-600 bg-indigo-50 border-indigo-100",
    success: "text-emerald-600 bg-emerald-50 border-emerald-100",
    warning: "text-amber-600 bg-amber-50 border-amber-100",
    danger: "text-rose-600 bg-rose-50 border-rose-100",
    neutral: "text-slate-600 bg-slate-100 border-slate-200",
  }[variant];

  const content = <div className="flex h-full min-w-0 flex-col justify-between gap-3">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 flex-1 break-words pt-1 text-[0.68rem] font-bold uppercase leading-4 tracking-wide text-slate-700 sm:text-xs sm:tracking-wider">{title}</p>
        <div className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg border sm:h-10 sm:w-10 sm:rounded-xl", iconColor)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="break-words text-lg font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">{value}</p>
        {subtitle && <p className="mt-1 break-words text-xs font-medium leading-4 text-slate-700">{subtitle}</p>}
      </div>
    </div>;
  const cardClass = clsx(
    "block min-h-28 min-w-0 overflow-hidden rounded-2xl border border-slate-300 bg-white p-3 shadow-xs transition-all sm:min-h-32 sm:p-5",
    to && "hover:border-indigo-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
    className,
  );

  return to ? <Link to={to} aria-label={`${title}: ${value}. ${subtitle || "Open details"}`} className={cardClass}>{content}</Link> : <div className={cardClass}>{content}</div>;
}
