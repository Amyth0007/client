import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, Handshake } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { TextArea } from "../../components/common/TextArea.js";
import { MoneyInput } from "../../components/common/MoneyInput.js";
import { FileUpload } from "../../components/common/FileUpload.js";

function addDays(dateStr: string, days: number): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

export function CommitmentFormPage() {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      customerId: "",
      promisedAmountMinor: 0,
      promisedDate: addDays(todayStr, 7),
      responsiblePerson: "",
      delayReason: "",
      fileAssetId: null as string | null,
    },
  });

  const customerId = watch("customerId");

  // Load Customers
  const { data: customersData } = useQuery({
    queryKey: ["customers-dropdown"],
    queryFn: () => api.listCustomers({ limit: 100 }),
  });

  // Load Invoices for chosen customer
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

  const openInvoices = (invoicesData?.data ?? []).filter((inv: any) => inv.outstandingMinor > 0);

  const toggleInvoice = (inv: any) => {
    setSelectedInvoiceIds((prev) => {
      const isSelected = prev.includes(inv.id);
      const next = isSelected ? prev.filter((i) => i !== inv.id) : [...prev, inv.id];

      // Auto compute total promised amount if single selection
      if (!isSelected && next.length === 1) {
        setValue("promisedAmountMinor", inv.outstandingMinor);
      }
      return next;
    });
  };

  const customerOptions = (customersData?.data ?? []).map((c: any) => ({
    value: c.id,
    label: `${c.displayName}${c.companyName ? ` (${c.companyName})` : ""}`,
  }));

  const onSubmit = async (values: any) => {
    if (selectedInvoiceIds.length === 0) {
      toast.error("Please select at least one invoice linked to this commitment");
      return;
    }
    if (values.promisedAmountMinor <= 0) {
      toast.error("Please enter a valid promised amount");
      return;
    }

    setIsLoading(true);
    try {
      const created = await api.createCommitment({
        customerId: values.customerId,
        invoiceIds: selectedInvoiceIds,
        promisedAmountMinor: Number(values.promisedAmountMinor),
        promisedDate: values.promisedDate,
        responsiblePerson: values.responsiblePerson,
        delayReason: values.delayReason || undefined,
        fileAssetIds: values.fileAssetId ? [values.fileAssetId] : [],
      });

      toast.success("Payment commitment recorded successfully!");
      navigate(`/commitments/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create commitment");
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
        title="Record Payment Commitment"
        description="Formalize customer promise-to-pay terms without modifying invoice due dates"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card title="Debtor & Promise Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Select
                label="Debtor Customer"
                required
                placeholder="-- Select Customer --"
                options={customerOptions}
                error={errors.customerId?.message}
                {...register("customerId", { required: "Customer is required" })}
              />
            </div>

            <Input
              label="Promised Payment Date"
              type="date"
              required
              {...register("promisedDate", { required: "Date is required" })}
            />

            <Input
              label="Responsible Person (Debtor Authority)"
              required
              placeholder="e.g. Ramesh Kumar (Director)"
              error={errors.responsiblePerson?.message}
              {...register("responsiblePerson", { required: "Contact name is required" })}
            />

            <div className="sm:col-span-2">
              <MoneyInput
                label="Promised Payment Amount"
                required
                valueMinor={watch("promisedAmountMinor")}
                onChangeMinor={(m) => setValue("promisedAmountMinor", m)}
                helperText="Amount committed by the debtor in INR"
              />
            </div>
          </div>
        </Card>

        {/* Invoice Selector */}
        <Card
          title="Linked Outstanding Invoices"
          subtitle={
            customerId
              ? "Select which invoice(s) this promise covers"
              : "Select a customer above to load outstanding invoices"
          }
        >
          {!customerId ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Please choose a customer first to view outstanding invoices.
            </p>
          ) : invoicesLoading ? (
            <div className="space-y-2 py-4">
              <div className="h-10 bg-slate-100 animate-pulse rounded" />
            </div>
          ) : openInvoices.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No outstanding invoices found for this customer.
            </p>
          ) : (
            <div className="space-y-2">
              {openInvoices.map((inv: any) => {
                const isSelected = selectedInvoiceIds.includes(inv.id);
                return (
                  <div
                    key={inv.id}
                    onClick={() => toggleInvoice(inv)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? "border-indigo-300 bg-indigo-50/50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
                        <span className="text-slate-500 ml-2">Due Date: {inv.dueDate}</span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatMoney(inv.outstandingMinor)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Supporting Evidence File */}
        <Card title="Promise Evidence (Optional)">
          <FileUpload
            purpose="commitment_evidence"
            label="Upload Email Confirmation, WhatsApp Screenshot, or Promissory Note"
            onUploaded={(fileId) => setValue("fileAssetId", fileId)}
          />
        </Card>

        {/* Delay Reason */}
        <Card title="Reason for Past Delay">
          <TextArea
            placeholder="Cash flow delay, vendor dispute, delayed government payment, seasonal collection..."
            {...register("delayReason")}
          />
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={selectedInvoiceIds.length === 0}>
            <Handshake className="h-4 w-4" />
            <span>Save Commitment</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
