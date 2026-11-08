import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Badge } from "../../components/common/Badge.js";
import { Modal } from "../../components/common/Modal.js";
import { TextArea } from "../../components/common/TextArea.js";
import { EvidencePreviewButton } from "../../components/common/EvidencePreviewButton.js";

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [isReversing, setIsReversing] = useState(false);

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payment", id],
    queryFn: () => (id ? api.getPayment(id) : null),
    enabled: Boolean(id),
  });

  if (isLoading || !payment) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-48 bg-white rounded-xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const handleReverse = async () => {
    if (!reverseReason.trim()) {
      toast.error("Please provide a reason for reversal");
      return;
    }
    setIsReversing(true);
    try {
      await api.reversePayment(id!, reverseReason);
      toast.success("Payment reversed and balances restored!");
      setReverseModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to reverse payment");
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate("/payments")}>
          <ArrowLeft className="h-4 w-4" />
          <span>Payments</span>
        </Button>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {payment.paymentReference}
            </h1>
            <Badge variant={payment.kind === "collection" ? "success" : "danger"}>
              {payment.kind}
            </Badge>
            {payment.reversedAt && <Badge variant="warning">Reversed</Badge>}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Customer:{" "}
            <Link
              to={`/customers/${payment.customerId}`}
              className="text-indigo-600 font-medium hover:underline"
            >
              {payment.customer?.displayName || "Customer"}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {payment.kind === "collection" && !payment.reversedAt && (
            <Button
              size="sm"
              variant="outline"
              className="text-rose-600 border-rose-200 hover:bg-rose-50"
              onClick={() => setReverseModalOpen(true)}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reverse Receipt</span>
            </Button>
          )}

          {payment.fileAssetIds?.map((fileId: string, index: number) => <EvidencePreviewButton key={fileId} fileId={fileId} label={index === 0 ? "Payment evidence" : `Evidence ${index + 1}`} />)}
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Received Amount</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-emerald-700 sm:text-2xl">
            {formatMoney(payment.amountMinor)}
          </p>
          <p className="text-xs text-slate-600 mt-1">Date: {payment.paymentDate}</p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Payment Method</p>
          <p className="mt-2 break-words text-lg font-bold capitalize leading-tight text-slate-900 sm:text-xl">
            {payment.mode.replace("_", " ")}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Txn Ref: {payment.transactionReference || "None"}
          </p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
          <p className="text-xs font-medium text-slate-500 uppercase">Allocations</p>
          <p className="mt-2 break-words text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
            {payment.allocations?.length ?? 0}
          </p>
          <p className="text-xs text-slate-600 mt-1">Invoices cleared</p>
        </div>
      </div>

      {/* Invoice Allocations Breakdown */}
      <Card
        title="Invoice Allocations"
        subtitle="Distribution of this collection across customer bills"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <th className="pb-2.5">Invoice #</th>
                <th className="pb-2.5">Bucket</th>
                <th className="pb-2.5 text-right">Applied Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(payment.allocations ?? []).map((alloc: any, idx: number) => (
                <tr
                  key={idx}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open invoice ${alloc.invoiceNumber || alloc.invoiceId}`}
                  onClick={() => navigate(`/invoices/${alloc.invoiceId}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/invoices/${alloc.invoiceId}`);
                    }
                  }}
                  className="group cursor-pointer transition-colors hover:bg-indigo-50/70 focus-visible:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
                >
                  <td className="py-2.5 font-medium">
                    <span className="font-semibold text-indigo-700 underline decoration-indigo-300 underline-offset-2">{alloc.invoiceNumber || alloc.invoiceId}</span>
                  </td>
                  <td className="py-2.5 capitalize text-slate-600">{alloc.bucket}</td>
                  <td className="py-2.5 text-right font-bold text-slate-900">
                    {formatMoney(alloc.amountMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {payment.remarks && (
        <Card title="Remarks">
          <p className="text-xs text-slate-600 whitespace-pre-wrap">{payment.remarks}</p>
        </Card>
      )}

      {/* Reverse Modal */}
      <Modal
        isOpen={reverseModalOpen}
        onClose={() => setReverseModalOpen(false)}
        title="Reverse Payment Collection"
        description="Reversing generates an inverse ledger journal and restores outstanding amounts"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            A full reversal entry will be written to the ledger. This action cannot be undone.
          </p>
          <TextArea
            label="Reversal Reason"
            required
            placeholder="e.g. Cheque bounced, payment chargeback, duplicate entry..."
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setReverseModalOpen(false)}>
              Back
            </Button>
            <Button variant="danger" isLoading={isReversing} onClick={handleReverse}>
              Confirm Reversal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
