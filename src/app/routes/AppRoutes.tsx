import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { AppLayout } from "../../components/layouts/AppLayout.js";
import { ProtectedRoute } from "../../modules/auth/ProtectedRoute.js";
import { LoginPage } from "../../modules/auth/LoginPage.js";
import { DashboardPage } from "../../modules/dashboard/DashboardPage.js";
import { CustomerListPage } from "../../modules/customers/CustomerListPage.js";
import { CustomerFormPage } from "../../modules/customers/CustomerFormPage.js";
import { CustomerDetailPage } from "../../modules/customers/CustomerDetailPage.js";
import { InvoiceListPage } from "../../modules/invoices/InvoiceListPage.js";
import { InvoiceFormPage } from "../../modules/invoices/InvoiceFormPage.js";
import { InvoiceDetailPage } from "../../modules/invoices/InvoiceDetailPage.js";
import { PaymentListPage } from "../../modules/payments/PaymentListPage.js";
import { PaymentFormPage } from "../../modules/payments/PaymentFormPage.js";
import { PaymentDetailPage } from "../../modules/payments/PaymentDetailPage.js";
import { RecoveryListPage } from "../../modules/recovery/RecoveryListPage.js";
import { RecoveryFormPage } from "../../modules/recovery/RecoveryFormPage.js";
import { RecoveryDetailPage } from "../../modules/recovery/RecoveryDetailPage.js";
import { CommitmentListPage } from "../../modules/commitments/CommitmentListPage.js";
import { CommitmentFormPage } from "../../modules/commitments/CommitmentFormPage.js";
import { CommitmentDetailPage } from "../../modules/commitments/CommitmentDetailPage.js";
import { SettingsPage } from "../../modules/settings/SettingsPage.js";
import { NotFoundPage } from "./NotFoundPage.js";
import { PlatformAdminPage } from "../../modules/platform/PlatformAdminPage.js";
import { AttendancePage } from "../../modules/attendance/AttendancePage.js";
import { useAuth } from "../../modules/auth/AuthContext.js";
import { ORGANIZATION_MODULES, userCanAccessModule, type OrganizationModuleKey } from "../../modules/platform/module-registry.js";

function ModuleGate({ moduleKey }: { moduleKey: OrganizationModuleKey }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user?.role === "employee" && /\/(new|edit)(\/|$)/.test(location.pathname)) return <Navigate to={`/${moduleKey === "reports" ? "dashboard" : moduleKey}`} replace />;
  if (!user?.organizationId || userCanAccessModule(user.role, user.organization?.modules, user.modulePermissions, moduleKey, user.modulePermissionsConfigured ?? false)) return <Outlet />;
  const moduleName = ORGANIZATION_MODULES.find((module) => module.key === moduleKey)?.name ?? moduleKey;
  return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="text-xl font-semibold text-slate-900">{moduleName} is disabled</h1><p className="mt-2 text-sm text-slate-600">This module is not enabled for your organization. Contact your organization administrator.</p>{moduleKey !== "settings" && <Link className="mt-4 inline-block text-sm font-medium text-indigo-700 underline" to="/settings">Go to Settings</Link>}</div>;
}

function DefaultDashboard() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <Navigate to="/platform" replace />;
  if (user?.role === "field_recovery") {
    if (userCanAccessModule(user.role, user.organization?.modules, user.modulePermissions, "recovery", user.modulePermissionsConfigured ?? false)) return <Navigate to="/recovery" replace />;
    if (userCanAccessModule(user.role, user.organization?.modules, user.modulePermissions, "attendance", user.modulePermissionsConfigured ?? false)) return <Navigate to="/attendance" replace />;
    return <ModuleGate moduleKey="recovery" />;
  }
  if (user?.role === "employee") {
    const first = ["attendance", "recovery", "reports", "customers", "invoices", "payments", "commitments"] as const;
    const module = first.find((key) => userCanAccessModule(user.role, user.organization?.modules, user.modulePermissions, key, user.modulePermissionsConfigured ?? false));
    if (module) return <Navigate to={module === "reports" ? "/dashboard" : `/${module}`} replace />;
    return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="text-xl font-semibold">No screens assigned</h1><p className="mt-2 text-sm text-slate-600">Ask your administrator to grant access to a screen.</p></div>;
  }
  if (user?.organizationId && !userCanAccessModule(user.role, user.organization?.modules, user.modulePermissions, "reports", user.modulePermissionsConfigured ?? false)) return <ModuleGate moduleKey="reports" />;
  return <DashboardPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/field-login" element={<LoginPage fieldOnly />} />

      {/* Authenticated routes */}
      <Route element={<ProtectedRoute />}>
        {/* In-App Shell with Sidebar and Mobile Bottom Bar */}
        <Route element={<AppLayout />}>
          <Route index element={<DefaultDashboard />} />
          <Route path="/dashboard" element={<DefaultDashboard />} />
          <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
            <Route path="/platform" element={<PlatformAdminPage />} />
          </Route>  

          <Route element={<ModuleGate moduleKey="customers" />}>
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
          </Route>

          <Route element={<ModuleGate moduleKey="invoices" />}>
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/new" element={<InvoiceFormPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />
          </Route>

          <Route element={<ModuleGate moduleKey="payments" />}>
          <Route path="/payments" element={<PaymentListPage />} />
          <Route path="/payments/new" element={<PaymentFormPage />} />
          <Route path="/payments/:id" element={<PaymentDetailPage />} />
          </Route>

          <Route element={<ModuleGate moduleKey="recovery" />}>
          <Route path="/recovery" element={<RecoveryListPage />} />
          <Route path="/recovery/new" element={<RecoveryFormPage />} />
          <Route path="/recovery/:id" element={<RecoveryDetailPage />} />
          </Route>

          <Route element={<ModuleGate moduleKey="commitments" />}>
          <Route path="/commitments" element={<CommitmentListPage />} />
          <Route path="/commitments/new" element={<CommitmentFormPage />} />
          <Route path="/commitments/:id" element={<CommitmentDetailPage />} />
          </Route>

          {/* Settings */}
          <Route element={<ModuleGate moduleKey="settings" />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/attendance" element={<AttendancePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
