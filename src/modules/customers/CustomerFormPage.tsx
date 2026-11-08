import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { api } from "../../services/api-client.js";
import { PageHeader } from "../../components/common/PageHeader.js";
import { Button } from "../../components/common/Button.js";
import { Card } from "../../components/common/Card.js";
import { Input } from "../../components/common/Input.js";
import { MoneyInput } from "../../components/common/MoneyInput.js";
import { TextArea } from "../../components/common/TextArea.js";

export function CustomerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isLoading, setIsLoading] = useState(false);

  const { data: customerData } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => (id ? api.getCustomer(id) : null),
    enabled: isEditing,
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      displayName: "",
      companyName: "",
      gstin: "",
      email: "",
      phone: "",
      defaultCreditDays: 30,
      creditLimitMinor: 0,
      notes: "",
      billingAddress: {
        line1: "",
        city: "",
        state: "",
        postalCode: "",
      },
      contacts: [] as any[],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "contacts",
  });

  useEffect(() => {
    if (customerData) {
      reset({
        displayName: customerData.displayName,
        companyName: customerData.companyName ?? "",
        gstin: customerData.gstin ?? "",
        email: customerData.email ?? "",
        phone: customerData.phone ?? "",
        defaultCreditDays: customerData.defaultCreditDays ?? 30,
        creditLimitMinor: customerData.creditLimitMinor ?? 0,
        notes: customerData.notes ?? "",
        billingAddress: customerData.billingAddress ?? {},
        contacts: customerData.contacts ?? [],
      });
    }
  }, [customerData, reset]);

  const onSubmit = async (values: any) => {
    setIsLoading(true);
    try {
      const payload = {
        ...values,
        gstin: values.gstin ? values.gstin.toUpperCase() : null,
        creditLimitMinor: values.creditLimitMinor ? Number(values.creditLimitMinor) : null,
      };

      if (isEditing && id) {
        await api.updateCustomer(id, payload);
        toast.success("Customer updated successfully");
      } else {
        const created = await api.createCustomer(payload);
        toast.success("Customer created successfully");
        navigate(`/customers/${created.id}`);
        return;
      }
      navigate(`/customers/${id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save customer");
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
        title={isEditing ? "Edit Customer" : "Add New Customer"}
        description="Configure commercial details, credit terms, and contact hierarchy"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Core Identity */}
        <Card title="Primary Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display Name"
              required
              placeholder="e.g. Acme Corp"
              error={errors.displayName?.message}
              {...register("displayName", { required: "Display name is required" })}
            />

            <Input
              label="Legal Company Name"
              placeholder="e.g. Acme Enterprises Pvt Ltd"
              {...register("companyName")}
            />

            <Input
              label="GSTIN"
              placeholder="22AAAAA0000A1Z5"
              {...register("gstin")}
            />

            <Input
              label="Primary Phone"
              placeholder="+91 98765 43210"
              {...register("phone")}
            />

            <Input
              label="Accounts Email"
              type="email"
              placeholder="billing@acme.com"
              {...register("email")}
            />

            <Input
              label="Default Credit Days"
              type="number"
              min="0"
              max="365"
              placeholder="30"
              {...register("defaultCreditDays", { valueAsNumber: true })}
            />

            <div className="sm:col-span-2">
              <MoneyInput
                label="Informational Credit Limit"
                valueMinor={watch("creditLimitMinor")}
                onChangeMinor={(minor) => setValue("creditLimitMinor", minor)}
                helperText="Informational only — does not block invoicing"
              />
            </div>
          </div>
        </Card>

        {/* Billing Address */}
        <Card title="Billing Address">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Street Address / Line 1"
                placeholder="Plot 12, Industrial Area Phase II"
                {...register("billingAddress.line1")}
              />
            </div>
            <Input label="City" placeholder="Mumbai" {...register("billingAddress.city")} />
            <Input label="State" placeholder="Maharashtra" {...register("billingAddress.state")} />
            <Input label="PIN Code" placeholder="400001" {...register("billingAddress.postalCode")} />
          </div>
        </Card>

        {/* Contacts Hierarchy */}
        <Card
          title="Contact Persons"
          subtitle="Key personnel for collections and recovery"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ name: "", designation: "", phone: "", email: "", isPrimary: false })}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Contact</span>
            </Button>
          }
        >
          {fields.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              No additional contacts added yet. Click &ldquo;Add Contact&rdquo; to add managers or accountants.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 relative flex flex-col sm:flex-row gap-2 items-start"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full">
                    <Input
                      placeholder="Name"
                      required
                      {...register(`contacts.${idx}.name` as const, { required: true })}
                    />
                    <Input
                      placeholder="Designation"
                      {...register(`contacts.${idx}.designation` as const)}
                    />
                    <Input
                      placeholder="Phone"
                      {...register(`contacts.${idx}.phone` as const)}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      {...register(`contacts.${idx}.email` as const)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-2 text-slate-500 hover:text-red-600 transition-colors self-end sm:self-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card title="Notes & Remarks">
          <TextArea
            placeholder="Special billing instructions, payment preferences, or terms history..."
            {...register("notes")}
          />
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEditing ? "Save Changes" : "Create Customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
