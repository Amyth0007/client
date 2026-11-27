import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Activity, AlertTriangle, Building2, IndianRupee, KeyRound, LogIn, TrendingUp, Users } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { useAuth } from "../auth/AuthContext.js";
import { Badge } from "../../components/common/Badge.js";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Modal } from "../../components/common/Modal.js";

export type OrganizationInsightRow = {
  id: string;
  name: string;
  publicCode: string;
  status: string;
  users: number;
  activeUsers30d: number;
  issuedInvoices: number;
  draftInvoices: number;
  invoicedMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
  collected30dMinor: number;
  collectionRate: number | null;
  openRecoveries: number;
  lastActivityAt: string | null;
};

export type PlatformInsights = {
  totals: { organizations: number; activeOrganizations: number; users: number; activeUsers30d: number; issuedInvoices: number; outstandingMinor: number; overdueMinor: number; collected30dMinor: number };
  items: OrganizationInsightRow[];
  masterPasswordConfigured: boolean;
};

/** Compact "INR 12.4L" style amounts for dense tiles; full amount stays in the title tooltip. */
export function compactMoney(amountMinor: number | null | undefined) {
  const rupees = (amountMinor ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(rupees);
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "No activity";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export function PlatformOverviewStrip({ insights, isLoading }: { insights?: PlatformInsights; isLoading: boolean }) {
  const totals = insights?.totals;
  const tiles = [
    { label: "Organizations", value: totals ? `${totals.activeOrganizations}/${totals.organizations}` : "—", hint: "Active / total", icon: Building2, tone: "text-indigo-600 bg-indigo-50" },
    { label: "Users", value: totals ? String(totals.users) : "—", hint: totals ? `${totals.activeUsers30d} signed in last 30 days` : "", icon: Users, tone: "text-sky-600 bg-sky-50" },
    { label: "Outstanding", value: totals ? compactMoney(totals.outstandingMinor) : "—", hint: totals ? `${totals.issuedInvoices} issued invoices` : "", icon: IndianRupee, tone: "text-violet-600 bg-violet-50", title: totals ? formatMoney(totals.outstandingMinor) : undefined },
    { label: "Overdue", value: totals ? compactMoney(totals.overdueMinor) : "—", hint: totals && totals.outstandingMinor > 0 ? `${Math.round((totals.overdueMinor / totals.outstandingMinor) * 100)}% of outstanding` : "Across all organizations", icon: AlertTriangle, tone: "text-rose-600 bg-rose-50", title: totals ? formatMoney(totals.overdueMinor) : undefined },
    { label: "Collected (30d)", value: totals ? compactMoney(totals.collected30dMinor) : "—", hint: "Net of reversals", icon: TrendingUp, tone: "text-emerald-600 bg-emerald-50", title: totals ? formatMoney(totals.collected30dMinor) : undefined },
  ];
  return (
    <section aria-label="Platform totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div key={tile.label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs" title={tile.title}>
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tile.tone}`}><Icon className="h-4 w-4" /></span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tile.label}</span>
            </div>
            <p className={`mt-2 text-xl font-bold text-slate-900 ${isLoading ? "animate-pulse text-slate-300" : ""}`}>{tile.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{tile.hint}</p>
          </div>
        );
      })}
    </section>
  );
}

const AGING_KEYS = [
  { key: "current", label: "Not due", color: "bg-emerald-500" },
  { key: "days1to30", label: "1–30d", color: "bg-amber-400" },
  { key: "days31to60", label: "31–60d", color: "bg-orange-500" },
  { key: "days61to90", label: "61–90d", color: "bg-rose-500" },
  { key: "days91Plus", label: "90d+", color: "bg-rose-700" },
] as const;

export function OrganizationInsightsModal({ organization, onClose, onOpenOrganization }: { organization: OrganizationInsightRow | null; onClose: () => void; onOpenOrganization: (organization: OrganizationInsightRow) => void }) {
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-organization-insights", organization?.id],
    queryFn: () => api.getOrganizationInsights(organization!.id),
    enabled: Boolean(organization),
  });

  const submitReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !resetTarget) return;
    if (temporaryPassword.length < 8) { toast.error("Use at least 8 characters"); return; }
    setIsResetting(true);
    try {
      await api.resetOrganizationAdminPassword(organization.id, resetTarget.id, temporaryPassword);
      toast.success(`Password reset for ${resetTarget.name}. Share it securely; their other sessions were signed out.`);
      setResetTarget(null);
      setTemporaryPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the password");
    } finally {
      setIsResetting(false);
    }
  };

  const agingTotal = data ? AGING_KEYS.reduce((sum, bucket) => sum + (data.aging?.[bucket.key]?.amountMinor ?? 0), 0) : 0;
  const metrics = data?.metrics;

  return (
    <Modal isOpen={Boolean(organization)} onClose={onClose} title={organization?.name ?? "Organization"} description={organization ? `${organization.publicCode} · ${organization.status}` : undefined} maxWidth="xl">
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : isError || !data ? (
        <p className="text-sm text-rose-600">Insights could not be loaded.</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Outstanding", value: compactMoney(metrics.totalOutstandingMinor), full: formatMoney(metrics.totalOutstandingMinor) },
              { label: "Overdue", value: compactMoney(metrics.totalOverdueMinor), full: formatMoney(metrics.totalOverdueMinor), tone: "text-rose-700" },
              { label: "Collected", value: compactMoney(metrics.totalReceivedMinor), full: formatMoney(metrics.totalReceivedMinor), tone: "text-emerald-700" },
              { label: "Open recoveries", value: String(metrics.openRecoveryTasks ?? 0) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2" title={item.full}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className={`mt-0.5 text-base font-bold text-slate-900 ${item.tone ?? ""}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Receivables aging</p>
            {agingTotal === 0 ? <p className="text-xs text-slate-500">No open balances.</p> : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {AGING_KEYS.map((bucket) => {
                    const amount = data.aging?.[bucket.key]?.amountMinor ?? 0;
                    return amount > 0 ? <div key={bucket.key} className={bucket.color} style={{ width: `${(amount / agingTotal) * 100}%` }} title={`${bucket.label}: ${formatMoney(amount)}`} /> : null;
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  {AGING_KEYS.map((bucket) => <span key={bucket.key} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${bucket.color}`} />{bucket.label} {compactMoney(data.aging?.[bucket.key]?.amountMinor)}</span>)}
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Top debtors</p>
              {data.topDebtors.length === 0 ? <p className="text-xs text-slate-500">No outstanding customers.</p> : (
                <ul className="space-y-1.5">
                  {data.topDebtors.map((debtor: any) => (
                    <li key={debtor.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-slate-700">{debtor.displayName}</span>
                      <span className="shrink-0 font-semibold text-slate-900" title={formatMoney(debtor.outstandingMinor)}>{compactMoney(debtor.outstandingMinor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Team</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.usersByRole as Record<string, number>).map(([role, total]) => <Badge key={role} variant="neutral">{role.replace(/_/g, " ")}: {total}</Badge>)}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-700">Administrators</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.admins.map((admin: any) => (
                <li key={admin.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{admin.name} {admin.status !== "active" && <Badge variant="warning" className="ml-1">{admin.status}</Badge>}</p>
                    <p className="truncate text-[11px] text-slate-500">{admin.email} · last sign-in {relativeTime(admin.lastLoginAt)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setResetTarget({ id: admin.id, name: admin.name }); setTemporaryPassword(""); }}><KeyRound className="h-3.5 w-3.5" />Reset password</Button>
                </li>
              ))}
            </ul>
            {resetTarget && (
              <form onSubmit={submitReset} className="mt-2 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 sm:flex-row sm:items-end">
                <div className="flex-1"><Input label={`New temporary password for ${resetTarget.name}`} type="password" required minLength={8} autoComplete="new-password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} /></div>
                <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button><Button type="submit" size="sm" isLoading={isResetting}>Set password</Button></div>
              </form>
            )}
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Activity className="h-3.5 w-3.5" />Recent activity (90 days)</p>
            {data.recentActivity.length === 0 ? <p className="text-xs text-slate-500">No recorded activity.</p> : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px]">
                {data.recentActivity.map((event: any) => (
                  <li key={event.id} className="flex justify-between gap-3 text-slate-600"><span className="truncate">{event.action.replace(/[._]/g, " ")}{event.actorRole === "super_admin" ? " · platform" : ""}</span><time className="shrink-0 text-slate-400">{relativeTime(event.createdAt)}</time></li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {organization?.status === "active" && <Button onClick={() => organization && onOpenOrganization(organization)}><LogIn className="h-4 w-4" />Open organization</Button>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function OpenOrganizationModal({ organization, masterPasswordConfigured, onClose }: { organization: OrganizationInsightRow | null; masterPasswordConfigured: boolean; onClose: () => void }) {
  const { startImpersonation } = useAuth();
  const [masterPassword, setMasterPassword] = useState("");
  const [isOpening, setIsOpening] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization || !masterPassword) return;
    setIsOpening(true);
    try {
      await startImpersonation(organization.id, organization.name, masterPassword);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the organization");
      setIsOpening(false);
    }
  };

  return (
    <Modal isOpen={Boolean(organization)} onClose={() => { setMasterPassword(""); onClose(); }} title="Open organization" description={organization ? `Sign in to ${organization.name} with full administrator access.` : undefined} maxWidth="sm">
      {!masterPasswordConfigured ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>Organization access is turned off because no master password is configured on the server.</p>
          <p className="rounded-lg bg-slate-50 p-3 font-mono text-xs">MASTER_PASSWORD=&lt;at least 12 characters&gt;</p>
          <p className="text-xs text-slate-500">Add it to the server environment and restart the API.</p>
          <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">You will act as this organization's administrator for up to 2 hours. Every action is recorded under your platform account.</div>
          <Input label="Master password" type="password" required autoFocus autoComplete="off" value={masterPassword} onChange={(event) => setMasterPassword(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isOpening}><LogIn className="h-4 w-4" />Open organization</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
