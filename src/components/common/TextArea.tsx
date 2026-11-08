import React, { forwardRef } from "react";
import { clsx } from "clsx";

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className, id, rows = 3, ...props }, ref) => {
    const textId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textId} className="block text-xs font-medium text-slate-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textId}
          rows={rows}
          className={clsx(
            "w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/30 text-red-900"
              : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-slate-900",
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-slate-600">{helperText}</p>}
      </div>
    );
  },
);

TextArea.displayName = "TextArea";
