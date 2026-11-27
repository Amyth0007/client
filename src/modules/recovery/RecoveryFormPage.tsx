import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { RecoveryInvoicePicker } from "./RecoveryInvoicePicker.js";
import { toast } from "react-hot-toast";
import { ArrowLeft, Target } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { CustomSelect } from "../../components/common/CustomSelect.js";
import { TextArea } from "../../components/common/TextArea.js";

function addDays(dateStr: string, days: number): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

export function RecoveryFormPage() {
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, any>>({});

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      customerId: "",
      assigneeId: "",
      priority: "medium",
      visitDeadline: addDays(todayStr, 7),
      instructions: "",
    },
  });

  const customerId = watch("customerId");

  // Load Customers
  const { data: customersData } = useQuery({
    queryKey: ["customers-dropdown"],
    queryFn: () => api.listCustomers({ limit: 100 }),
  });

  // Load Employees
  const { data: employeesData } = useQuery({
    queryKey: ["employees-dropdown"],
    queryFn: () => api.listEmployees({ limit: 100 }),
  });

  const customerOptions = (customersData?.data ?? []).map((c: any) => ({
    value: c.id,
    label: `${c.displayName}${c.companyName ? ` (${c.companyName})` : ""}`,
  }));

  const employeeOptions = (employeesData?.data ?? []).map((e: any) => ({
    value: e.id,
    label: `${e.name} (${e.role === "accounts_manager" ? "Account Manager" : e.role === "field_recovery" ? "Field Executive" : e.role === "employee" ? "Employee" : "Organization Admin"})`,
  }));

  const selectedInvoiceIds = Object.keys(selectedInvoices);
  const selectedOutstandingMinor = Object.values(selectedInvoices).reduce((sum: number, inv: any) => sum + (inv.outstandingMinor ?? 0), 0);

  const onSubmit = async (values: any) => {
    if (selectedInvoiceIds.length === 0) {
      toast.error("Please select at least one overdue or outstanding invoice");
      return;
    }

    setIsLoading(true);
    try {
      const created = await api.createRecoveryAssignment({
        customerId: values.customerId,
        invoiceIds: selectedInvoiceIds,
        assigneeId: values.assigneeId,
        priority: values.priority,
        visitDeadline: values.visitDeadline,
        instructions: values.instructions || undefined,
      });

      toast.success("Recovery assignment created successfully!");
      navigate(`/recovery/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create assignment");
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
        title="New Recovery Assignment"
        description="Assign delinquent accounts and overdue invoices to field executives"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card title="Assignment Parameters">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Controller
                name="customerId"
                control={control}
                rules={{ required: "Customer is required" }}
                render={({ field }) => (
                  <CustomSelect
                    label="Debtor Customer"
                    required
                    placeholder="Select Customer to recover from"
                    options={customerOptions}
                    error={errors.customerId?.message}
                    searchable
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(e: any) => { if (e.target.value !== field.value) setSelectedInvoices({}); field.onChange(e.target.value); }}
                  />
                )}
              />
            </div>

            <Controller
              name="assigneeId"
              control={control}
              rules={{ required: "Assignee is required" }}
              render={({ field }) => (
                <CustomSelect
                  label="Assigned Executive"
                  required
                  placeholder="Select Field Executive / Manager"
                  options={employeeOptions}
                  error={errors.assigneeId?.message}
                  searchable
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={(e: any) => field.onChange(e.target.value)}
                />
              )}
            />

            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  label="Priority Level"
                  required
                  options={[
                    { value: "low", label: "Low Priority" },
                    { value: "medium", label: "Medium Priority" },
                    { value: "high", label: "High Priority (Urgent)" },
                  ]}
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={(e: any) => field.onChange(e.target.value)}
                />
              )}
            />

            <div className="sm:col-span-2">
              <Input
                label="Visit Deadline"
                type="date"
                required
                {...register("visitDeadline", { required: "Deadline is required" })}
              />
            </div>
          </div>
        </Card>

        {/* Invoice Selector */}
        <Card
          title="Select Invoices to Recover"
          subtitle={customerId ? "Only unpaid invoices that are not already in an open recovery assignment are listed" : "Select a customer above to load outstanding invoices"}
          contentClassName="p-0!"
        >
          {!customerId ? (
            <p className="px-5 py-8 text-center text-xs text-slate-500">Please choose a customer first to view outstanding invoices.</p>
          ) : (
            <RecoveryInvoicePicker customerId={customerId} selected={selectedInvoices} onChange={setSelectedInvoices} />
          )}
          {selectedInvoiceIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs sm:px-5">
              <span className="text-slate-700"><strong className="text-slate-900">{selectedInvoiceIds.length}</strong> invoice{selectedInvoiceIds.length === 1 ? "" : "s"} selected · <button type="button" onClick={() => setSelectedInvoices({})} className="font-semibold text-indigo-700 hover:underline">Clear</button></span>
              <span className="text-sm font-bold text-indigo-700">Total: {formatMoney(selectedOutstandingMinor)}</span>
            </div>
          )}
        </Card>

        {/* Instructions */}
        <Card title="Instructions for Executive">
          <TextArea
            placeholder="Special instructions, meeting context, contact person preferences, or settlement flexibility..."
            {...register("instructions")}
          />
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={selectedInvoiceIds.length === 0}>
            <Target className="h-4 w-4" />
            <span>Create Recovery Assignment</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
