import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  PlusCircle,
  MapPin,
  CheckCircle2,
  Navigation,
  PhoneCall,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { useAuth } from "../auth/AuthContext.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { TextArea } from "../../components/common/TextArea.js";
import { MoneyInput } from "../../components/common/MoneyInput.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";
import { VisitEvidenceCapture } from "./VisitEvidenceCapture.js";

export function RecoveryDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("in_progress");
  const [closeReason, setCloseReason] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Visit Form State
  const [visitData, setVisitData] = useState({
    contactPersonName: "",
    contactDesignation: "",
    outcome: "promised_payment",
    discussion: "",
    nonPaymentReason: "",
    promisedDate: "",
    promisedAmountMinor: 0,
    fileAssetId: null as string | null,
    location: null as { lat: number; lng: number; accuracyMeters?: number } | null,
    remarks: "",
  });
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [isRecordingVisit, setIsRecordingVisit] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["recovery-assignment", id],
    queryFn: () => (id ? api.getRecoveryAssignment(id) : null),
    enabled: Boolean(id),
  });

  const assignment = data?.assignment;
  const visits = data?.visits ?? [];

  const callAttemptMutation = useMutation({
    mutationFn: (invoiceId: string) => api.recordRecoveryCallAttempt(id!, invoiceId),
    onSuccess: (result) => {
      queryClient.setQueryData(["recovery-assignment", id], (current: typeof data) => current ? ({
        ...current,
        assignment: {
          ...current.assignment,
          invoices: current.assignment.invoices.map((invoice: { id: string; callAttemptCount?: number }) => invoice.id === result.invoiceId
            ? { ...invoice, callAttemptCount: result.callAttemptCount }
            : invoice),
        },
      }) : current);
      window.location.href = `tel:${result.phone}`;
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !assignment) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setIsCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVisitData((prev) => ({
          ...prev,
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy),
          },
        }));
        setIsCapturingGps(false);
        toast.success("GPS Location captured!");
      },
      (err) => {
        setIsCapturingGps(false);
        toast.error(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleRecordVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitData.contactPersonName || !visitData.discussion) {
      toast.error("Contact person and discussion notes are required");
      return;
    }
    if (!visitData.location || !visitData.fileAssetId) {
      toast.error("Capture GPS and upload a visit photo before submitting");
      return;
    }

    setIsRecordingVisit(true);
    try {
      await api.createRecoveryVisit(id!, {
        contactPersonName: visitData.contactPersonName,
        contactDesignation: visitData.contactDesignation || undefined,
        outcome: visitData.outcome,
        discussion: visitData.discussion,
        nonPaymentReason: visitData.nonPaymentReason || undefined,
        promisedDate: visitData.promisedDate || undefined,
        promisedAmountMinor:
          visitData.promisedAmountMinor > 0 ? visitData.promisedAmountMinor : undefined,
        fileAssetIds: visitData.fileAssetId ? [visitData.fileAssetId] : [],
        location: visitData.location || undefined,
        remarks: visitData.remarks || undefined,
      });

      // If a promise was made, automatically create a commitment as well
      if (visitData.outcome === "promised_payment" && visitData.promisedDate && visitData.promisedAmountMinor > 0) {
        try {
          await api.createCommitment({
            customerId: assignment.customerId,
            invoiceIds: assignment.invoices.map((inv: any) => inv.id),
            promisedAmountMinor: visitData.promisedAmountMinor,
            promisedDate: visitData.promisedDate,
            delayReason: visitData.nonPaymentReason || "Agreed upon during recovery visit",
            responsiblePerson: visitData.contactPersonName,
            fileAssetIds: visitData.fileAssetId ? [visitData.fileAssetId] : [],
          });
        } catch {
          // ignore commitment auto-create errors
        }
      }

      toast.success("Visit report recorded successfully!");
      setVisitModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["recovery-assignment", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to record visit");
    } finally {
      setIsRecordingVisit(false);
    }
  };

  const handleUpdateStatus = async () => {
    setIsUpdatingStatus(true);
    try {
      await api.updateRecoveryStatus(id!, {
        status: newStatus,
        closeReason: newStatus === "closed" ? closeReason : undefined,
      });
      toast.success("Assignment status updated");
      setStatusModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["recovery-assignment", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const outcomeOptions = [
    { value: "promised_payment", label: "Promised Payment (Commitment Given)" },
    { value: "partial_payment_received", label: "Partial Payment Collected on Spot" },
    { value: "payment_already_made", label: "Debtor Claims Payment Already Made" },
    { value: "additional_time_requested", label: "Additional Grace Time Requested" },
    { value: "payment_refused", label: "Payment Refused" },
    { value: "invoice_dispute", label: "Invoice Dispute Raised" },
    { value: "goods_service_issue", label: "Quality / Service Issue Claimed" },
    { value: "person_unavailable", label: "Responsible Authority Unavailable" },
    { value: "business_closed", label: "Debtor Business Closed / Relocated" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/recovery")}>
          <ArrowLeft className="h-4 w-4" />
          <span>Recovery</span>
        </Button>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {assignment.customer?.displayName || "Customer"}
            </h1>
            <Badge variant={assignment.priority === "high" ? "danger" : "neutral"}>
              {assignment.priority}
            </Badge>
            <Badge variant="info">{assignment.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Assignee Executive:{" "}
            <span className="font-semibold text-slate-700">
              {assignment.assignee?.name || "Unassigned"}
            </span>
          </p>
          <p className="text-xs text-slate-500 mt-1">Customer phone: {assignment.customer?.phone || "Not available — add a phone number to the customer record to enable calling."}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setVisitModalOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            <span>Record Visit Report</span>
          </Button>

          {user?.role !== "field_recovery" && user?.role !== "employee" && (
            <Button size="sm" variant="outline" onClick={() => setStatusModalOpen(true)}>
              <span>Update Status</span>
            </Button>
          )}
        </div>
      </div>

      {/* Parameters Overview */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Target Balance</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {formatMoney(assignment.outstandingSnapshotMinor)}
          </p>
          <p className="text-xs text-slate-600 mt-1">Assigned on: {assignment.assignedOn}</p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Visit Deadline</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-rose-700 sm:text-2xl">{assignment.visitDeadline}</p>
          <p className="text-xs text-slate-600 mt-1">Priority: {assignment.priority}</p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Visits Completed</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-indigo-700 sm:text-2xl">{visits.length}</p>
          <p className="text-xs text-slate-600 mt-1">Historical field visits</p>
        </div>
      </div>

      {/* Linked Invoices & Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Assigned Overdue Invoices">
          <div className="space-y-2">
            {assignment.invoices.map((inv: any) => {
              const canOpenInvoice = user?.role !== "field_recovery" && user?.role !== "employee";
              const openInvoice = () => navigate(`/invoices/${inv.id}`);
              return <div
                key={inv.id}
                role={canOpenInvoice ? "link" : undefined}
                tabIndex={canOpenInvoice ? 0 : undefined}
                aria-label={canOpenInvoice ? `Open invoice ${inv.invoiceNumber}` : undefined}
                onClick={canOpenInvoice ? openInvoice : undefined}
                onKeyDown={canOpenInvoice ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openInvoice();
                  }
                } : undefined}
                className={`flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs transition-colors ${canOpenInvoice ? "group cursor-pointer hover:bg-indigo-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600" : ""}`}
              >
                <div>
                  <span className={canOpenInvoice ? "font-bold text-indigo-700 underline decoration-indigo-300 underline-offset-2" : "font-bold text-slate-700"}>{inv.invoiceNumber}</span>
                  <p className="text-slate-500 mt-0.5">Due Date: {inv.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{formatMoney(inv.outstandingMinor)}</span>
                    <span className="block text-xs text-slate-500">Total: {formatMoney(inv.amountMinor)}</span>
                    <span className="block text-xs text-slate-500">Call attempts: {inv.callAttemptCount ?? 0}</span>
                  </div>
                  <Button size="sm" variant="outline" disabled={!assignment.customer?.phone || callAttemptMutation.isPending} isLoading={callAttemptMutation.isPending} onClick={(event) => { event.stopPropagation(); callAttemptMutation.mutate(inv.id); }}>
                    <PhoneCall className="h-3.5 w-3.5" />Call
                  </Button>
                </div>
              </div>;
            })}
          </div>
        </Card>

        <Card title="Instructions & Case Notes">
          <p className="text-xs text-slate-600 whitespace-pre-wrap">
            {assignment.instructions || "No special instructions recorded."}
          </p>
        </Card>
      </div>

      {/* Visits Timeline */}
      <Card
        title="Field Visit History"
        subtitle="Chronological log of executive meetings, debtor discussion, and outcomes"
      >
        {visits.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No field visits recorded yet. Click &ldquo;Record Visit Report&rdquo; to log your first field meeting.
          </p>
        ) : (
          <div className="space-y-4">
            {visits.map((v: any) => (
              <div
                key={v.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{v.outcome.replace(/_/g, " ")}</Badge>
                    <span className="text-xs font-semibold text-slate-900">
                      Contact: {v.contactPersonName}
                      {v.contactDesignation ? ` (${v.contactDesignation})` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(v.visitedAt).toLocaleString()} by {v.employee?.name || "Executive"}
                  </span>
                </div>

                <div className="text-xs text-slate-700">
                  <span className="font-semibold block text-slate-900 mb-0.5">Discussion:</span>
                  <p className="whitespace-pre-wrap">{v.discussion}</p>
                </div>

                {v.nonPaymentReason && (
                  <div className="text-xs text-slate-600 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">
                    <span className="font-semibold text-amber-900 block mb-0.5">
                      Reason for Non-Payment:
                    </span>
                    <p>{v.nonPaymentReason}</p>
                  </div>
                )}

                {v.promisedDate && (
                  <div className="flex items-center gap-4 text-xs font-semibold text-indigo-700 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100">
                    <span>Promised Date: {v.promisedDate}</span>
                    {v.promisedAmountMinor > 0 && (
                      <span>Promised Amount: {formatMoney(v.promisedAmountMinor)}</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
                  {v.location && (
                    <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${v.location.lat},${v.location.lng}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                      <MapPin className="h-3 w-3 text-indigo-500" />
                      GPS: {v.location.lat.toFixed(5)}, {v.location.lng.toFixed(5)} (±
                      {v.location.accuracyMeters}m)
                      <Navigation className="ml-1 h-3 w-3" />Open map
                    </a>
                  )}
                </div>
                {v.fileAssetIds?.map((fileId: string, index: number) => <EvidencePreviewButton key={fileId} fileId={fileId} label={index === 0 ? "View visit photo" : `Visit evidence ${index + 1}`} />)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Record Visit Modal */}
      <Modal
        isOpen={visitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        title="Record Field Visit Report"
        description="Immutable field encounter log with customer contact"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordVisit} className="space-y-4">
          <Select
            label="Visit Outcome"
            required
            options={outcomeOptions}
            value={visitData.outcome}
            onChange={(e) => setVisitData({ ...visitData, outcome: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Person Name"
              required
              placeholder="Person met / spoken with"
              value={visitData.contactPersonName}
              onChange={(e) => setVisitData({ ...visitData, contactPersonName: e.target.value })}
            />
            <Input
              label="Designation / Role"
              placeholder="e.g. Managing Director, Accounts Manager"
              value={visitData.contactDesignation}
              onChange={(e) => setVisitData({ ...visitData, contactDesignation: e.target.value })}
            />
          </div>

          <TextArea
            label="Meeting Discussion Details"
            required
            rows={3}
            placeholder="Details of discussion, customer posture, objections, financial condition..."
            value={visitData.discussion}
            onChange={(e) => setVisitData({ ...visitData, discussion: e.target.value })}
          />

          <Input
            label="Reason for Delay / Non-Payment"
            placeholder="Cash crunch, dispute, awaiting bank disbursement..."
            value={visitData.nonPaymentReason}
            onChange={(e) => setVisitData({ ...visitData, nonPaymentReason: e.target.value })}
          />

          {visitData.outcome === "promised_payment" && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-900">
                Payment Commitment Parameters (Creates Promise-to-Pay)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Promised Payment Date"
                  type="date"
                  required
                  value={visitData.promisedDate}
                  onChange={(e) => setVisitData({ ...visitData, promisedDate: e.target.value })}
                />
                <MoneyInput
                  label="Promised Amount"
                  required
                  valueMinor={visitData.promisedAmountMinor}
                  onChangeMinor={(m) => setVisitData({ ...visitData, promisedAmountMinor: m })}
                />
              </div>
            </div>
          )}

          {/* GPS Location Capture */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Field Geolocation Tag
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                isLoading={isCapturingGps}
                onClick={handleCaptureLocation}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>{visitData.location ? "Re-tag Location" : "Capture Current GPS"}</span>
              </Button>
              {visitData.location && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Tagged ({visitData.location.lat.toFixed(4)}, {visitData.location.lng.toFixed(4)})
                </span>
              )}
            </div>
          </div>

          <VisitEvidenceCapture fileAssetId={visitData.fileAssetId} onUploaded={(fileId) => setVisitData((prev) => ({ ...prev, fileAssetId: fileId }))} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setVisitModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isRecordingVisit}>
              Submit Visit Report
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Assignment Status"
        description="Transition the recovery lifecycle status"
      >
        <div className="space-y-4">
          <Select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            options={[
              { value: "in_progress", label: "In Progress" },
              { value: "visit_scheduled", label: "Visit Scheduled" },
              { value: "visit_completed", label: "Visit Completed" },
              { value: "payment_committed", label: "Payment Committed" },
              { value: "partially_recovered", label: "Partially Recovered" },
              { value: "fully_recovered", label: "Fully Recovered" },
              { value: "escalated", label: "Escalated to Senior" },
              { value: "closed", label: "Closed" },
            ]}
          />

          {newStatus === "closed" && (
            <TextArea
              label="Close Reason"
              required
              placeholder="e.g. Invoices settled in full, legal proceedings initiated, write-off..."
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={isUpdatingStatus} onClick={handleUpdateStatus}>
              Save Status
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
