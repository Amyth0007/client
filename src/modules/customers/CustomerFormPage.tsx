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
    setError,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    reValidateMode: "onChange",
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
      const issues = Array.isArray(err?.details) ? err.details : [];
      let mappedIssues = 0;
      for (const issue of issues) {
        if (typeof issue?.path !== "string" || typeof issue?.message !== "string") continue;
        setError(issue.path as any, { type: "server", message: issue.message });
        mappedIssues += 1;
      }
      if (mappedIssues > 0) {
        toast.error("Please correct the highlighted fields.");
      } else {
        toast.error(err?.message || "Failed to save customer");
      }
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

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Core Identity */}
        <Card title="Primary Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Display Name"
              required
              placeholder="e.g. Acme Corp"
              error={errors.displayName?.message}
              {...register("displayName", {
                required: "Display name is required.",
                validate: (value) => Boolean(value?.trim()) || "Display name is required.",
                maxLength: { value: 160, message: "Display name must be 160 characters or fewer." },
              })}
            />

            <Input
              label="Legal Company Name"
              placeholder="e.g. Acme Enterprises Pvt Ltd"
              error={errors.companyName?.message}
              {...register("companyName", { maxLength: { value: 200, message: "Company name must be 200 characters or fewer." } })}
            />

            <Input
              label="GSTIN"
              placeholder="22AAAAA0000A1Z5"
              error={errors.gstin?.message}
              {...register("gstin", {
                validate: (value) => !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i.test(value.trim()) || "Enter a valid 15-character GSTIN.",
              })}
            />

            <Input
              label="Primary Phone"
              placeholder="+91 98765 43210"
              error={errors.phone?.message}
              {...register("phone", { maxLength: { value: 20, message: "Phone number must be 20 characters or fewer." } })}
            />

            <Input
              label="Accounts Email"
              type="email"
              placeholder="billing@acme.com"
              error={errors.email?.message}
              {...register("email", {
                validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || "Enter a valid email address.",
              })}
            />

            <Input
              label="Default Credit Days"
              type="number"
              min="0"
              max="365"
              placeholder="30"
              error={errors.defaultCreditDays?.message}
              {...register("defaultCreditDays", {
                valueAsNumber: true,
                min: { value: 0, message: "Credit days cannot be negative." },
                max: { value: 365, message: "Credit days cannot exceed 365." },
                validate: (value) => Number.isInteger(value) || "Enter a whole number of days.",
              })}
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
                error={errors.billingAddress?.line1?.message}
                {...register("billingAddress.line1", { maxLength: { value: 200, message: "Street address must be 200 characters or fewer." } })}
              />
            </div>
            <Input label="City" placeholder="Mumbai" error={errors.billingAddress?.city?.message} {...register("billingAddress.city", { maxLength: { value: 100, message: "City must be 100 characters or fewer." } })} />
            <Input label="State" placeholder="Maharashtra" error={errors.billingAddress?.state?.message} {...register("billingAddress.state", { maxLength: { value: 100, message: "State must be 100 characters or fewer." } })} />
            <Input label="PIN Code" placeholder="400001" error={errors.billingAddress?.postalCode?.message} {...register("billingAddress.postalCode", { maxLength: { value: 20, message: "PIN code must be 20 characters or fewer." } })} />
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
                      label="Contact name"
                      placeholder="Name"
                      required
                      error={(errors.contacts?.[idx] as any)?.name?.message}
                      {...register(`contacts.${idx}.name` as const, {
                        required: "Contact name is required.",
                        validate: (value) => Boolean(value?.trim()) || "Contact name is required.",
                        maxLength: { value: 120, message: "Contact name must be 120 characters or fewer." },
                      })}
                    />
                    <Input
                      label="Designation"
                      placeholder="Designation"
                      error={(errors.contacts?.[idx] as any)?.designation?.message}
                      {...register(`contacts.${idx}.designation` as const, { maxLength: { value: 100, message: "Designation must be 100 characters or fewer." } })}
                    />
                    <Input
                      label="Phone"
                      placeholder="Phone"
                      error={(errors.contacts?.[idx] as any)?.phone?.message}
                      {...register(`contacts.${idx}.phone` as const, { maxLength: { value: 20, message: "Phone number must be 20 characters or fewer." } })}
                    />
                    <Input
                      label="Email"
                      placeholder="Email"
                      type="email"
                      error={(errors.contacts?.[idx] as any)?.email?.message}
                      {...register(`contacts.${idx}.email` as const, {
                        validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || "Enter a valid email address.",
                      })}
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
          label="Notes"
          error={errors.notes?.message}
          {...register("notes", { maxLength: { value: 2000, message: "Notes must be 2,000 characters or fewer." } })}
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
