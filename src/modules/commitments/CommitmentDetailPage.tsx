import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Download,
} from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { Select } from "../../components/common/Select.js";
import { MoneyInput } from "../../components/common/MoneyInput.js";
import { TextArea } from "../../components/common/TextArea.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";

export function CommitmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalStatus, setEvalStatus] = useState<"fulfilled" | "partially_fulfilled" | "missed">(
    "fulfilled",
  );
  const [fulfilledAmountMinor, setFulfilledAmountMinor] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const { data: commitment, isLoading } = useQuery({
    queryKey: ["commitment", id],
    queryFn: () => (id ? api.getCommitment(id) : null),
    enabled: Boolean(id),
  });

  if (isLoading || !commitment) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      await api.evaluateCommitment(id!, {
        status: evalStatus,
        fulfilledAmountMinor:
          evalStatus === "fulfilled"
            ? commitment.promisedAmountMinor
            : evalStatus === "missed"
            ? 0
            : fulfilledAmountMinor,
      });
      toast.success("Commitment evaluation saved!");
      setEvalModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["commitment", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to evaluate commitment");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please enter a cancellation reason");
      return;
    }
    setIsCancelling(true);
    try {
      await api.cancelCommitment(id!, cancelReason);
      toast.success("Commitment cancelled");
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["commitment", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel commitment");
    } finally {
      setIsCancelling(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const isLate = commitment.status === "upcoming" && commitment.promisedDate < todayStr;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/commitments")}>
          <ArrowLeft className="h-4 w-4" />
          <span>Commitments</span>
        </Button>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {formatMoney(commitment.promisedAmountMinor)}
            </h1>
            <Badge
              variant={
                commitment.status === "fulfilled"
                  ? "success"
                  : commitment.status === "missed"
                  ? "danger"
                  : commitment.status === "partially_fulfilled"
                  ? "warning"
                  : "info"
              }
            >
              {commitment.status.replace("_", " ")}
            </Badge>
            {isLate && <Badge variant="overdue">Promise Overdue</Badge>}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Debtor:{" "}
            <Link
              to={`/customers/${commitment.customerId}`}
              className="text-indigo-600 font-medium hover:underline"
            >
              {commitment.customer?.displayName || "Customer"}
            </Link>{" "}
            • Committed by: <span className="text-slate-700 font-medium">{commitment.responsiblePerson}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
            const { downloadCommitmentReportPdf } = await import("../../services/pdf.js");
            downloadCommitmentReportPdf([commitment], commitment.customer?.displayName || "Customer");
          }}><Download className="h-4 w-4" /><span>Download commitment PDF</span></Button>
          {commitment.status === "upcoming" && (
            <>
              <Button size="sm" onClick={() => setEvalModalOpen(true)}>
                <CheckCircle className="h-4 w-4" />
                <span>Evaluate Outcome</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50"
                onClick={() => setCancelModalOpen(true)}
              >
                <XCircle className="h-4 w-4" />
                <span>Cancel</span>
              </Button>
            </>
          )}

          {commitment.fileAssetIds?.map((fileId: string, index: number) => <EvidencePreviewButton key={fileId} fileId={fileId} label={index === 0 ? "Promise evidence" : `Evidence ${index + 1}`} />)}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Promised Payment Date</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{commitment.promisedDate}</p>
          <p className={`text-xs mt-1 ${isLate ? "text-rose-600 font-semibold" : "text-slate-600"}`}>
            {isLate ? "Past committed date" : "On commitment schedule"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Fulfilled Amount</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {formatMoney(commitment.fulfilledAmountMinor)}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {commitment.evaluatedAt
              ? `Evaluated on ${new Date(commitment.evaluatedAt).toLocaleDateString()}`
              : "Pending evaluation"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Linked Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{commitment.invoices.length}</p>
          <p className="text-xs text-slate-600 mt-1">Bills covered by promise</p>
        </div>
      </div>

      {/* Linked Invoices Table */}
      <Card
        title="Covered Invoices"
        subtitle="Outstanding bills promised to be cleared on this date"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <th className="pb-2.5">Invoice #</th>
                <th className="pb-2.5 text-right">Original Principal</th>
                <th className="pb-2.5 text-right">Current Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commitment.invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 font-medium">
                    <Link to={`/invoices/${inv.id}`} className="text-indigo-600 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="py-2.5 text-right text-slate-600">
                    {formatMoney(inv.amountMinor)}
                  </td>
                  <td className="py-2.5 text-right font-bold text-slate-900">
                    {formatMoney(inv.outstandingMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {commitment.delayReason && (
        <Card title="Reason for Past Delay">
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{commitment.delayReason}</p>
        </Card>
      )}

      {/* Evaluation Modal */}
      <Modal
        isOpen={evalModalOpen}
        onClose={() => setEvalModalOpen(false)}
        title="Evaluate Commitment Fulfillment"
        description="Record whether the debtor honored or defaulted on this promise"
      >
        <div className="space-y-4">
          <Select
            label="Evaluation Result"
            value={evalStatus}
            onChange={(e) => setEvalStatus(e.target.value as any)}
            options={[
              { value: "fulfilled", label: "Fulfilled in Full (100% Received)" },
              { value: "partially_fulfilled", label: "Partially Fulfilled (Partial Amount)" },
              { value: "missed", label: "Missed / Defaulted (No Payment Received)" },
            ]}
          />

          {evalStatus === "partially_fulfilled" && (
            <MoneyInput
              label="Actual Amount Received"
              required
              valueMinor={fulfilledAmountMinor}
              onChangeMinor={(m) => setFulfilledAmountMinor(m)}
            />
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setEvalModalOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={isEvaluating} onClick={handleEvaluate}>
              Save Evaluation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Commitment"
        description="Cancel invalid or superseded payment commitment"
      >
        <div className="space-y-4">
          <TextArea
            label="Cancellation Reason"
            required
            placeholder="e.g. Terms renegotiated in new visit, wrong commitment date..."
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
    </div>
  );
}
