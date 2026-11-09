import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, Sparkles } from "lucide-react";
import { api } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
import { MoneyInput } from "../../components/common/MoneyInput.js";
import { TextArea } from "../../components/common/TextArea.js";
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

export function InvoiceFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  const preselectedCustId = searchParams.get("customerId") || "";

  const { data: customersData } = useQuery({
    queryKey: ["customers-dropdown"],
    queryFn: () => api.listCustomers({ limit: 100 }),
  });

  const { data: invoiceData } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => (id ? api.getInvoice(id) : null),
    enabled: isEditing,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      customerId: preselectedCustId,
      invoiceNumber: "",
      invoiceDate: todayStr,
      termSource: "credit_days" as "credit_days" | "explicit_date",
      creditDays: 30,
      dueDate: addDays(todayStr, 30),
      amountMinor: 0,
      notes: "",
      primaryFileAssetId: null as string | null,
    },
  });

  const customerId = watch("customerId");
  const invoiceDate = watch("invoiceDate");
  const termSource = watch("termSource");
  const creditDays = watch("creditDays");

  // When customer changes, load customer's defaultCreditDays
  useEffect(() => {
    if (customerId && customersData?.data) {
      const selected = customersData.data.find((c: any) => c.id === customerId);
      if (selected && selected.defaultCreditDays !== undefined) {
        setValue("creditDays", selected.defaultCreditDays);
        if (termSource === "credit_days") {
          setValue("dueDate", addDays(invoiceDate, selected.defaultCreditDays));
        }
      }
    }
  }, [customerId, customersData, termSource, invoiceDate, setValue]);

  // When creditDays or invoiceDate changes, recalculate dueDate
  useEffect(() => {
    if (termSource === "credit_days" && invoiceDate) {
      setValue("dueDate", addDays(invoiceDate, Number(creditDays) || 0));
    }
  }, [creditDays, invoiceDate, termSource, setValue]);

  useEffect(() => {
    if (invoiceData) {
      reset({
        customerId: invoiceData.customerId,
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.invoiceDate,
        termSource: invoiceData.termSource,
        creditDays: invoiceData.creditDays ?? 30,
        dueDate: invoiceData.dueDate,
        amountMinor: invoiceData.amountMinor,
        notes: invoiceData.notes ?? "",
        primaryFileAssetId: invoiceData.primaryFileAssetId,
      });
    }
  }, [invoiceData, reset]);

  const customerOptions = (customersData?.data ?? []).map((c: any) => ({
    value: c.id,
    label: `${c.displayName}${c.companyName ? ` (${c.companyName})` : ""}`,
  }));

  const saveInvoice = async (values: any, shouldIssue = false) => {
    setIsLoading(true);
    try {
      const payload = {
        ...values,
        amountMinor: Number(values.amountMinor),
        creditDays: values.termSource === "credit_days" ? Number(values.creditDays) : null,
      };

      let targetId = id;
      if (isEditing && id) {
        await api.updateInvoiceDraft(id, payload);
      } else {
        const created = await api.createInvoiceDraft(payload);
        targetId = created.id;
      }

      if (shouldIssue && targetId) {
        await api.issueInvoice(targetId);
        toast.success("Invoice issued and ledger posted!");
      } else {
        toast.success("Draft saved successfully");
      }

      navigate(`/invoices/${targetId}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save invoice");
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
        title={isEditing ? "Edit Invoice Draft" : "Create New Invoice"}
        description="Raise a credit receivable with computed due dates and ledger entries"
      />

      <form className="space-y-6">
        <Card title="Invoice Header">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Select
                label="Debtor Customer"
                required
                placeholder="-- Select a customer --"
                options={customerOptions}
                error={errors.customerId?.message}
                {...register("customerId", { required: "Customer is required" })}
              />
            </div>

            <Input
              label="Invoice Number"
              required
              placeholder="e.g. INV-2026-001"
              error={errors.invoiceNumber?.message}
              {...register("invoiceNumber", { required: "Invoice number is required" })}
            />

            <Input
              label="Invoice Date"
              type="date"
              required
              error={errors.invoiceDate?.message}
              {...register("invoiceDate", { required: "Invoice date is required" })}
            />

            <div className="sm:col-span-2">
              <MoneyInput
                label="Invoice Receivable Amount"
                required
                valueMinor={watch("amountMinor")}
                onChangeMinor={(minor) => setValue("amountMinor", minor)}
                helperText="Principal receivable amount in paise/rupees"
              />
            </div>
          </div>
        </Card>

        {/* Due Date Calculation Section */}
        <Card title="Payment Terms & Due Date">
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  value="credit_days"
                  checked={termSource === "credit_days"}
                  onChange={() => setValue("termSource", "credit_days")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Credit Days from Invoice Date</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  value="explicit_date"
                  checked={termSource === "explicit_date"}
                  onChange={() => setValue("termSource", "explicit_date")}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Explicit Calendar Due Date</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {termSource === "credit_days" ? (
                <>
                  <Input
                    label="Credit Period (Days)"
                    type="number"
                    min="0"
                    max="365"
                    placeholder="30"
                    {...register("creditDays", { valueAsNumber: true })}
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Computed Due Date
                    </label>
                    <div className="py-2 px-3 rounded-lg bg-indigo-50/60 border border-indigo-100 text-sm font-semibold text-indigo-900">
                      {watch("dueDate")}
                    </div>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <Input
                    label="Explicit Due Date"
                    type="date"
                    required
                    {...register("dueDate", { required: "Due date is required" })}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Supporting File Document */}
        <Card title="Invoice Document Asset">
          <FileUpload
            purpose="invoice_document"
            label="Upload invoice image"
            onUploaded={(fileId) => setValue("primaryFileAssetId", fileId)}
          />
        </Card>

        {/* Notes */}
        <Card title="Notes">
          <TextArea
            placeholder="Payment instructions, bank account details, or purchase order reference..."
            {...register("notes")}
          />
        </Card>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isLoading}
            onClick={handleSubmit((data) => saveInvoice(data, false))}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            isLoading={isLoading}
            onClick={handleSubmit((data) => saveInvoice(data, true))}
          >
            <Sparkles className="h-4 w-4" />
            <span>Issue & Post Ledger</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
