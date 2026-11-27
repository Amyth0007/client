import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SelectOption = {
  value: string | number;
  label: string;
  sublabel?: string;
  disabled?: boolean;
};

export type CustomSelectProps = {
  label?: string;
  error?: string;
  options: SelectOption[];
  value: string | number;
  onChange: (e: any) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  searchable?: boolean;
  helperText?: string;
  portal?: boolean;
  size?: "sm" | "md";
  "aria-label"?: string;
};

export function CustomSelect({
  label,
  error,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  required = false,
  id,
  name,
  className,
  searchable,
  helperText,
  portal = false,
  size = "md",
  "aria-label": ariaLabel,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !portal) return;
    const updatePosition = () => {
      const trigger = containerRef.current?.querySelector("button[aria-haspopup='listbox']");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuHeight = Math.min(256, window.innerHeight - 16);
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const top = below >= Math.min(menuHeight, 180) || below >= above ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4);
      const width = Math.min(rect.width, window.innerWidth - 16);
      setMenuPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, portal]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const shouldShowSearch = searchable !== undefined ? searchable : options.length > 6;

  const filteredOptions = searchQuery.trim()
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  const handleSelect = (optionValue: string | number) => {
    if (disabled) return;
    setIsOpen(false);
    // Support both standard React event handlers (e.target.value) and direct value callbacks
    const syntheticEvent = {
      target: { value: String(optionValue), name: name || "" },
      currentTarget: { value: String(optionValue), name: name || "" },
    };
    onChange(syntheticEvent);
  };

  return (
    <div className={clsx("relative w-full", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={id || name}
          className="mb-1 block text-xs font-medium text-slate-700"
        >
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}

      {/* Hidden input for form submission support */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Trigger Button */}
      <button
        id={id || name}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={clsx(
          "flex w-full items-center justify-between rounded-xl border text-left transition-all duration-150 focus:outline-none focus:ring-2",
          size === "sm" ? "h-8 rounded-lg px-2.5 text-xs" : "px-3 py-2 text-sm",
          disabled && "cursor-not-allowed bg-slate-100 text-slate-400 opacity-75",
          error
            ? "border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-200"
            : isOpen
              ? "border-indigo-500 bg-white ring-2 ring-indigo-100 shadow-sm"
              : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 focus:border-indigo-500 focus:ring-indigo-100 shadow-xs"
        )}
      >
        <span className={clsx("truncate block", !selectedOption && "text-slate-400 font-normal")}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-slate-500">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown
          className={clsx(
            "ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180 text-indigo-600"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (() => {
        const menu = <div ref={menuRef} style={portal ? { position: "fixed", top: menuPosition.top, left: menuPosition.left, width: menuPosition.width, maxHeight: "min(16rem, calc(100vh - 1rem))" } : undefined} className={clsx(portal ? "z-[1000] min-w-[200px]" : "absolute z-50 mt-1 max-h-64 w-full min-w-[200px]", "overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100")}>
          {shouldShowSearch && (
            <div className="p-1 pb-1.5 border-b border-slate-100">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search options..."
                  className="w-full rounded-lg bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="max-h-52 overflow-y-auto py-1 space-y-0.5">
            {placeholder && !required && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={clsx(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                  value === ""
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <span>{placeholder}</span>
                {value === "" && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                      opt.disabled && "cursor-not-allowed opacity-40",
                      isSelected
                        ? "bg-indigo-50 font-medium text-indigo-950"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className={clsx("truncate", isSelected && "font-semibold text-indigo-900")}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="text-[11px] text-slate-400">{opt.sublabel}</span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>;
        return portal ? createPortal(menu, document.body) : menu;
      })()}

      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
