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

  const content = <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{title}</p>
        <div className={clsx("rounded-xl border p-2.5", iconColor)}>
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{value}</p>
        {subtitle && <p className="mt-1 text-xs font-medium text-slate-700">{subtitle}</p>}
      </div>
    </div>;
  const cardClass = clsx(
    "block min-h-28 rounded-2xl border border-slate-300 bg-white p-4 shadow-xs transition-all sm:min-h-32 sm:p-5",
    to && "hover:border-indigo-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
    className,
  );

  return to ? <Link to={to} aria-label={`${title}: ${value}. ${subtitle || "Open details"}`} className={cardClass}>{content}</Link> : <div className={cardClass}>{content}</div>;
}
