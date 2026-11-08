import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Edit2,
  Archive,
  PlusCircle,
  Phone,
  Mail,
  MapPin,
  Target,
  Download,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => (id ? api.getCustomer(id) : null),
    enabled: Boolean(id),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: () => (id ? api.listInvoices({ customerId: id, limit: 10 }) : null),
    enabled: Boolean(id),
  });

  const { data: paymentsData } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: () => (id ? api.listPayments({ customerId: id, limit: 10 }) : null),
    enabled: Boolean(id),
  });

  const { data: commitments = [], isLoading: commitmentsLoading, isError: commitmentsError } = useQuery({
    queryKey: ["customer-commitments", id],
    queryFn: async () => {
      if (!id) return [];
      const rows: any[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await api.listCommitments({ customerId: id, page, limit: 100, sort: "-promisedDate" });
        rows.push(...result.data);
        total = result.meta?.total ?? rows.length;
        page += 1;
      } while (rows.length < total);
      return rows;
    },
    enabled: Boolean(id),
  });

  const { data: recoveryAssignments = [], isLoading: recoveryLoading, isError: recoveryError } = useQuery({
    queryKey: ["customer-recovery-activity", id],
    queryFn: async () => {
      if (!id) return [];
      const result = await api.listRecoveryAssignments({ customerId: id, page: 1, limit: 20, sort: "-createdAt" });
      return Promise.all(result.data.map(async (assignment: any) => ({
        ...assignment,
        visits: await api.listRecoveryVisits(assignment.id),
      })));
    },
    enabled: Boolean(id),
  });

  if (isLoading || !customer) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await api.archiveCustomer(id!);
      toast.success("Customer archived successfully");
      navigate("/customers");
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive customer");
    } finally {
      setIsArchiving(false);
      setArchiveModalOpen(false);
    }
  };

  const invoices = invoicesData?.data ?? [];
  const payments = paymentsData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/customers")}>
          <ArrowLeft className="h-4 w-4" />
          <span>Customers</span>
        </Button>
      </div>

      {/* Header Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {customer.displayName}
            </h1>
            <Badge variant={customer.status === "active" ? "success" : "neutral"}>
              {customer.status}
            </Badge>
          </div>
          {customer.companyName && (
            <p className="text-sm text-slate-600 mt-1">{customer.companyName}</p>
          )}
          {customer.gstin && (
            <p className="text-xs font-mono text-slate-500 mt-1">GSTIN: {customer.gstin}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to={`/invoices/new?customerId=${customer.id}`}>
            <Button size="sm">
              <PlusCircle className="h-4 w-4" />
              <span>New Invoice</span>
            </Button>
          </Link>
          <Link to={`/customers/${customer.id}/edit`}>
            <Button size="sm" variant="outline">
              <Edit2 className="h-4 w-4" />
              <span>Edit</span>
            </Button>
          </Link>
          {customer.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              onClick={() => setArchiveModalOpen(true)}
            >
              <Archive className="h-4 w-4" />
              <span>Archive</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grid: Contact & Terms Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Commercial Terms">
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Default Credit Days</span>
              <span className="font-semibold text-slate-700">
                {customer.defaultCreditDays} Days
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Credit Limit</span>
              <span className="font-semibold text-slate-700">
                {customer.creditLimitMinor
                  ? formatMoney(customer.creditLimitMinor)
                  : "Not Specified"}
              </span>
            </div>
            {customer.notes && (
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Notes:</span>
                <p className="text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {customer.notes}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Primary Contact">
          <div className="space-y-2.5 text-xs">
            {customer.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-slate-500" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-slate-500" />
                <span>{customer.email}</span>
              </div>
            )}
            {customer.billingAddress?.line1 && (
              <div className="flex items-start gap-2 text-slate-600 mt-2">
                <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <p>{customer.billingAddress.line1}</p>
                  <p>
                    {customer.billingAddress.city}, {customer.billingAddress.state}{" "}
                    {customer.billingAddress.postalCode}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Personnel Hierarchy">
          {(!customer.contacts || customer.contacts.length === 0) ? (
            <p className="text-xs text-slate-500 italic">No additional contacts listed.</p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {customer.contacts.map((c: any, i: number) => (
                <div key={i} className="border-b border-slate-50 pb-2 last:border-0">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  {c.designation && <p className="text-xs text-slate-500">{c.designation}</p>}
                  <div className="flex gap-3 text-xs text-slate-600 mt-1">
                    {c.phone && <span>{c.phone}</span>}
                    {c.email && <span>{c.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Linked Invoices */}
      <Card
        title="Recent Invoices"
        subtitle="Recent bills raised for this debtor"
        action={
          <Link
            to={`/invoices?customerId=${customer.id}`}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View All Invoices
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No invoices issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase font-semibold">
                  <th className="pb-2.5">Invoice #</th>
                  <th className="pb-2.5">Due Date</th>
                  <th className="pb-2.5 text-right">Amount</th>
                  <th className="pb-2.5 text-right">Outstanding</th>
                  <th className="pb-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open invoice ${inv.invoiceNumber}`}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/invoices/${inv.id}`);
                      }
                    }}
                    className="group cursor-pointer transition-colors hover:bg-indigo-50/70 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
                  >
                    <td className="py-2.5 font-medium">
                      <span className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2">{inv.invoiceNumber}</span>
                    </td>
                    <td className="py-2.5 text-slate-600">{inv.dueDate}</td>
                    <td className="py-2.5 text-right font-medium text-slate-700">
                      {formatMoney(inv.amountMinor)}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900">
                      {formatMoney(inv.outstandingMinor)}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant={inv.documentStatus}>{inv.documentStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Linked Payments */}
      <Card
        title="Payment Receipts"
        subtitle="Collections allocated to this customer"
        action={
          <Link
            to={`/payments?customerId=${customer.id}`}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View All Payments
          </Link>
        }
      >
        {payments.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No payment receipts recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase font-semibold">
                  <th className="pb-2.5">Ref #</th>
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5">Mode</th>
                  <th className="pb-2.5 text-right">Amount</th>
                  <th className="pb-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: any) => (
                  <tr
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Open payment ${p.paymentReference}`}
                    onClick={() => navigate(`/payments/${p.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/payments/${p.id}`);
                      }
                    }}
                    className="group cursor-pointer transition-colors hover:bg-indigo-50/70 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
                  >
                    <td className="py-2.5 font-medium">
                      <span className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2">{p.paymentReference}</span>
                    </td>
                    <td className="py-2.5 text-slate-600">{p.paymentDate}</td>
                    <td className="py-2.5 uppercase text-slate-600">{p.mode.replace("_", " ")}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-600">
                      {formatMoney(p.amountMinor)}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant={p.kind === "collection" ? "success" : "danger"}>
                        {p.kind}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Commitment activity" subtitle={`${commitments.length} promise${commitments.length === 1 ? "" : "s"} recorded`} action={commitments.length > 0 ? <Button size="sm" variant="outline" onClick={async () => {
        const { downloadCommitmentReportPdf } = await import("../../services/pdf.js");
        downloadCommitmentReportPdf(commitments, customer.displayName);
      }}><Download className="h-4 w-4" /><span>Download PDF report</span></Button> : undefined}>
        {commitmentsLoading ? <p className="py-2 text-sm font-medium text-slate-600">Loading commitment history…</p> : commitmentsError ? <p className="py-2 text-sm font-medium text-rose-700">Could not load commitment history.</p> : commitments.length === 0 ? <p className="py-2 text-sm font-medium text-slate-600">No commitments recorded for this customer.</p> : <div className="space-y-3">
          {commitments.slice(0, 10).map((item: any) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Link to={`/commitments/${item.id}`} className="font-semibold text-indigo-700 hover:underline">Promise due {item.promisedDate}</Link><Badge variant={item.status === "fulfilled" ? "success" : item.status === "missed" ? "danger" : "info"}>{item.status.replace(/_/g, " ")}</Badge></div>
              <p className="mt-1 text-sm font-semibold text-slate-800">Promised {formatMoney(item.promisedAmountMinor)} <span className="font-normal text-slate-600">· fulfilled {formatMoney(item.fulfilledAmountMinor)}</span></p>
              <p className="text-xs font-medium text-slate-600">Contact: {item.responsiblePerson || "Not recorded"}</p>
            </div>
            <div className="flex flex-wrap gap-2">{item.fileAssetIds?.map((fileId: string, index: number) => <EvidencePreviewButton key={fileId} fileId={fileId} label={index === 0 ? "View promise evidence" : `Evidence ${index + 1}`} />)}</div>
          </div>)}
          {commitments.length > 10 && <p className="text-xs font-medium text-slate-600">The PDF report includes all {commitments.length} commitments.</p>}
        </div>}
      </Card>

      <Card title="Recovery activity" subtitle="Assignments and field reports linked to this customer">
        {recoveryLoading ? <p className="text-sm font-medium text-slate-600">Loading recovery history…</p> : recoveryError ? <p className="py-2 text-sm font-medium text-rose-700">Could not load recovery history.</p> : recoveryAssignments.length === 0 ? <p className="py-2 text-sm font-medium text-slate-600">No recovery activity recorded for this customer.</p> : <div className="space-y-4">
          {recoveryAssignments.map((assignment: any) => <section key={assignment.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-indigo-600" /><Link to={`/recovery/${assignment.id}`} className="font-semibold text-indigo-700 hover:underline">Recovery assignment</Link><Badge variant={assignment.status === "fully_recovered" ? "success" : assignment.status === "closed" ? "neutral" : "info"}>{assignment.status.replace(/_/g, " ")}</Badge></div><span className="text-xs font-medium text-slate-600">Assigned {new Date(assignment.assignedOn).toLocaleDateString()}</span></div>
            <p className="mt-1 text-sm font-medium text-slate-700">{assignment.assignee?.name ? `Assigned to ${assignment.assignee.name}` : "No assignee"} · Priority {assignment.priority} · Balance {formatMoney(assignment.outstandingSnapshotMinor)}</p>
            {assignment.visits?.length > 0 && <div className="mt-3 space-y-3 border-l-2 border-indigo-100 pl-4">
              {assignment.visits.slice(0, 5).map((visit: any) => <div key={visit.id} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold capitalize text-slate-800">{visit.outcome.replace(/_/g, " ")}</p><span className="text-xs font-medium text-slate-600">{new Date(visit.visitedAt).toLocaleString()}</span></div>
                {visit.discussion && <p className="text-sm text-slate-700">{visit.discussion}</p>}
                {visit.location && <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${visit.location.lat},${visit.location.lng}`)}`} target="_blank" rel="noreferrer" className="inline-flex text-xs font-semibold text-indigo-700 underline">Open visit location in Maps</a>}
                <div className="flex flex-wrap gap-2">{visit.fileAssetIds?.map((fileId: string, index: number) => <EvidencePreviewButton key={fileId} fileId={fileId} label={index === 0 ? "View visit photo" : `Evidence ${index + 1}`} />)}</div>
              </div>)}
            </div>}
            {!assignment.visits?.length && <p className="mt-2 text-xs font-medium text-slate-600">No field reports recorded yet.</p>}
          </section>)}
          {recoveryAssignments.length === 20 && <Link to="/recovery" className="text-sm font-semibold text-indigo-700 underline">View all recovery assignments</Link>}
        </div>}
      </Card>

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Archive Customer"
        description="Are you sure you want to archive this customer account?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Archiving disables creating new invoices for this customer. Existing ledger history and past records will be preserved for audits.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setArchiveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" isLoading={isArchiving} onClick={handleArchive}>
              Confirm Archive
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
