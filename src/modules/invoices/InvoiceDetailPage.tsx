import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Sparkles,
  CreditCard,
  XCircle,
  Download,
  CheckCircle,
  Mail,
  ArrowUpRight,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { Select } from "../../components/common/Select.js";
import { Input } from "../../components/common/Input.js";
import { TextArea } from "../../components/common/TextArea.js";
import { QueryError } from "../../components/common/QueryError.js";
import { FileUpload } from "../../components/common/FileUpload.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";
import { SendEmailModal } from "../gmail/SendEmailModal.js";

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const [ackModalOpen, setAckModalOpen] = useState(false);
  const [ackStatus, setAckStatus] = useState("shared");
  const [ackPerson, setAckPerson] = useState("");
  const [ackRemarks, setAckRemarks] = useState("");
  const [ackFileAssetId, setAckFileAssetId] = useState<string | null>(null);
  const [isUpdatingAck, setIsUpdatingAck] = useState(false);
  const [customerDetailsOpen, setCustomerDetailsOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);

  const { data: invoice, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => (id ? api.getInvoice(id) : null),
    enabled: Boolean(id),
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["invoice-ledger", id],
    queryFn: () => (id ? api.getInvoiceLedger(id) : []),
    enabled: Boolean(id && invoice?.documentStatus !== "draft"),
  });

  const { data: ackHistory = [] } = useQuery({
    queryKey: ["invoice-ack-history", id],
    queryFn: () => (id ? api.getAcknowledgementHistory(id) : []),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  if (isError || !invoice) {
    return <QueryError message={error instanceof Error ? error.message : "Invoice could not be loaded."} onRetry={() => void refetch()} />;
  }

  const handleIssue = async () => {
    try {
      await api.issueInvoice(id!);
      toast.success("Invoice issued and ledger posted!");
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-ledger", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to issue invoice");
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }
    setIsCancelling(true);
    try {
      await api.cancelInvoice(id!, cancelReason);
      toast.success("Invoice cancelled successfully");
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-ledger", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel invoice");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateAck = async () => {
    if (ackStatus === "acknowledged" && !ackFileAssetId) {
      toast.error("Upload the customer-signed invoice first");
      return;
    }
    setIsUpdatingAck(true);
    try {
      await api.updateAcknowledgement(id!, {
        status: ackStatus,
        responsiblePersonName: ackPerson,
        remarks: ackRemarks,
        fileAssetIds: ackFileAssetId ? [ackFileAssetId] : [],
      });
      toast.success("Acknowledgement updated");
      setAckModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-ack-history", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update acknowledgement");
    } finally {
      setIsUpdatingAck(false);
    }
  };

  const isOverdue =
    invoice.documentStatus === "issued" &&
    invoice.outstandingMinor > 0 &&
    invoice.dueDate < new Date().toISOString().slice(0, 10);
  const invoiceFlow = [
    { id: `created-${invoice.id}`, date: invoice.createdAt, title: "Invoice created", detail: "Draft entered in the system", amount: null },
    ...ledger.map((entry: any) => ({ id: `ledger-${entry.id}`, date: entry.effectiveDate, title: entry.type.replace(/_/g, " "), detail: entry.payment?.reference ? `Payment ${entry.payment.reference}` : `Recorded by ${entry.recordedBy?.name || "System"}`, amount: entry.amountMinor, paymentId: entry.payment?.id })),
    ...ackHistory.map((item: any) => ({ id: `ack-${item.id}`, date: item.eventAt, title: `Customer ${item.status.replace(/_/g, " ")}`, detail: item.responsiblePersonName ? `Confirmed by ${item.responsiblePersonName}` : (item.remarks || "Acknowledgement updated"), amount: null })),
  ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" />
          <span>Invoices</span>
        </Button>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {invoice.invoiceNumber}
            </h1>
            <Badge variant={invoice.documentStatus}>{invoice.documentStatus}</Badge>
            {isOverdue && <Badge variant="overdue">Overdue</Badge>}
            {invoice.acknowledgementStatus !== "not_shared" && (
              <Badge variant="info">{invoice.acknowledgementStatus.replace("_", " ")}</Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Debtor:{" "}
            <Link
              to={`/customers/${invoice.customerId}`}
              className="text-indigo-600 font-medium hover:underline"
            >
              {invoice.customer?.displayName || "Customer"}
            </Link>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={!invoice.customer} title="Send this invoice through your connected Gmail account" onClick={() => setSendEmailOpen(true)}>
            <Mail className="h-4 w-4" /><span>Email invoice</span>
          </Button>
          {invoice.documentStatus === "draft" && (
            <>
              <Link to={`/invoices/${invoice.id}/edit`}>
                <Button size="sm" variant="outline">
                  Edit Draft
                </Button>
              </Link>
              <Button size="sm" onClick={handleIssue}>
                <Sparkles className="h-4 w-4" />
                <span>Issue & Post Ledger</span>
              </Button>
            </>
          )}

          {invoice.documentStatus === "issued" && (
            <>
              {invoice.outstandingMinor > 0 && (
                <Link to={`/payments/new?customerId=${invoice.customerId}&invoiceId=${invoice.id}`}>
                  <Button size="sm">
                    <CreditCard className="h-4 w-4" />
                    <span>Record Payment</span>
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="outline" onClick={() => setAckModalOpen(true)}>
                <span>Acknowledgement</span>
              </Button>
              {invoice.outstandingMinor === invoice.amountMinor && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => setCancelModalOpen(true)}
                >
                  <XCircle className="h-4 w-4" />
                  <span>Cancel</span>
                </Button>
              )}
            </>
          )}

          {invoice.primaryFileAssetId && <EvidencePreviewButton fileId={invoice.primaryFileAssetId} label="View uploaded document" />}
          <Button size="sm" variant="outline" onClick={async () => { const { downloadInvoicePdf } = await import("../../services/pdf.js"); downloadInvoicePdf(invoice, ledger, ackHistory); }}>
            <Download className="h-4 w-4" /><span>Download invoice PDF</span>
          </Button>
        </div>
      </div>

      {invoice.customer && <SendEmailModal
        key={`${invoice.id}-${invoice.customer.id}`}
        isOpen={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        customer={invoice.customer}
        invoice={invoice}
      />}

      {/* Financial Details Grid */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Invoice Principal</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {formatMoney(invoice.amountMinor)}
          </p>
          <p className="text-xs text-slate-600 mt-1">Invoice Date: {invoice.invoiceDate}</p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Live Outstanding</p>
          <p
            className={`mt-2 break-words text-xl font-bold leading-tight sm:text-2xl ${
              invoice.outstandingMinor === 0 ? "text-emerald-600" : "text-indigo-600"
            }`}
          >
            {invoice.outstandingMinor === 0 ? "PAID" : formatMoney(invoice.outstandingMinor)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Paid: {formatMoney(invoice.amountMinor - invoice.outstandingMinor)}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Due Date Status</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{invoice.dueDate}</p>
          <p className={`text-xs mt-1 ${isOverdue ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
            {isOverdue ? "Payment Overdue" : "On schedule"}
          </p>
        </div>
      </div>

      {/* Key invoice terms */}
      <div className="grid grid-cols-1">
        <Card title="Invoice details" subtitle="Key dates and payment terms">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-xs">
            <div><dt className="text-slate-500">Invoice date</dt><dd className="mt-1 font-medium text-slate-800">{invoice.invoiceDate}</dd></div>
            <div><dt className="text-slate-500">Due date</dt><dd className="mt-1 font-medium text-slate-800">{invoice.dueDate}</dd></div>
            <div><dt className="text-slate-500">Payment terms</dt><dd className="mt-1 font-medium text-slate-800">{invoice.termSource === "credit_days" ? `${invoice.creditDays ?? 0} days` : "Fixed due date"}</dd></div>
            <div><dt className="text-slate-500">Last updated</dt><dd className="mt-1 font-medium text-slate-800">{new Date(invoice.updatedAt).toLocaleDateString()}</dd></div>
          </dl>
        </Card>
      </div>

      <Card title="Invoice activity" subtitle="A single view of invoice creation, customer responses, and balance changes">
        {invoiceFlow.length === 0 ? <p className="py-3 text-xs text-slate-600">No activity recorded yet.</p> : <ol className="space-y-3">
          {invoiceFlow.map((event: any) => {
            const content = <>
              <span className="-ml-[21px] mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 ring-4 ring-white" />
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="text-sm font-semibold capitalize text-slate-900">{event.title}</p><time className="text-xs text-slate-500">{new Date(event.date).toLocaleString()}</time></div>
                <p className="mt-0.5 text-xs text-slate-600">{event.detail}</p>
              </div>
              {event.amount != null && <span className={`shrink-0 text-sm font-semibold ${event.amount < 0 ? "text-emerald-700" : "text-slate-800"}`}>{event.amount > 0 ? "+" : ""}{formatMoney(event.amount)}</span>}
            </>;

            return <li key={event.id} className={`border-l-2 border-indigo-100 pl-4 ${event.paymentId ? "group" : ""}`}>
              {event.paymentId
                ? <Link to={`/payments/${event.paymentId}`} aria-label={`Open payment ${event.detail.replace(/^Payment /, "")}`} className="flex min-w-0 items-start gap-3 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 group-hover:text-indigo-900">{content}</Link>
                : <div className="flex min-w-0 items-start gap-3 py-1">{content}</div>}
            </li>;
          })}
        </ol>}
      </Card>

      {/* Ledger History (Immutable) */}
      <Card
        title="Payment history"
        subtitle="Posted payments and balance adjustments"
      >
        {ledger.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No ledger entries posted yet. (Available once invoice is issued).
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto overscroll-x-contain px-5 sm:mx-0 sm:px-0">
            <table className="min-w-[640px] w-full text-left text-[11px] sm:min-w-full sm:text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase font-semibold">
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5">Event Type</th>
                  <th className="pb-2.5">Payment Ref</th>
                  <th className="pb-2.5 text-right">Amount Delta</th>
                  <th className="pb-2.5">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry: any) => {
                  const paymentId = entry.payment?.id as string | undefined;
                  const paymentLabel = entry.payment?.reference || "payment";
                  return <tr
                    key={entry.id}
                    role={paymentId ? "link" : undefined}
                    tabIndex={paymentId ? 0 : undefined}
                    aria-label={paymentId ? `Open payment ${paymentLabel}` : undefined}
                    onClick={paymentId ? () => navigate(`/payments/${paymentId}`) : undefined}
                    onKeyDown={paymentId ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/payments/${paymentId}`);
                      }
                    } : undefined}
                    className={`transition-colors ${paymentId ? "group cursor-pointer hover:bg-indigo-50/70 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600" : "hover:bg-slate-50"}`}
                  >
                    <td className="py-2.5 text-slate-600">{entry.effectiveDate}</td>
                    <td className="py-2.5 font-medium uppercase text-slate-700">
                      {entry.type.replace("_", " ")}
                    </td>
                    <td className="py-2.5 text-slate-600">
                      {paymentId ? <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2">{paymentLabel}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></span> : "—"}
                    </td>
                    <td
                      className={`py-2.5 text-right font-bold ${
                        entry.amountMinor < 0 ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {entry.amountMinor > 0 ? "+" : ""}
                      {formatMoney(entry.amountMinor)}
                    </td>
                    <td className="py-2.5 text-slate-500">{entry.recordedBy?.name || "System"}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Acknowledgement History */}
      <Card
        title="Acknowledgement History"
        subtitle="Proof of invoice delivery and debtor verification"
      >
        {ackHistory.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No acknowledgement events recorded.
          </p>
        ) : (
          <div className="space-y-3">
            {ackHistory.map((item: any) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
              >
                <div className="mt-0.5">
                  <CheckCircle className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize text-slate-900">
                      {item.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(item.eventAt).toLocaleDateString()}
                    </span>
                  </div>
                  {item.responsiblePersonName && (
                    <p className="text-slate-600 mt-0.5">
                      Person: {item.responsiblePersonName} ({item.responsiblePersonDesignation})
                    </p>
                  )}
                  {item.remarks && <p className="text-slate-600 italic mt-0.5">{item.remarks}</p>}
                  {item.files?.map((file: any) => <div key={file.id} className="mt-2"><EvidencePreviewButton fileId={file.id} label={`View signed invoice${file.originalFilename ? `: ${file.originalFilename}` : ""}`} /></div>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Additional information" subtitle="Customer details and internal notes">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <div className="min-w-0 text-sm"><p className="text-xs text-slate-600">Customer</p><Link to={`/customers/${invoice.customerId}`} className="truncate font-semibold text-indigo-700 hover:underline">{invoice.customer?.displayName || invoice.partySnapshot?.displayName || "Customer"}</Link></div>
            <button className="shrink-0 text-xs font-medium text-indigo-600 hover:underline" onClick={() => setCustomerDetailsOpen(true)}>View details</button>
          </section>
          <section className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <p className="text-xs text-slate-600">Internal notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{invoice.notes || "No internal notes."}</p>
          </section>
        </div>
      </Card>

      {/* Cancellation Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Invoice"
        description="Cancellation writes an inverse ledger entry and zeros the receivable"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Cancellation is only permitted when no active payments have been posted. A reason is required.
          </p>
          <TextArea
            label="Cancellation Reason"
            required
            placeholder="e.g. Raised in error, customer renegotiated order..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Back
            </Button>
            <Button variant="danger" isLoading={isCancelling} onClick={handleCancel}>
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={customerDetailsOpen} onClose={() => setCustomerDetailsOpen(false)} title="Customer details" description={invoice.customer?.displayName || invoice.partySnapshot?.displayName || "Customer"}>
        <div className="space-y-3 text-sm">
          {(invoice.customer?.companyName || invoice.partySnapshot?.companyName) && <p><span className="text-slate-600">Company:</span> {invoice.customer?.companyName || invoice.partySnapshot?.companyName}</p>}
          {(invoice.customer?.email) && <p><span className="text-slate-600">Email:</span> {invoice.customer.email}</p>}
          {invoice.customer?.phone && <p><span className="text-slate-600">Phone:</span> {invoice.customer.phone}</p>}
          {(invoice.customer?.gstin || invoice.partySnapshot?.gstin) && <p><span className="text-slate-600">GSTIN:</span> {invoice.customer?.gstin || invoice.partySnapshot?.gstin}</p>}
          {(invoice.customer?.billingAddress?.line1 || invoice.partySnapshot?.billingAddress?.line1) && <p className="text-slate-700"><span className="text-slate-600">Billing address:</span> {invoice.customer?.billingAddress?.line1 || invoice.partySnapshot?.billingAddress?.line1}, {invoice.customer?.billingAddress?.city || invoice.partySnapshot?.billingAddress?.city}</p>}
        </div>
      </Modal>

      {/* Acknowledgement Transition Modal */}
      <Modal
        isOpen={ackModalOpen}
        onClose={() => setAckModalOpen(false)}
        title="Update Invoice Acknowledgement"
        description="Record delivery confirmation or invoice dispute"
      >
        <div className="space-y-4">
          <Select
            label="New Acknowledgement Status"
            value={ackStatus}
            onChange={(e) => { setAckStatus(e.target.value); setAckFileAssetId(null); }}
            options={[
              { value: "shared", label: "Shared with Customer" },
              { value: "acknowledged", label: "Customer Acknowledged" },
              { value: "rejected", label: "Acknowledgement Rejected" },
              { value: "disputed", label: "Customer Disputed" },
            ]}
          />
          {ackStatus === "acknowledged" && (
            <div>
              <FileUpload purpose="acknowledgement_evidence" label="Customer-signed invoice image (required)" accept="image/*" onUploaded={setAckFileAssetId} />
              {!ackFileAssetId && <p className="mt-1 text-xs text-rose-600">Attach the signed invoice before saving.</p>}
            </div>
          )}
          <Input
            label="Responsible Person Name"
            placeholder="Customer representative who confirmed"
            value={ackPerson}
            onChange={(e) => setAckPerson(e.target.value)}
          />
          <TextArea
            label="Remarks / Evidence Note"
            placeholder="Signed delivery challan ref, email timestamp..."
            value={ackRemarks}
            onChange={(e) => setAckRemarks(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAckModalOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={isUpdatingAck} onClick={handleUpdateAck}>
              Save Acknowledgement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
