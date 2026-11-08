import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Building2, Plus } from "lucide-react";
import { api } from "../../services/api-client.js";
import { Badge } from "../../components/common/Badge.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { EmptyState } from "../../components/common/EmptyState.js";
import { Input } from "../../components/common/Input.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Modal } from "../../components/common/Modal.js";
import { TextArea } from "../../components/common/TextArea.js";

type Organization = {
  id: string;
  name: string;
  legalName: string;
  status: "active" | "suspended" | "deactivated";
  timezone: string;
  createdAt: string;
  usage: { userCount: number; invoiceCount: number; storageBytes: number };
};

const initialForm = { name: "", legalName: "", adminName: "", email: "", password: "" };

export function PlatformAdminPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [statusTarget, setStatusTarget] = useState<Organization | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform-organizations"],
    queryFn: () => api.listOrganizations({ page: "1", limit: "100", sort: "-createdAt" }),
  });
  const organizations = (data?.data ?? []) as Organization[];

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

      <Card title="Organizations" subtitle={`${data?.meta?.total ?? organizations.length} organizations`}>
        {isLoading ? <p className="text-sm text-slate-600">Loading organizations…</p> : isError ? (
          <p className="text-sm text-rose-600">Could not load organizations. Refresh and try again.</p>
        ) : organizations.length === 0 ? (
          <EmptyState icon={Building2} title="No organizations yet" description="Create an organization to onboard your first customer." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600"><th className="pb-3">Organization</th><th className="pb-3">Users</th><th className="pb-3">Created</th><th className="pb-3">Status</th><th className="pb-3 text-right">Action</th></tr></thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-4"><p className="font-medium text-slate-900">{organization.name}</p>{organization.legalName && <p className="text-xs text-slate-600">{organization.legalName}</p>}</td>
                    <td className="py-4 text-slate-600">{organization.usage?.userCount ?? 0}</td>
                    <td className="py-4 text-slate-600">{new Date(organization.createdAt).toLocaleDateString()}</td>
                    <td className="py-4"><Badge variant={organization.status === "active" ? "success" : "warning"}>{organization.status}</Badge></td>
                    <td className="py-4 text-right">{organization.status !== "deactivated" && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => changeStatus(organization)}>{organization.status === "active" ? "Suspend" : "Activate"}</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal isOpen={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} title={statusTarget?.status === "active" ? "Suspend organization" : "Activate organization"} description={statusTarget?.name}>
        <form onSubmit={submitStatusChange} className="space-y-4">
          <TextArea label="Reason" required minLength={3} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder="Explain why the organization status is changing" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button type="submit" isLoading={statusMutation.isPending}>Confirm status change</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
