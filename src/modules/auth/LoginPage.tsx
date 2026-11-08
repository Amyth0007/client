import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useLocation } from "react-router";
import { Link } from "react-router";
import { Building2, ArrowRight } from "lucide-react";
import { useAuth } from "./AuthContext.js";
import { Input } from "../../components/common/Input.js";
import { Button } from "../../components/common/Button.js";

export function LoginPage({ fieldOnly = false }: { fieldOnly?: boolean }) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const from = location.state?.from?.pathname || "/dashboard";

  const onSubmit = async (values: any) => {
    setError(null);
    setIsLoading(true);
    try {
      const user = await login(values);
      if (fieldOnly && user.role !== "field_recovery") {
        try { await logout(); } catch { /* Clear the local session even if logout request fails. */ }
        setError("This sign-in is for field executives. Use the organization sign-in instead.");
        return;
      }
      if (!fieldOnly && user.role === "field_recovery") {
        try { await logout(); } catch { /* Clear the local session even if logout request fails. */ }
        setError("Field executives must sign in through the field executive login.");
        return;
      }
      navigate(fieldOnly ? "/recovery" : from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Failed to sign in. Check email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {fieldOnly ? "Field Executive Sign In" : "Sign in to Recovr"}
          </h2>
          <p className="mt-1.5 text-xs text-slate-600">
            B2B Receivables and Payment Recovery SaaS
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Work Email"
              type="email"
              placeholder="you@company.com"
              required
              error={errors.email?.message}
              {...register("email", { required: "Email is required" })}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              error={errors.password?.message}
              {...register("password", { required: "Password is required" })}
            />

            <div className="pt-2">
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500">
          {fieldOnly ? "Sign in to view your assigned recovery visits." : "Secure multi-tenant B2B receivables platform"}
        </p>
        <p className="text-center text-sm text-slate-600">
          {fieldOnly ? "Organization team? " : "Field executive? "}
          <Link className="font-medium text-indigo-600 hover:underline" to={fieldOnly ? "/login" : "/field-login"}>
            {fieldOnly ? "Organization sign in" : "Use field login"}
          </Link>
        </p>
      </div>
    </div>
  );
}
