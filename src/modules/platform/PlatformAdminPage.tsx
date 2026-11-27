import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2, LogIn, Plus, Search, SlidersHorizontal } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { DataTable } from "../../components/common/DataTable.js";
import { compactMoney, OpenOrganizationModal, OrganizationInsightsModal, PlatformOverviewStrip, relativeTime, type OrganizationInsightRow, type PlatformInsights } from "./PlatformInsights.js";
import { Badge } from "../../components/common/Badge.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { Input } from "../../components/common/Input.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Modal } from "../../components/common/Modal.js";
import { TextArea } from "../../components/common/TextArea.js";
import { ORGANIZATION_MODULES, type OrganizationModuleKey } from "./module-registry.js";

type Organization = {
  id: string;
  name: string;
  legalName: string;
  status: "active" | "suspended" | "deactivated";
  timezone: string;
  createdAt: string;
  usage: { userCount: number; invoiceCount: number; storageBytes: number };
  modules: Partial<Record<OrganizationModuleKey, boolean>>;
};

const initialForm = { name: "", legalName: "", adminName: "", email: "", password: "" };

export function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [statusTarget, setStatusTarget] = useState<Organization | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<Organization | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [complianceReviewTarget, setComplianceReviewTarget] = useState<{ rule: any; decision: "validated" | "rejected" } | null>(null);
  const [legalReviewReference, setLegalReviewReference] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-organizations"],
    queryFn: () => api.listOrganizations({ page: "1", limit: "100", sort: "-createdAt" }),
  });
  const organizations = (data?.data ?? []) as Organization[];
  const { data: insights, isLoading: insightsLoading } = useQuery<PlatformInsights>({
    queryKey: ["platform-insights"],
    queryFn: () => api.getPlatformInsights(),
  });
  const [orgSearch, setOrgSearch] = useState("");
  const [orgPage, setOrgPage] = useState(1);
  const [orgPageSize, setOrgPageSize] = useState(10);
  const [insightsTarget, setInsightsTarget] = useState<OrganizationInsightRow | null>(null);
  const [openTarget, setOpenTarget] = useState<OrganizationInsightRow | null>(null);
  const insightById = new Map((insights?.items ?? []).map((item) => [item.id, item]));
  const orgRows = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    status: org.status,
    org,
    insight: insightById.get(org.id) ?? { id: org.id, name: org.name, publicCode: "", status: org.status, users: org.usage?.userCount ?? 0, activeUsers30d: 0, issuedInvoices: 0, draftInvoices: 0, invoicedMinor: 0, outstandingMinor: 0, overdueMinor: 0, collected30dMinor: 0, collectionRate: null, openRecoveries: 0, lastActivityAt: null },
  }));
  const searchTerm = orgSearch.trim().toLowerCase();
  const filteredOrgRows = searchTerm ? orgRows.filter((row) => row.name.toLowerCase().includes(searchTerm) || row.insight.publicCode.toLowerCase().includes(searchTerm)) : orgRows;
  const orgPageRows = filteredOrgRows.slice((orgPage - 1) * orgPageSize, orgPage * orgPageSize);
  const { data: complianceQueue = [], refetch: refetchCompliance } = useQuery({
    queryKey: ["platform-compliance-pending"],
    queryFn: () => api.listPendingComplianceRules(),
  });
  const reviewCompliance = async (rule: any, decision: "validated" | "rejected") => {
    setComplianceReviewTarget({ rule, decision });
    setLegalReviewReference("");
  };
  const submitComplianceReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!complianceReviewTarget || legalReviewReference.trim().length < 5) return;
    try {
      const { rule, decision } = complianceReviewTarget;
      await api.reviewComplianceRule(rule.organization.id, rule.id, { decision, legalReviewReference: legalReviewReference.trim() });
      toast.success(decision === "validated" ? "Rule version validated" : "Rule version returned for correction");
      setComplianceReviewTarget(null);
      await refetchCompliance();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Review failed"); }
  };

  const createMutation = useMutation({
    mutationFn: () => api.createOrganization({
      name: form.name,
      legalName: form.legalName || undefined,
      admin: { name: form.adminName, email: form.email, temporaryPassword: form.password },
    }),
    onSuccess: () => {
      toast.success("Organization created");
      setForm(initialForm);
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["platform-organizations"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-insights"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason: string }) =>
      api.updateOrganizationStatus(id, { status, reason }),
    onSuccess: () => {
      toast.success("Organization status updated");
      setStatusTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["platform-organizations"] });
      void queryClient.invalidateQueries({ queryKey: ["platform-insights"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moduleMutation = useMutation({
    mutationFn: ({ id, moduleId, enabled }: { id: string; moduleId: OrganizationModuleKey; enabled: boolean }) => api.updateOrganizationModule(id, moduleId, enabled),
    onSuccess: (_result, variables) => {
      const name = ORGANIZATION_MODULES.find((module) => module.key === variables.moduleId)?.name ?? variables.moduleId;
      toast.success(`${name} ${variables.enabled ? "enabled" : "disabled"}`);
      void queryClient.invalidateQueries({ queryKey: ["platform-organizations"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const changeStatus = (organization: Organization) => {
    setStatusTarget(organization);
    setStatusReason("");
  };

  const submitStatusChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!statusTarget) return;
    if (statusReason.trim().length < 3) {
      toast.error("Please enter a reason with at least 3 characters");
      return;
    }
    const status = statusTarget.status === "active" ? "suspended" : "active";
    statusMutation.mutate({ id: statusTarget.id, status, reason: statusReason.trim() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform administration"
        description="Manage customer organizations and their access to Recovr."
        action={<Button onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" />{showForm ? "Close form" : "Add organization"}</Button>}
      />

      <PlatformOverviewStrip insights={insights} isLoading={insightsLoading} />

      {showForm && (
        <Card title="Create an organization" subtitle="An organization admin account will be created with a temporary password.">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Input label="Organization name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <Input label="Legal name" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
            <Input label="Admin name" required value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} />
            <Input label="Admin email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <Input label="Temporary password" type="password" minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} helperText="At least 8 characters. The admin must change it after signing in." />
            <div className="flex items-end"><Button type="submit" isLoading={createMutation.isPending}>Create organization</Button></div>
          </form>
        </Card>
      )}

      <Card title="Compliance rule review" subtitle="Review source-backed rule versions before organizations can activate them.">
        {complianceQueue.length === 0 ? <p className="text-sm text-slate-500">No rule versions are awaiting review.</p> : <div className="divide-y">{complianceQueue.map((rule: any) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{rule.name} · {rule.organization?.name ?? "Organization"}</p><p className="mt-1 text-xs text-slate-500">{rule.ruleCode} · {rule.jurisdiction} {rule.regionCode} · {rule.industry} · {rule.employeeCategory} · v{rule.version} · from {rule.effectiveFrom}</p><div className="mt-1 flex flex-wrap gap-2">{rule.sources.map((source: any) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-700 underline">{source.title}</a>)}</div></div><div className="flex gap-2"><Button size="sm" onClick={() => reviewCompliance(rule, "validated")}>Validate</Button><Button size="sm" variant="outline" onClick={() => reviewCompliance(rule, "rejected")}>Return</Button></div></div>)}</div>}
      </Card>

      <Card title="Organizations" subtitle="Key numbers per organization. Click a row for detailed insights." contentClassName="p-0!">
        <div className="border-b border-slate-100 p-3 sm:px-5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={orgSearch} onChange={(event) => { setOrgSearch(event.target.value); setOrgPage(1); }} placeholder="Search organization or code…" aria-label="Search organizations" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
        </div>
        {isError ? (
          <p className="p-5 text-sm text-rose-600">Could not load organizations. Refresh and try again.</p>
        ) : !isLoading && organizations.length === 0 ? (
          <div className="p-5"><EmptyState icon={Building2} title="No organizations yet" description="Create an organization to onboard your first customer." /></div>
        ) : (
          <DataTable
            bare
            paginationClassName="mx-4 mb-3"
            rows={orgPageRows}
            rowKey={(row) => row.id}
            isLoading={isLoading || insightsLoading}
            onRowClick={(row) => setInsightsTarget(row.insight)}
            rowLabel={(row) => `Open insights for ${row.name}`}
            empty={<p className="px-4 py-10 text-center text-sm text-slate-500">No organizations match your search.</p>}
            pagination={{ page: orgPage, pageSize: orgPageSize, total: filteredOrgRows.length, onPageChange: setOrgPage, onPageSizeChange: (size) => { setOrgPageSize(size); setOrgPage(1); } }}
            columns={[
              {
                key: "name",
                header: "Organization",
                cell: (row) => (
                  <div className="min-w-0">
                    <p className="max-w-[14rem] truncate font-semibold text-slate-900">{row.name}</p>
                    <p className="text-[11px] text-slate-500">{row.insight.publicCode} · {relativeTime(row.insight.lastActivityAt)}</p>
                  </div>
                ),
              },
              { key: "users", header: "Users", className: "hidden whitespace-nowrap md:table-cell", cell: (row) => <span title="Signed in last 30 days / total">{row.insight.activeUsers30d}<span className="text-slate-400"> / {row.insight.users}</span></span> },
              { key: "outstanding", header: "Outstanding", align: "right", className: "whitespace-nowrap", cell: (row) => <span className="font-semibold text-slate-900" title={formatMoney(row.insight.outstandingMinor)}>{compactMoney(row.insight.outstandingMinor)}</span> },
              { key: "overdue", header: "Overdue", align: "right", className: "hidden whitespace-nowrap sm:table-cell", cell: (row) => <span className={row.insight.overdueMinor > 0 ? "font-medium text-rose-700" : "text-slate-400"} title={formatMoney(row.insight.overdueMinor)}>{compactMoney(row.insight.overdueMinor)}</span> },
              { key: "collected", header: "Collected 30d", align: "right", className: "hidden whitespace-nowrap lg:table-cell", cell: (row) => <span className="text-emerald-700" title={formatMoney(row.insight.collected30dMinor)}>{compactMoney(row.insight.collected30dMinor)}</span> },
              {
                key: "rate",
                header: "Recovered",
                className: "hidden w-32 xl:table-cell",
                cell: (row) => row.insight.collectionRate == null ? <span className="text-xs text-slate-400">—</span> : (
                  <div className="flex items-center gap-2" title="Share of issued invoice value already paid">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(row.insight.collectionRate * 100)}%` }} /></div>
                    <span className="text-xs text-slate-600">{Math.round(row.insight.collectionRate * 100)}%</span>
                  </div>
                ),
              },
              { key: "status", header: "Status", className: "hidden sm:table-cell", cell: (row) => <Badge variant={row.status === "active" ? "success" : "warning"}>{row.status}</Badge> },
              {
                key: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                cell: (row) => (
                  <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                    {row.status === "active" && <Button size="sm" onClick={() => setOpenTarget(row.insight)} aria-label={`Open ${row.name}`} title="Open organization as admin"><LogIn className="h-3.5 w-3.5" /><span className="hidden lg:inline">Open</span></Button>}
                    <Button size="sm" variant="outline" onClick={() => setPermissionsTarget(row.org)} aria-label={`Modules for ${row.name}`} title="Modules"><SlidersHorizontal className="h-3.5 w-3.5" /><span className="hidden lg:inline">Modules</span></Button>
                    {row.status !== "deactivated" && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => changeStatus(row.org)} title={row.status === "active" ? "Suspend organization" : "Activate organization"}>{row.status === "active" ? "Suspend" : "Activate"}</Button>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      <OrganizationInsightsModal organization={insightsTarget} onClose={() => setInsightsTarget(null)} onOpenOrganization={(target) => { setInsightsTarget(null); setOpenTarget(target); }} />
      <OpenOrganizationModal organization={openTarget} masterPasswordConfigured={insights?.masterPasswordConfigured ?? false} onClose={() => setOpenTarget(null)} />
      <Modal isOpen={Boolean(permissionsTarget)} onClose={() => setPermissionsTarget(null)} title="Organization permissions" description={permissionsTarget ? `Enable or disable product modules for ${permissionsTarget.name}. Changes apply to everyone in this organization.` : undefined}>
        <div className="space-y-3">
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">Module access is controlled at the organization level. Employee screen permissions are managed by that organization’s admin.</div>
          {ORGANIZATION_MODULES.map((module) => {
            const enabled = permissionsTarget ? permissionsTarget.modules?.[module.key] ?? module.defaultEnabled : false;
            return <div key={module.key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{module.name}</p><p className="mt-0.5 text-xs text-slate-600">{module.description}</p></div>
              <button type="button" role="switch" aria-checked={enabled} aria-label={`${module.name} for ${permissionsTarget?.name}`} disabled={!permissionsTarget || moduleMutation.isPending} onClick={() => {
                if (!permissionsTarget) return;
                const next = !enabled;
                setPermissionsTarget({ ...permissionsTarget, modules: { ...permissionsTarget.modules, [module.key]: next } });
                moduleMutation.mutate({ id: permissionsTarget.id, moduleId: module.key, enabled: next }, { onError: () => setPermissionsTarget(permissionsTarget) });
              }} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-indigo-600" : "bg-slate-300"}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} /></button>
            </div>;
          })}
          <div className="flex justify-end pt-2"><Button variant="outline" onClick={() => setPermissionsTarget(null)}>Done</Button></div>
        </div>
      </Modal>
      <Modal isOpen={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} title={statusTarget?.status === "active" ? "Suspend organization" : "Activate organization"} description={statusTarget?.name}>
        <form onSubmit={submitStatusChange} className="space-y-4">
          <TextArea label="Reason" required minLength={3} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Explain why the organization status is changing" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={statusMutation.isPending}>Confirm status change</Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={Boolean(complianceReviewTarget)} onClose={() => setComplianceReviewTarget(null)} title={complianceReviewTarget?.decision === "validated" ? "Validate compliance rule" : "Return compliance rule"} description="Enter the legal review reference to keep a clear audit record.">
        <form onSubmit={submitComplianceReview} className="space-y-4"><Input label="Legal review reference" required minLength={5} value={legalReviewReference} onChange={(event) => setLegalReviewReference(event.target.value)} placeholder="Reference, source, or case ID"/><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setComplianceReviewTarget(null)}>Cancel</Button><Button type="submit">{complianceReviewTarget?.decision === "validated" ? "Validate rule" : "Return for correction"}</Button></div></form>
      </Modal>
    </div>
  );
}
