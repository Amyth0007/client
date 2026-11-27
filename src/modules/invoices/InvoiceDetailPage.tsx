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
  Info,
  Pencil,
  History,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { DataTable } from "../../components/common/DataTable.js";
import { Paged, usePagination } from "../../components/common/Pagination.js";
import { Tabs } from "../../components/common/Tabs.js";
import { Input } from "../../components/common/Input.js";
import { TextArea } from "../../components/common/TextArea.js";
import { QueryError } from "../../components/common/QueryError.js";
import { FileUpload } from "../../components/common/FileUpload.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";
import { SendEmailModal } from "../gmail/SendEmailModal.js";
import { useAuth } from "../auth/AuthContext.js";
import { organizationModuleEnabled } from "../platform/module-registry.js";

export function InvoiceDetailPage() {
  const { user } = useAuth();
  const gmailEnabled = organizationModuleEnabled(user?.organization?.modules, "gmail");
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
  const [activeTab, setActiveTab] = useState<"activity" | "payments" | "acknowledgements">("activity");

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

  const ledgerPage = usePagination<any>(ledger, 10);

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

  const paidMinor = invoice.amountMinor - invoice.outstandingMinor;
  const customerName = invoice.customer?.displayName || invoice.partySnapshot?.displayName || "Customer";
  const termsLabel = invoice.termSource === "credit_days" ? `${invoice.creditDays ?? 0} days credit` : "Fixed due date";
  const summary = [
    { label: "Total", value: formatMoney(invoice.amountMinor), hint: termsLabel, className: "" },
    {
      label: "Balance due",
      value: invoice.outstandingMinor === 0 ? "Paid" : formatMoney(invoice.outstandingMinor),
      hint: paidMinor > 0 ? `Paid ${formatMoney(paidMinor)}` : "No payments yet",
      className: invoice.outstandingMinor === 0 ? "text-emerald-700" : "text-indigo-700",
    },
    { label: "Invoice date", value: invoice.invoiceDate, hint: `Updated ${new Date(invoice.updatedAt).toLocaleDateString()}`, className: "", mobileHidden: true },
    { label: "Due date", value: invoice.dueDate, hint: isOverdue ? "Overdue" : invoice.outstandingMinor === 0 ? "Settled" : "On schedule", className: isOverdue ? "text-rose-700" : "", hintClassName: isOverdue ? "font-semibold text-rose-600" : "" },
  ];

  return (
    <div className="space-y-4">
      {/* Compact header with key invoice details */}
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/invoices")}
              aria-label="Back to invoices"
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{invoice.invoiceNumber}</h1>
                <Badge variant={invoice.documentStatus}>{invoice.documentStatus}</Badge>
                {isOverdue && <Badge variant="overdue">Overdue</Badge>}
                {invoice.acknowledgementStatus !== "not_shared" && (
                  <Badge variant="info">{invoice.acknowledgementStatus.replace(/_/g, " ")}</Badge>
                )}
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-600 sm:text-sm">
                <Link to={`/customers/${invoice.customerId}`} className="truncate font-medium text-indigo-700 hover:underline">{customerName}</Link>
                <button type="button" onClick={() => setCustomerDetailsOpen(true)} aria-label="More invoice and customer details" title="More details" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-indigo-700">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Actions: primary action keeps its label; secondary actions collapse to icons on mobile */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:shrink-0 lg:justify-end">
            {invoice.documentStatus === "draft" && (
              <>
                <Button size="sm" onClick={handleIssue}>
                  <Sparkles className="h-4 w-4" />
                  <span>Issue invoice</span>
                </Button>
                <Link to={`/invoices/${invoice.id}/edit`}>
                  <Button size="sm" variant="outline" aria-label="Edit draft" title="Edit draft">
                    <Pencil className="h-4 w-4" /><span className="hidden sm:inline">Edit</span>
                  </Button>
                </Link>
              </>
            )}
            {invoice.documentStatus === "issued" && invoice.outstandingMinor > 0 && (
              <Link to={`/payments/new?customerId=${invoice.customerId}&invoiceId=${invoice.id}`}>
                <Button size="sm">
                  <CreditCard className="h-4 w-4" />
                  <span>Record payment</span>
                </Button>
              </Link>
            )}
            {invoice.documentStatus === "issued" && (
              <Button size="sm" variant="outline" aria-label="Update acknowledgement" title="Update acknowledgement" onClick={() => setAckModalOpen(true)}>
                <CheckCircle className="h-4 w-4" /><span className="hidden sm:inline">Acknowledgement</span>
              </Button>
            )}
            {gmailEnabled && (
              <Button size="sm" variant="outline" disabled={!invoice.customer} aria-label="Email invoice" title="Send this invoice through your connected Gmail account" onClick={() => setSendEmailOpen(true)}>
                <Mail className="h-4 w-4" /><span className="hidden sm:inline">Email</span>
              </Button>
            )}
            {invoice.primaryFileAssetId && <EvidencePreviewButton fileId={invoice.primaryFileAssetId} label="View uploaded document" buttonLabel="Document" compact />}
            <Button size="sm" variant="outline" aria-label="Download invoice PDF" title="Download invoice PDF" onClick={async () => { const { downloadInvoicePdf } = await import("../../services/pdf.js"); downloadInvoicePdf(invoice, ledger, ackHistory); }}>
              <Download className="h-4 w-4" /><span className="hidden sm:inline">PDF</span>
            </Button>
            {invoice.documentStatus === "issued" && invoice.outstandingMinor === invoice.amountMinor && (
              <Button size="sm" variant="ghost" aria-label="Cancel invoice" title="Cancel invoice" className="text-rose-600 hover:bg-rose-50" onClick={() => setCancelModalOpen(true)}>
                <XCircle className="h-4 w-4" /><span className="hidden sm:inline">Cancel</span>
              </Button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/60 sm:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label} className={`min-w-0 px-3 py-2.5 sm:px-4 ${item.mobileHidden ? "hidden sm:block" : ""}`}>
              <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">{item.label}</dt>
              <dd className={`mt-0.5 truncate text-sm font-bold text-slate-900 sm:text-base ${item.className}`}>{item.value}</dd>
              <dd className={`truncate text-[10px] text-slate-500 sm:text-[11px] ${item.hintClassName ?? ""}`}>{item.hint}</dd>
            </div>
          ))}
        </dl>
      </header>

      {gmailEnabled && invoice.customer && <SendEmailModal
        key={`${invoice.id}-${invoice.customer.id}`}
        isOpen={sendEmailOpen}
        onClose={() => setSendEmailOpen(false)}
        customer={invoice.customer}
        invoice={invoice}
      />}

      <Tabs
        variant="underline"
        ariaLabel="Invoice sections"
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as typeof activeTab)}
        className="px-1"
        tabs={[
          { id: "activity", label: "Activity", icon: History, count: invoiceFlow.length },
          { id: "payments", label: "Payments", icon: CreditCard, count: ledger.length },
          { id: "acknowledgements", label: "Acknowledgements", icon: CheckCircle, count: ackHistory.length },
        ]}
      />

      {activeTab === "activity" && (
        <Card contentClassName="p-4 sm:p-5">
          {invoiceFlow.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No activity recorded yet.</p> : (
            <Paged items={invoiceFlow} initialPageSize={10}>
              {(pageItems) => (
                <ol className="space-y-3">
                  {pageItems.map((event: any) => {
                    const content = <>
                      <span className="-ml-[21px] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 ring-4 ring-white" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"><p className="text-sm font-semibold capitalize text-slate-900">{event.title}</p><time className="text-[11px] text-slate-500">{new Date(event.date).toLocaleString()}</time></div>
                        <p className="mt-0.5 break-words text-xs text-slate-600">{event.detail}</p>
                      </div>
                      {event.amount != null && <span className={`shrink-0 text-sm font-semibold ${event.amount < 0 ? "text-emerald-700" : "text-slate-800"}`}>{event.amount > 0 ? "+" : ""}{formatMoney(event.amount)}</span>}
                    </>;
                    return <li key={event.id} className={`border-l-2 border-indigo-100 pl-4 ${event.paymentId ? "group" : ""}`}>
                      {event.paymentId
                        ? <Link to={`/payments/${event.paymentId}`} aria-label={`Open payment ${event.detail.replace(/^Payment /, "")}`} className="flex min-w-0 items-start gap-3 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 group-hover:text-indigo-900">{content}</Link>
                        : <div className="flex min-w-0 items-start gap-3 py-1">{content}</div>}
                    </li>;
                  })}
                </ol>
              )}
            </Paged>
          )}
        </Card>
      )}

      {activeTab === "payments" && (
        ledger.length === 0 ? (
          <Card contentClassName="p-4 sm:p-5"><p className="py-6 text-center text-xs text-slate-500">No ledger entries posted yet. Entries appear once the invoice is issued.</p></Card>
        ) : (
          <DataTable
            rows={ledgerPage.pageItems}
            rowKey={(entry: any) => entry.id}
            onRowClick={(entry: any) => navigate(`/payments/${entry.payment.id}`)}
            isRowClickable={(entry: any) => Boolean(entry.payment?.id)}
            rowLabel={(entry: any) => `Open payment ${entry.payment?.reference || ""}`.trim()}
            pagination={{ page: ledgerPage.page, pageSize: ledgerPage.pageSize, total: ledgerPage.total, onPageChange: ledgerPage.setPage, onPageSizeChange: ledgerPage.setPageSize }}
            columns={[
              { key: "date", header: "Date", className: "whitespace-nowrap", cell: (entry: any) => entry.effectiveDate },
              { key: "type", header: "Event", cell: (entry: any) => <span className="font-medium capitalize text-slate-800">{entry.type.replace(/_/g, " ")}</span> },
              { key: "ref", header: "Payment ref", className: "hidden sm:table-cell", cell: (entry: any) => entry.payment?.id ? <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">{entry.payment?.reference || "Payment"}<ArrowUpRight className="h-3.5 w-3.5 shrink-0" /></span> : "—" },
              { key: "by", header: "Recorded by", className: "hidden md:table-cell", cell: (entry: any) => entry.recordedBy?.name || "System" },
              { key: "amount", header: "Amount", align: "right", className: "whitespace-nowrap", cell: (entry: any) => <span className={`font-semibold ${entry.amountMinor < 0 ? "text-emerald-700" : "text-slate-900"}`}>{entry.amountMinor > 0 ? "+" : ""}{formatMoney(entry.amountMinor)}</span> },
            ]}
          />
        )
      )}

      {activeTab === "acknowledgements" && (
        <Card contentClassName="p-4 sm:p-5">
          {ackHistory.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No acknowledgement events recorded.</p>
          ) : (
            <Paged items={ackHistory} initialPageSize={10}>
              {(pageItems) => (
                <div className="space-y-2.5">
                  {pageItems.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold capitalize text-slate-900">{item.status.replace(/_/g, " ")}</span>
                          <span className="text-[11px] text-slate-500">{new Date(item.eventAt).toLocaleDateString()}</span>
                        </div>
                        {item.responsiblePersonName && (
                          <p className="mt-0.5 text-slate-600">
                            Person: {item.responsiblePersonName}{item.responsiblePersonDesignation ? ` (${item.responsiblePersonDesignation})` : ""}
                          </p>
                        )}
                        {item.remarks && <p className="mt-0.5 break-words italic text-slate-600">{item.remarks}</p>}
                        {item.files?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.files.map((file: any) => <EvidencePreviewButton key={file.id} fileId={file.id} label={`View signed invoice${file.originalFilename ? `: ${file.originalFilename}` : ""}`} buttonLabel="Signed invoice" />)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Paged>
          )}
        </Card>
      )}

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

      <Modal isOpen={customerDetailsOpen} onClose={() => setCustomerDetailsOpen(false)} title="Invoice details" description={`${invoice.invoiceNumber} · ${customerName}`}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Customer</dt><dd className="font-medium text-slate-900"><Link to={`/customers/${invoice.customerId}`} className="text-indigo-700 hover:underline">{customerName}</Link></dd></div>
          {(invoice.customer?.companyName || invoice.partySnapshot?.companyName) && <div><dt className="text-xs text-slate-500">Company</dt><dd className="text-slate-800">{invoice.customer?.companyName || invoice.partySnapshot?.companyName}</dd></div>}
          {invoice.customer?.email && <div className="min-w-0"><dt className="text-xs text-slate-500">Email</dt><dd className="break-all text-slate-800">{invoice.customer.email}</dd></div>}
          {invoice.customer?.phone && <div><dt className="text-xs text-slate-500">Phone</dt><dd className="text-slate-800">{invoice.customer.phone}</dd></div>}
          {(invoice.customer?.gstin || invoice.partySnapshot?.gstin) && <div><dt className="text-xs text-slate-500">GSTIN</dt><dd className="text-slate-800">{invoice.customer?.gstin || invoice.partySnapshot?.gstin}</dd></div>}
          {(invoice.customer?.billingAddress?.line1 || invoice.partySnapshot?.billingAddress?.line1) && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Billing address</dt><dd className="text-slate-800">{[invoice.customer?.billingAddress?.line1 || invoice.partySnapshot?.billingAddress?.line1, invoice.customer?.billingAddress?.city || invoice.partySnapshot?.billingAddress?.city].filter(Boolean).join(", ")}</dd></div>}
          <div><dt className="text-xs text-slate-500">Payment terms</dt><dd className="text-slate-800">{termsLabel}</dd></div>
          <div><dt className="text-xs text-slate-500">Invoice date</dt><dd className="text-slate-800">{invoice.invoiceDate}</dd></div>
          {invoice.notes && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Internal notes</dt><dd className="whitespace-pre-wrap text-slate-800">{invoice.notes}</dd></div>}
        </dl>
      </Modal>

      {/* Acknowledgement Transition Modal */}
      <Modal
        isOpen={ackModalOpen}
        onClose={() => setAckModalOpen(false)}
        title="Update Invoice Acknowledgement"
        description="Record delivery confirmation or invoice dispute"
      >
        <div className="space-y-4">
          <CustomSelect
            label="New Acknowledgement Status"
            required
            value={ackStatus}
            onChange={(e: any) => { setAckStatus(e.target.value); setAckFileAssetId(null); }}
            options={[
              { value: "shared", label: "Shared with Customer" },
              { value: "acknowledged", label: "Customer Acknowledged" },
              { value: "rejected", label: "Acknowledgement Rejected" },
              { value: "disputed", label: "Customer Disputed" },
            ]}
          />
          {ackStatus === "acknowledged" && (
            <div>
              <FileUpload purpose="acknowledgement_evidence" label="Customer-signed invoice photo (required)" onUploaded={setAckFileAssetId} />
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
