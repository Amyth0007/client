import { Navigate, Route, Routes } from "react-router";
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

function DefaultDashboard() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <Navigate to="/platform" replace />;
  if (user?.role === "field_recovery") return <Navigate to="/recovery" replace />;
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

          {/* Customers */}
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/customers/:id/edit" element={<CustomerFormPage />} />

          {/* Invoices */}
          <Route path="/invoices" element={<InvoiceListPage />} />
          <Route path="/invoices/new" element={<InvoiceFormPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />

          {/* Payments */}
          <Route path="/payments" element={<PaymentListPage />} />
          <Route path="/payments/new" element={<PaymentFormPage />} />
          <Route path="/payments/:id" element={<PaymentDetailPage />} />

          {/* Recovery */}
          <Route path="/recovery" element={<RecoveryListPage />} />
          <Route path="/recovery/new" element={<RecoveryFormPage />} />
          <Route path="/recovery/:id" element={<RecoveryDetailPage />} />

          {/* Commitments */}
          <Route path="/commitments" element={<CommitmentListPage />} />
          <Route path="/commitments/new" element={<CommitmentFormPage />} />
          <Route path="/commitments/:id" element={<CommitmentDetailPage />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
