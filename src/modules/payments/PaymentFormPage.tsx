import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, Sparkles } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { TextArea } from "../../components/common/TextArea.js";
import { FileUpload } from "../../components/common/FileUpload.js";

export function PaymentFormPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [isLoading, setIsLoading] = useState(false);

  const preselectedCustId = searchParams.get("customerId") || "";
  const preselectedInvId = searchParams.get("invoiceId") || "";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      customerId: preselectedCustId,
      paymentReference: "",
      paymentDate: todayStr,
      mode: "bank_transfer",
      transactionReference: "",
      remarks: "",
      fileAssetId: null as string | null,
    },
  });

  const customerId = watch("customerId");

  // Load customers
  const { data: customersData } = useQuery({
    queryKey: ["customers-dropdown"],
    queryFn: () => api.listCustomers({ limit: 100 }),
  });

  // Load open invoices for this customer
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["customer-open-invoices", customerId],
    queryFn: () =>
      customerId
        ? api.listInvoices({
            customerId,
            documentStatus: "issued",
            limit: 100,
          })
        : null,
    enabled: Boolean(customerId),
  });

  // Track allocation per invoice: { [invoiceId]: amountMinor }
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const openInvoices = (invoicesData?.data ?? []).filter((inv: any) => inv.outstandingMinor > 0);

  // Preselect single invoice if coming from invoice detail page
  useEffect(() => {
    if (preselectedInvId && openInvoices.length > 0) {
      const match = openInvoices.find((i: any) => i.id === preselectedInvId);
      if (match) {
        setAllocations({ [match.id]: match.outstandingMinor });
      }
    }
  }, [preselectedInvId, openInvoices]);

  const handleToggleInvoice = (inv: any) => {
    setAllocations((prev) => {
      const next = { ...prev };
      if (next[inv.id]) {
        delete next[inv.id];
      } else {
        next[inv.id] = inv.outstandingMinor; // default to full outstanding
      }
      return next;
    });
  };

  const handleAllocationAmountChange = (invId: string, maxMinor: number, rupeesStr: string) => {
    const rupees = parseFloat(rupeesStr || "0");
    const minor = Math.round(rupees * 100);
    const clamped = Math.max(0, Math.min(minor, maxMinor));
    setAllocations((prev) => ({
      ...prev,
      [invId]: clamped,
    }));
  };

  const totalPaymentMinor = Object.values(allocations).reduce((sum, val) => sum + val, 0);

  const customerOptions = (customersData?.data ?? []).map((c: any) => ({
    value: c.id,
    label: `${c.displayName}${c.companyName ? ` (${c.companyName})` : ""}`,
  }));

  const paymentModes = [
    { value: "bank_transfer", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
    { value: "upi", label: "UPI" },
    { value: "cheque", label: "Cheque" },
    { value: "cash", label: "Cash" },
    { value: "card", label: "Credit/Debit Card" },
    { value: "other", label: "Other" },
  ];

  const onSubmit = async (values: any) => {
    if (totalPaymentMinor <= 0) {
      toast.error("Please allocate an amount to at least one invoice");
      return;
    }

    const allocList = Object.entries(allocations)
      .filter(([, minor]) => minor > 0)
      .map(([invoiceId, amountMinor]) => ({
        invoiceId,
        amountMinor,
      }));

    setIsLoading(true);
    try {
      const created = await api.createPayment({
        customerId: values.customerId,
        paymentReference: values.paymentReference,
        paymentDate: values.paymentDate,
        mode: values.mode,
        transactionReference: values.transactionReference || undefined,
        amountMinor: totalPaymentMinor,
        allocations: allocList,
        fileAssetIds: values.fileAssetId ? [values.fileAssetId] : [],
        remarks: values.remarks || undefined,
      });

      toast.success("Payment recorded and ledger updated!");
      navigate(`/payments/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
      </div>

      <PageHeader
        title="Record Payment Collection"
        description="Post verified collection receipts and allocate across open invoice balances"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Core Header */}
        <Card title="Payment Receipt Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Select
                label="Debtor Customer"
                required
                placeholder="-- Select Customer who made the payment --"
                options={customerOptions}
                error={errors.customerId?.message}
                {...register("customerId", { required: "Customer is required" })}
              />
            </div>

            <Input
              label="Payment Reference / Receipt #"
              required
              placeholder="e.g. REC-2026-0042"
              error={errors.paymentReference?.message}
              {...register("paymentReference", { required: "Reference is required" })}
            />

            <Input
              label="Payment Date"
              type="date"
              required
              {...register("paymentDate", { required: "Payment date is required" })}
            />

            <Select
              label="Payment Mode"
              required
              options={paymentModes}
              {...register("mode")}
            />

            <Input
              label="Bank UTR / Transaction Ref"
              placeholder="e.g. UTR1234567890"
              {...register("transactionReference")}
            />
          </div>
        </Card>

        {/* Invoice Allocations Table */}
        <Card
          title="Allocate to Invoices"
          subtitle={
            customerId
              ? "Select which invoice(s) this payment clears"
              : "Select a customer above to view outstanding invoices"
          }
          action={
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Allocated</span>
              <span className="text-base font-bold text-indigo-600">
                {formatMoney(totalPaymentMinor)}
              </span>
            </div>
          }
        >
          {!customerId ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Please choose a customer first to load their outstanding bills.
            </p>
          ) : invoicesLoading ? (
            <div className="space-y-2 py-4">
              <div className="h-10 bg-slate-100 animate-pulse rounded" />
              <div className="h-10 bg-slate-100 animate-pulse rounded" />
            </div>
          ) : openInvoices.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No open invoices with outstanding balances found for this customer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 uppercase font-semibold">
                    <th className="pb-3 w-8"></th>
                    <th className="pb-3">Invoice #</th>
                    <th className="pb-3">Due Date</th>
                    <th className="pb-3 text-right">Outstanding</th>
                    <th className="pb-3 text-right w-36">Apply Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openInvoices.map((inv: any) => {
                    const isSelected = Boolean(allocations[inv.id] !== undefined);
                    const appliedMinor = allocations[inv.id] ?? 0;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInvoice(inv)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                        </td>
                        <td className="py-3 font-semibold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 text-slate-600">{inv.dueDate}</td>
                        <td className="py-3 text-right font-bold text-slate-700">
                          {formatMoney(inv.outstandingMinor)}
                        </td>
                        <td className="py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={inv.outstandingMinor / 100}
                            disabled={!isSelected}
                            value={isSelected ? appliedMinor / 100 : ""}
                            placeholder="0.00"
                            onChange={(e) =>
                              handleAllocationAmountChange(
                                inv.id,
                                inv.outstandingMinor,
                                e.target.value,
                              )
                            }
                            className={`w-28 text-right py-1 px-2 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                              isSelected
                                ? "border-indigo-300 bg-white font-semibold text-indigo-900"
                                : "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Supporting File Document */}
        <Card title="Payment Evidence (Optional)">
          <FileUpload
            purpose="payment_support"
            label="Upload Bank Deposit Slip, UTR Screenshot, or Cheque Copy"
            onUploaded={(fileId) => setValue("fileAssetId", fileId)}
          />
        </Card>

        {/* Remarks */}
        <Card title="Remarks">
          <TextArea
            placeholder="Payer bank details, cheque clearance details, or payment remarks..."
            {...register("remarks")}
          />
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={totalPaymentMinor <= 0}>
            <Sparkles className="h-4 w-4" />
            <span>Post Payment of {formatMoney(totalPaymentMinor)}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
