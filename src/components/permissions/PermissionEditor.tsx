import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Banknote, Briefcase, CalendarOff, ChartColumn, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, DoorOpen, Eye, FileText,
  Handshake, Info, Lock, Mail, MapPinned, PenLine, Scale, ScanFace, Search, Settings, ShieldCheck, Timer, Users, Wallet,
} from "lucide-react";
import { ORGANIZATION_MODULES, organizationModuleEnabled, type OrganizationModules } from "../../modules/platform/module-registry.js";
import { ACTION_PERMISSIONS } from "../../modules/platform/action-permission-registry.js";
import { accessLevelFor, actionsOf, isViewAction, moduleOfAction, normalizePermissions, PERMISSION_GROUPS, SENSITIVE_ACTIONS, viewActionsOf, type AccessLevel, type PermissionValue } from "./permission-model.js";

type ModuleDef = (typeof ORGANIZATION_MODULES)[number];
type ActionDef = (typeof ACTION_PERMISSIONS)[number];

type PermissionEditorProps = {
  value: PermissionValue;
  onChange: (next: PermissionValue) => void;
  /**
   * `actions`: every action can be granted individually (subadmins and custom roles – enforced by the API).
   * `modules`: screens are granted; what the person can do on a screen comes from their role.
   */
  mode: "actions" | "modules";
  organizationModules: OrganizationModules | undefined;
  /** Modules that cannot be granted (for example workspace settings for subadmins). */
  restrictedModules?: string[];
  readOnly?: boolean;
  /** Shown in the read-only explanation for role-based screens. */
  roleLabel?: string;
};

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reports: ChartColumn, customers: Users, invoices: FileText, payments: Wallet, recovery: MapPinned, commitments: Handshake, gmail: Mail,
  settings: Settings, attendance: ScanFace, workforce: Briefcase, payroll: Banknote, overtime: Timer, leave: CalendarOff, compliance: Scale, visitors: DoorOpen,
};

function Switch({ checked, onChange, disabled, label, size = "md" }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onChange(!checked); }}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-5 w-9" : "h-6 w-11",
        checked ? "bg-indigo-600" : "bg-slate-300",
      )}
    >
      <span className={clsx("inline-block rounded-full bg-white shadow-sm transition-transform", size === "sm" ? "h-4 w-4" : "h-5 w-5", checked ? (size === "sm" ? "translate-x-[18px]" : "translate-x-[22px]") : "translate-x-0.5")} />
    </button>
  );
}

const LEVEL_STYLES: Record<AccessLevel, string> = {
  none: "bg-slate-100 text-slate-500",
  view: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  custom: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  full: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};
const LEVEL_LABEL: Record<AccessLevel, string> = { none: "No access", view: "View only", custom: "Custom", full: "Full access" };

export function PermissionEditor({ value, onChange, mode, organizationModules, restrictedModules = [], readOnly = false, roleLabel }: PermissionEditorProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const availability = (module: ModuleDef): { locked: boolean; reason: string | null } => {
    if (!organizationModuleEnabled(organizationModules, module.key)) return { locked: true, reason: "Turned off for this organization" };
    if (restrictedModules.includes(module.key)) return { locked: true, reason: "Organization admins only" };
    if (mode === "actions" && actionsOf(module.key).length === 0) return { locked: true, reason: "No grantable actions" };
    return { locked: false, reason: null };
  };

  const emit = (next: PermissionValue) => onChange(normalizePermissions(next, mode));
  const grantable = ORGANIZATION_MODULES.filter((module) => !availability(module).locked);

  const setLevel = (moduleKey: string, level: "none" | "view" | "full") => {
    if (mode === "modules") {
      const modules = level === "none" ? value.modules.filter((key) => key !== moduleKey) : [...value.modules, moduleKey];
      emit({ modules, actions: [] });
      return;
    }
    const others = value.actions.filter((key) => moduleOfAction(key) !== moduleKey);
    const added = level === "none" ? [] : (level === "view" ? viewActionsOf(moduleKey) : actionsOf(moduleKey)).map((action) => action.key);
    emit({ modules: value.modules, actions: [...others, ...added] });
  };

  const toggleAction = (action: ActionDef, granted: boolean) => {
    let actions = granted ? [...value.actions, action.key] : value.actions.filter((key) => key !== action.key);
    // Granting a change action implies seeing the screen; keep the read permission alongside it.
    if (granted && !isViewAction(action.key)) actions = [...actions, ...viewActionsOf(action.module).map((item) => item.key)];
    emit({ modules: value.modules, actions });
  };

  const setAll = (level: "none" | "view" | "full", modules: readonly ModuleDef[] = grantable) => {
    const keys = new Set(modules.filter((module) => !availability(module).locked).map((module) => module.key as string));
    if (mode === "modules") {
      emit({ modules: level === "none" ? value.modules.filter((key) => !keys.has(key)) : [...value.modules, ...keys], actions: [] });
      return;
    }
    const kept = value.actions.filter((key) => !keys.has(moduleOfAction(key) ?? ""));
    const added = level === "none" ? [] : [...keys].flatMap((key) => (level === "view" ? viewActionsOf(key) : actionsOf(key)).map((action) => action.key));
    emit({ modules: value.modules, actions: [...kept, ...added] });
  };

  const toggleExpanded = (key: string) => setExpanded((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const normalizedQuery = query.trim().toLowerCase();
  const matches = (module: ModuleDef) => !normalizedQuery
    || module.name.toLowerCase().includes(normalizedQuery)
    || module.description.toLowerCase().includes(normalizedQuery)
    || actionsOf(module.key).some((action) => action.name.toLowerCase().includes(normalizedQuery));

  const groups = useMemo(() => PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: group.modules.map((key) => ORGANIZATION_MODULES.find((module) => module.key === key)!).filter(Boolean),
  })), []);

  const totalActions = grantable.reduce((sum, module) => sum + actionsOf(module.key).length, 0);
  const sensitiveGranted = mode === "actions" ? value.actions.filter((key) => SENSITIVE_ACTIONS.has(key)).length : 0;
  const allExpanded = grantable.every((module) => expanded.has(module.key));

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search screens or actions…"
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
            {value.modules.length}/{grantable.length} screens
          </span>
          {mode === "actions" && <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">{value.actions.length}/{totalActions} actions</span>}
          {sensitiveGranted > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-amber-200">{sensitiveGranted} sensitive</span>}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {!readOnly && (
            <>
              <button type="button" onClick={() => setAll("full")} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50">Grant all</button>
              {mode === "actions" && <button type="button" onClick={() => setAll("view")} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-50">View only</button>}
              <button type="button" onClick={() => setAll("none")} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">Clear</button>
              <span className="mx-1 h-4 w-px bg-slate-200" />
            </>
          )}
          <button
            type="button"
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(grantable.map((module) => module.key)))}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
            {allExpanded ? "Collapse" : "Expand"} all
          </button>
        </div>
      </div>

      {mode === "modules" && (
        <div className="flex gap-2 rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2 text-[11px] text-sky-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Choose which screens {roleLabel ? `this ${roleLabel}` : "this person"} can open. What they can do on each screen comes from their role. For action-by-action control, assign a Subadmin role.</span>
        </div>
      )}

      {groups.map((group) => {
        const visible = group.items.filter(matches);
        if (!visible.length) return null;
        const groupGrantable = group.items.filter((module) => !availability(module).locked);
        const grantedInGroup = groupGrantable.filter((module) => value.modules.includes(module.key)).length;
        const groupState = grantedInGroup === 0 ? "none" : grantedInGroup === groupGrantable.length ? "all" : "some";
        return (
          <section key={group.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <div className="min-w-0">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">{group.name}</h4>
                <p className="truncate text-[11px] text-slate-500">{group.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500">{grantedInGroup}/{groupGrantable.length}</span>
                {!readOnly && groupGrantable.length > 0 && (
                  <Switch
                    size="sm"
                    label={`Grant all ${group.name}`}
                    checked={groupState === "all"}
                    onChange={(next) => setAll(next ? (mode === "actions" ? "view" : "full") : "none", groupGrantable)}
                  />
                )}
              </div>
            </header>
            <ul className="divide-y divide-slate-100">
              {visible.map((module) => {
                const { locked, reason } = availability(module);
                const level = locked ? "none" : accessLevelFor(module.key, value, mode);
                const actions = actionsOf(module.key);
                const granted = actions.filter((action) => value.actions.includes(action.key)).length;
                const isOpen = (expanded.has(module.key) || Boolean(normalizedQuery)) && actions.length > 0;
                const Icon = MODULE_ICONS[module.key] ?? ShieldCheck;
                return (
                  <li key={module.key} className={clsx(locked && "bg-slate-50/50")}>
                    <div
                      className={clsx("flex items-center gap-3 px-4 py-3", actions.length > 0 && "cursor-pointer hover:bg-slate-50/80")}
                      onClick={() => actions.length > 0 && toggleExpanded(module.key)}
                    >
                      <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen ? "rotate-0" : "-rotate-90", actions.length === 0 && "invisible")} />
                      <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", level === "none" ? "bg-slate-100 text-slate-400" : "bg-indigo-50 text-indigo-600")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={clsx("text-sm font-semibold", locked ? "text-slate-400" : "text-slate-900")}>{module.name}</span>
                          {locked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"><Lock className="h-3 w-3" />{reason}</span>
                          ) : (
                            <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", LEVEL_STYLES[level])}>
                              {LEVEL_LABEL[level]}{mode === "actions" && level === "custom" ? ` · ${granted}/${actions.length}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-500">{module.description}</p>
                      </div>
                      {!locked && (mode === "actions" ? (
                        <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5" onClick={(event) => event.stopPropagation()} role="radiogroup" aria-label={`${module.name} access level`}>
                          {(["none", "view", "full"] as const).map((option) => {
                            const active = option === level;
                            return (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={readOnly}
                                onClick={() => setLevel(module.key, option)}
                                className={clsx(
                                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-default",
                                  active ? (option === "none" ? "bg-white text-slate-700 shadow-sm" : option === "view" ? "bg-white text-sky-700 shadow-sm" : "bg-white text-emerald-700 shadow-sm") : "text-slate-500 hover:text-slate-800",
                                )}
                              >
                                {option === "none" ? "None" : option === "view" ? "View" : "Full"}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Switch label={`Access to ${module.name}`} checked={level !== "none"} disabled={readOnly} onChange={(next) => setLevel(module.key, next ? "full" : "none")} />
                      ))}
                    </div>

                    {isOpen && !locked && (
                      <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3 pl-[4.25rem]">
                        {mode === "actions" ? (
                          <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                            {(["view", "manage"] as const).map((kind) => {
                              const list = actions.filter((action) => (kind === "view") === isViewAction(action.key));
                              if (!list.length) return null;
                              return (
                                <div key={kind}>
                                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    {kind === "view" ? <Eye className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                                    {kind === "view" ? "View" : "Create & manage"}
                                  </p>
                                  <ul className="space-y-0.5">
                                    {list.map((action) => {
                                      const on = value.actions.includes(action.key);
                                      const highlighted = normalizedQuery && action.name.toLowerCase().includes(normalizedQuery);
                                      return (
                                        <li key={action.key} className={clsx("flex items-center justify-between gap-3 rounded-lg px-2 py-1.5", highlighted ? "bg-yellow-50" : "hover:bg-white")}>
                                          <span className="flex min-w-0 items-center gap-2 text-xs text-slate-700">
                                            <span className="truncate">{action.name}</span>
                                            {SENSITIVE_ACTIONS.has(action.key) && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-800">Sensitive</span>}
                                          </span>
                                          <Switch size="sm" label={action.name} checked={on} disabled={readOnly} onChange={(next) => toggleAction(action, next)} />
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Available on this screen (set by role)</p>
                            <ul className="flex flex-wrap gap-1.5">
                              {actions.map((action) => (
                                <li key={action.key} className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]", level === "none" ? "bg-slate-100 text-slate-400" : "bg-white text-slate-700 ring-1 ring-slate-200")}>
                                  {level !== "none" && <Check className="h-3 w-3 text-emerald-600" />}{action.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {groups.every((group) => !group.items.some(matches)) && <p className="py-6 text-center text-xs text-slate-500">No screens or actions match “{query}”.</p>}
    </div>
  );
}

/** Compact module chips for list views. */
export function PermissionChips({ modules, max = 5 }: { modules: string[]; max?: number }) {
  const names = modules.map((key) => ORGANIZATION_MODULES.find((module) => module.key === key)?.name ?? key);
  if (!names.length) return <span className="text-[11px] text-slate-400">No screens</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {names.slice(0, max).map((name) => <span key={name} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{name}</span>)}
      {names.length > max && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">+{names.length - max} more</span>}
    </span>
  );
}
