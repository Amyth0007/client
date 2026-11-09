import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowLeft, Target } from "lucide-react";
import { api, formatMoney } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { Select } from "../../components/common/Select.js";
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
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  const {
    register,
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

  const toggleInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAllInvoices = () => {
    if (selectedInvoiceIds.length === openInvoices.length) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(openInvoices.map((inv: any) => inv.id));
    }
  };

  const customerOptions = (customersData?.data ?? []).map((c: any) => ({
    value: c.id,
    label: `${c.displayName}${c.companyName ? ` (${c.companyName})` : ""}`,
  }));

  const employeeOptions = (employeesData?.data ?? []).map((e: any) => ({
    value: e.id,
    label: `${e.name} (${e.role === "accounts_manager" ? "Account Manager" : e.role === "field_recovery" ? "Field Executive" : e.role === "employee" ? "Employee" : "Organization Admin"})`,
  }));

  const selectedOutstandingMinor = openInvoices
    .filter((inv: any) => selectedInvoiceIds.includes(inv.id))
    .reduce((sum: number, inv: any) => sum + inv.outstandingMinor, 0);

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
              <Select
                label="Debtor Customer"
                required
                placeholder="-- Select Customer to recover from --"
                options={customerOptions}
                error={errors.customerId?.message}
                {...register("customerId", { required: "Customer is required" })}
              />
            </div>

            <Select
              label="Assigned Executive"
              required
              placeholder="-- Select Field Executive / Manager --"
              options={employeeOptions}
              error={errors.assigneeId?.message}
              {...register("assigneeId", { required: "Assignee is required" })}
            />

            <Select
              label="Priority Level"
              options={[
                { value: "low", label: "Low Priority" },
                { value: "medium", label: "Medium Priority" },
                { value: "high", label: "High Priority (Urgent)" },
              ]}
              {...register("priority")}
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
          subtitle={
            customerId
              ? "Select which overdue invoices the executive must visit for"
              : "Select a customer above to load outstanding invoices"
          }
          action={
            openInvoices.length > 0 && (
              <button
                type="button"
                onClick={selectAllInvoices}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                {selectedInvoiceIds.length === openInvoices.length ? "Deselect All" : "Select All"}
              </button>
            )
          }
        >
          {!customerId ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Please choose a customer first to view outstanding invoices.
            </p>
          ) : invoicesLoading ? (
            <div className="space-y-2 py-4">
              <div className="h-10 bg-slate-100 animate-pulse rounded" />
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
                    onClick={() => toggleInvoice(inv.id)}
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
                        onChange={() => {}} // handled by parent onClick
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="font-bold text-slate-900">{inv.invoiceNumber}</span>
                        <span className="text-slate-500 ml-2">Due: {inv.dueDate}</span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatMoney(inv.outstandingMinor)}
                    </span>
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-600">
                  {selectedInvoiceIds.length} of {openInvoices.length} invoices selected
                </span>
                <span className="font-bold text-indigo-600 text-sm">
                  Total Snapshot: {formatMoney(selectedOutstandingMinor)}
                </span>
              </div>
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
