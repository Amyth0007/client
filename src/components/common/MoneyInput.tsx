import { useState, useEffect } from "react";
import { clsx } from "clsx";

type MoneyInputProps = {
  label?: string;
  valueMinor?: number;
  onChangeMinor?: (valueMinor: number) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
};

export function MoneyInput({
  label,
  valueMinor = 0,
  onChangeMinor,
  error,
  helperText,
  placeholder = "0.00",
  disabled,
  required,
}: MoneyInputProps) {
  const [displayValue, setDisplayValue] = useState(
    valueMinor ? (valueMinor / 100).toString() : "",
  );

  useEffect(() => {
    if (valueMinor !== undefined && valueMinor !== null) {
      const currentRupees = parseFloat(displayValue || "0");
      if (Math.round(currentRupees * 100) !== valueMinor) {
        setDisplayValue(valueMinor === 0 ? "" : (valueMinor / 100).toString());
      }
    }
  }, [valueMinor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onChangeMinor?.(Math.round(num * 100));
    } else if (val === "") {
      onChangeMinor?.(0);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <span className="text-slate-500 font-medium sm:text-sm">₹</span>
        </div>
        <input
          type="number"
          step="0.01"
          min="0"
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={clsx(
            "w-full rounded-lg border py-2 pl-7 pr-3 text-sm transition-colors focus:outline-none focus:ring-1",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/30 text-red-900"
              : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 bg-white text-slate-900",
          )}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-slate-600">{helperText}</p>}
    </div>
  );
}
