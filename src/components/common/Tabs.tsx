import React from "react";
import { clsx } from "clsx";

export type TabItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number | string;
  badge?: string;
  disabled?: boolean;
};

export type TabsProps = {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: "pills" | "underline" | "contained";
  className?: string;
  ariaLabel?: string;
};

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = "contained",
  className,
  ariaLabel = "Page sections",
}: TabsProps) {
  if (variant === "underline") {
    return (
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={clsx(
          "flex gap-6 overflow-x-auto border-b border-slate-200 no-scrollbar",
          className
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              disabled={tab.disabled}
              aria-selected={isActive}
              onClick={() => !tab.disabled && onChange(tab.id)}
              className={clsx(
                "group inline-flex shrink-0 items-center gap-2 border-b-2 py-3 text-sm font-medium transition-all duration-150 focus:outline-none",
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
                tab.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {Icon && (
                <Icon
                  className={clsx(
                    "h-4 w-4",
                    isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
              )}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Contained variant (default)
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        "flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1.5 shadow-2xs backdrop-blur-xs",
        className
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            disabled={tab.disabled}
            aria-selected={isActive}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={clsx(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-150 focus:outline-none",
              isActive
                ? "bg-white text-indigo-900 shadow-sm font-semibold ring-1 ring-slate-900/5"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
              tab.disabled && "cursor-not-allowed opacity-40"
            )}
          >
            {Icon && (
              <Icon
                className={clsx(
                  "h-4 w-4",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  isActive
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-200/80 text-slate-600"
                )}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
