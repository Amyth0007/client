import React, { useRef, useState } from "react";
import { clsx } from "clsx";
import { getApiActivitySnapshot, subscribeApiActivityChanges } from "../../services/api-client.js";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  onClick,
  type,
  ...props
}: ButtonProps) {
  const [asyncPending, setAsyncPending] = useState(false);
  const lockedSourcesRef = useRef(new Set<string>());
  const setSourceLocked = (source: string, locked: boolean) => {
    if (locked) lockedSourcesRef.current.add(source);
    else lockedSourcesRef.current.delete(source);
    setAsyncPending(lockedSourcesRef.current.size > 0);
  };
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    if (lockedSourcesRef.current.size || disabled || isLoading) return;

    const baseline = getApiActivitySnapshot();
    let sawRequest = false;
    let releaseTimer: number | undefined;
    const unsubscribe = subscribeApiActivityChanges((active, delta) => {
      if (delta > 0) {
        sawRequest = true;
        if (releaseTimer !== undefined) window.clearTimeout(releaseTimer);
        setSourceLocked("api", true);
      } else if (sawRequest && active <= baseline) {
        if (releaseTimer !== undefined) window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(() => {
          setSourceLocked("api", false);
          unsubscribe();
        }, 180);
      }
    });
    window.setTimeout(() => { if (!sawRequest) unsubscribe(); }, 0);

    const result: unknown = onClick
      ? (onClick as (event: React.MouseEvent<HTMLButtonElement>) => unknown)(event)
      : undefined;
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setSourceLocked("promise", true);
      void Promise.resolve(result).then(
        () => setSourceLocked("promise", false),
        () => setSourceLocked("promise", false),
      );
    }
  };
  const showLoading = isLoading || asyncPending;
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  }[size];

  const variantClasses = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-indigo-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-400",
  }[variant];

  return (
    <button
      className={clsx(base, sizeClasses, variantClasses, className)}
      disabled={disabled || showLoading}
      type={type}
      onClick={handleClick}
      {...props}
    >
      {showLoading && (
        <svg
          className="h-4 w-4 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}
