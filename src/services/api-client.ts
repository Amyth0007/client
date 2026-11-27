import type { OrganizationModuleKey } from "../modules/platform/module-registry.js";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type AttendanceOfficeLocation = { id: string; name: string; address: string; latitude: number; longitude: number; geofenceRadiusM: number; status: "active" | "inactive" };
export type AttendancePolicy = { expectedCheckIn: string; expectedCheckOut: string; gracePeriodMinutes: number; halfDayHours: number; gpsAccuracyThresholdM: number; locationVerificationRequired: boolean; weeklyHolidays: number[]; correctionRequestsEnabled: boolean };
export type AttendanceRecord = {
  id: string; employeeId: string; attendanceDate: string; officeLocationId: string | null; officeName?: string;
  shiftId?: string | null; shiftName?: string | null;
  employee?: { name: string; email: string } | null; status: "checked_in" | "completed" | "present" | "half_day" | "absent" | "leave"; lateArrival: boolean;
  manualAdjustment?: { id: string; reason: string; checkInAt: string | null; checkOutAt: string | null; adjustedBy: string };
  totalWorkingMinutes: number | null; unpaidBreakMinutes?: number; halfDay: boolean; correctedCheckOutAt: string | null; correctionId: string | null;
  checkIn: { at: string; latitude?: number | null; longitude?: number | null; gpsAccuracyM?: number | null; officeDistanceM?: number | null; locationVerification?: "verified" | "not_enforced"; photoAssetId: string | null; manuallyEntered?: boolean } | null;
  checkOut: { at: string; latitude?: number | null; longitude?: number | null; gpsAccuracyM?: number | null; officeDistanceM?: number | null; locationVerification?: "verified" | "not_enforced"; photoAssetId: string | null; manuallyEntered?: boolean } | null;
};
export type AttendanceCorrection = { id: string; attendanceRecordId: string; employeeId: string; attendanceDate?: string; currentCheckInAt?: string | null; currentCheckOutAt?: string | null; requestedCheckInAt: string | null; requestedCheckOutAt: string | null; reason: string; evidenceFileAssetId: string | null; status: "pending" | "approved" | "rejected"; reviewedBy: string | null; reviewedAt: string | null; reviewComment: string; createdAt: string; employee?: { name: string; email: string } | null };
export type AttendanceDashboard = { date: string; totalEmployees: number; presentToday: number; absentToday: number; lateArrivals: number; currentlyCheckedIn: number; exceptions: number; holiday: boolean };
export type ShiftSwapRequest = {
  id: string;
  shiftDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requesterEmployee?: { id: string; employeeNumber?: string; name?: string } | null;
  targetEmployee?: { id: string; employeeNumber?: string; name?: string } | null;
  requesterShift?: { id: string; name: string; startTime: string; endTime: string; crossesMidnight?: boolean } | null;
  targetShift?: { id: string; name: string; startTime: string; endTime: string; crossesMidnight?: boolean } | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewComment?: string;
  createdAt: string;
};

let inMemoryToken: string | null = null;
let authSessionGeneration = 0;
let refreshInFlight: Promise<string | null> | null = null;
let activeApiRequests = 0;
const apiActivityListeners = new Set<(active: number, delta: number) => void>();
const pendingRequests = new Map<string, Promise<unknown>>();

export function subscribeApiActivity(listener: () => void) {
  const wrappedListener = () => listener();
  apiActivityListeners.add(wrappedListener);
  return () => apiActivityListeners.delete(wrappedListener);
}

export function subscribeApiActivityChanges(listener: (active: number, delta: number) => void) {
  apiActivityListeners.add(listener);
  return () => apiActivityListeners.delete(listener);
}

export function getApiActivitySnapshot() {
  return activeApiRequests;
}

function updateApiActivity(delta: number) {
  activeApiRequests = Math.max(0, activeApiRequests + delta);
  apiActivityListeners.forEach((listener) => listener(activeApiRequests, delta));
}

async function trackedFetch(input: RequestInfo | URL, init?: RequestInit) {
  updateApiActivity(1);
  try {
    return await fetch(input, init);
  } finally {
    updateApiActivity(-1);
  }
}

function refreshAccessToken(expectedGeneration: number): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(apiUrl("/auth/refresh"), { method: "POST", credentials: "include" });
        if (!response.ok) return null;
        const payload = await response.json();
        const token = payload?.data?.accessToken as string | undefined;
        if (!token || expectedGeneration !== authSessionGeneration) return null;
        setAccessToken(token);
        return token;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight.then((token) => expectedGeneration === authSessionGeneration ? token : null);
}

function apiUrl(path: string): string {
  return `/api/v1${path}`;
}

function notifySessionExpired() {
  invalidateAuthSession();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("auth-session-expired"));
}

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
}

export function invalidateAuthSession() {
  authSessionGeneration += 1;
  inMemoryToken = null;
}

export function getAccessToken(): string | null {
  return inMemoryToken;
}

export function formatMoney(amountMinor: number | undefined | null, currency = "INR"): string {
  if (amountMinor == null || isNaN(amountMinor)) return "₹0.00";
  const rupees = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(rupees);
}

export function parseMoney(rupeeString: string): number {
  const cleaned = rupeeString.replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

function buildQueryString(params?: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.toString();
}

async function performRequest<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<{ data: T; meta?: { page: number; limit: number; total: number } }> {
  const requestGeneration = authSessionGeneration;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (inMemoryToken) {
    headers.set("Authorization", `Bearer ${inMemoryToken}`);
  }

  updateApiActivity(1);
  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers,
      credentials: "include", // send cookies for refresh token
    });

  // Handle 401 and try refresh once
  if (res.status === 401 && requestGeneration === authSessionGeneration && !isRetry && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    const token = await refreshAccessToken(requestGeneration);
    if (token && requestGeneration === authSessionGeneration) return request<T>(path, options, true);
    if (requestGeneration === authSessionGeneration) notifySessionExpired();
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Invalid response from server", res.status);
  }

  if (!res.ok || body.success === false) {
    throw new ApiError(
      body?.error?.code || "ERROR",
      body?.error?.message || "An error occurred",
      res.status,
      body?.error?.details,
    );
  }

    return body;
  } finally {
    updateApiActivity(-1);
  }
}

function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<{ data: T; meta?: { page: number; limit: number; total: number } }> {
  const method = (options.method ?? "GET").toUpperCase();
  if (isRetry) return performRequest<T>(path, options, isRetry);
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return performRequest<T>(path, options, isRetry);
  if (options.body && typeof options.body !== "string") return performRequest<T>(path, options, isRetry);

  // Concurrent identical writes share one network operation so rapid repeated
  // clicks cannot apply the same mutation twice.
  const bodyKey = typeof options.body === "string" ? options.body : "";
  const key = `${authSessionGeneration}:${method}:${path}:${bodyKey}`;
  const existing = pendingRequests.get(key);
  if (existing) return existing as Promise<{ data: T; meta?: { page: number; limit: number; total: number } }>;

  const pending = performRequest<T>(path, options, isRetry);
  pendingRequests.set(key, pending);
  void pending.finally(() => {
    const release = () => {
      if (pendingRequests.get(key) === pending) pendingRequests.delete(key);
    };
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) setTimeout(release, 500);
    else release();
  }).catch(() => undefined);
  return pending;
}

export const api = {
  listVisitorForms: async () => (await request<any[]>("/visitors/forms")).data,
  listPublishedVisitorForms: async () => (await request<any[]>("/visitors/published-forms")).data,
  submitInternalVisitorRegistration: async (formId: string, values: Record<string, unknown>, channel: "admin" | "guard", photoAssetId?: string) => (await request<any>("/visitors/registrations", { method: "POST", body: JSON.stringify({ formId, values, channel, photoAssetId }) })).data,
  getVisitorPass: async (code: string) => (await request<any>(`/visitors/passes/${encodeURIComponent(code)}`)).data,
  submitVisitorPassRegistration: async (code: string, values: Record<string, unknown>, photoAssetId?: string) => (await request<any>(`/visitors/passes/${encodeURIComponent(code)}/registrations`, { method: "POST", body: JSON.stringify({ values, photoAssetId }) })).data,
  getVisitorQrRecord: async (code: string) => (await request<any>(`/visitors/visitor-qr/${encodeURIComponent(code)}`)).data,
  checkInVisitor: async (code: string) => (await request<any>(`/visitors/visitor-qr/${encodeURIComponent(code)}/check-in`, { method: "POST", body: JSON.stringify({}) })).data,
  checkOutVisitor: async (code: string) => (await request<any>(`/visitors/visitor-qr/${encodeURIComponent(code)}/check-out`, { method: "POST", body: JSON.stringify({}) })).data,
  saveVisitorForm: async (form: any) => (await request<any>(`/visitors/forms${form.id ? `/${form.id}` : ""}`, { method: form.id ? "PUT" : "POST", body: JSON.stringify(form) })).data,
  createVisitorPass: async (id: string, label: string) => (await request<any>(`/visitors/forms/${id}/passes`, { method: "POST", body: JSON.stringify({ label }) })).data,
  listVisitorRegistrations: async () => (await request<any[]>("/visitors/registrations")).data,
  getPublicVisitorForm: async (code: string, publicCode?: string) => (await request<any>(code === "current" && publicCode ? `/visitors/public/organization/${encodeURIComponent(publicCode)}/current` : `/visitors/public/${encodeURIComponent(code)}`)).data,
  submitPublicVisitorForm: async (code: string, values: Record<string, unknown>) => (await request<any>(`/visitors/public/${encodeURIComponent(code)}/registrations`, { method: "POST", body: JSON.stringify({ values }) })).data,
  uploadPublicVisitorFile: async (code: string, fieldKey: string, file: File) => {
    const form = new FormData(); form.append("file", file); form.append("fieldKey", fieldKey);
    const response = await trackedFetch(apiUrl(`/visitors/public/${encodeURIComponent(code)}/uploads`), { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok || payload.success === false) throw new ApiError(payload?.error?.code || "UPLOAD_FAILED", payload?.error?.message || "File upload failed", response.status);
    return payload.data;
  },
  // Auth
  login: async (credentials: { email: string; password: string }) => {
    const requestGeneration = authSessionGeneration;
    const res = await request<{ accessToken: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    if (requestGeneration !== authSessionGeneration) throw new ApiError("UNAUTHORIZED", "Sign-in was superseded by a session change", 401);
    setAccessToken(res.data.accessToken);
    return res.data;
  },
  refresh: async () => {
    const requestGeneration = authSessionGeneration;
    const res = await request<{ accessToken: string; user: any }>("/auth/refresh", {
      method: "POST",
    });
    if (requestGeneration !== authSessionGeneration) throw new ApiError("UNAUTHORIZED", "Session refresh was superseded by a session change", 401);
    setAccessToken(res.data.accessToken);
    return res.data;
  },
  logout: async () => {
    invalidateAuthSession();
    try {
      await trackedFetch(apiUrl("/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Local sign-out must still complete when the network is unavailable.
    } finally { /* Local auth was invalidated before the network request. */ }
  },
  getMe: async () => {
    const res = await request<any>("/auth/me");
    return res.data;
  },
  // Organization & Employees
  getOrganization: async () => {
    const res = await request<any>("/organization");
    return res.data;
  },
  updateOrganization: async (data: any) => {
    const res = await request<any>("/organization", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  getGmailConnection: async () => {
    const res = await request<{ connected: boolean; status: string; email: string | null; connectedAt: string | null; lastSuccessfulEmailAt: string | null }>("/gmail/connection");
    return res.data;
  },
  startGmailAuthorization: async () => {
    const res = await request<{ authorizationUrl: string }>("/gmail/oauth/start", { method: "POST" });
    return res.data.authorizationUrl;
  },
  disconnectGmail: async () => request("/gmail/disconnect", { method: "POST" }),
  sendEmail: async (data: { customerId: string; invoiceId?: string; recipientEmail: string; subject: string; body: string }) => {
    const res = await request<{ id: string; gmailMessageId: string; sentAt: string }>("/gmail/send", { method: "POST", body: JSON.stringify(data) });
    return res.data;
  },
  listEmployees: async (params?: Record<string, any>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/users?${query}`);
  },
  createEmployee: async (data: any) => {
    const res = await request<any>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateEmployee: async (id: string, data: any) => {
    const res = await request<any>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  listCustomRoles: async () => (await request<any[]>("/users/roles")).data,
  createCustomRole: async (data: Record<string, unknown>) => (await request<any>("/users/roles", { method: "POST", body: JSON.stringify(data) })).data,
  updateCustomRole: async (id: string, data: Record<string, unknown>) => (await request<any>(`/users/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) })).data,
  archiveCustomRole: async (id: string) => (await request<any>(`/users/roles/${id}`, { method: "DELETE" })).data,
  listWorkforceEmployees: async (params?: Record<string, unknown>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/workforce/employees?${query}`);
  },
  listWorkforceLoginAccounts: async () => (await request<any[]>("/workforce/login-accounts")).data,
  importTeamMembersAsEmployees: async () => (await request<{ createdCount: number; skippedCount: number }>("/workforce/employees/import-team", { method: "POST" })).data,
  createWorkforceEmployee: async (data: Record<string, unknown>) => {
    const res = await request<any>("/workforce/employees", { method: "POST", body: JSON.stringify(data) });
    return res.data;
  },
  updateWorkforceEmployee: async (id: string, data: Record<string, unknown>) => {
    const res = await request<any>(`/workforce/employees/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    return res.data;
  },
  importWorkforceEmployees: async (file: File) => { const body = new FormData(); body.append("file", file); return request<{ createdCount: number; errors: Array<{ row: number; message: string }> }>("/workforce/employees/import", { method: "POST", body }); },
  listWorkforceDepartments: async () => (await request<any[]>("/workforce/departments")).data,
  createWorkforceDepartment: async (data: Record<string, unknown>) => (await request<any>("/workforce/departments", { method: "POST", body: JSON.stringify(data) })).data,
  listWorkforceDesignations: async () => (await request<any[]>("/workforce/designations")).data,
  createWorkforceDesignation: async (data: Record<string, unknown>) => (await request<any>("/workforce/designations", { method: "POST", body: JSON.stringify(data) })).data,
  listWorkforceShifts: async (section?: "shifts" | "assignments" | "assignment-form") => (await request<{ shifts: any[]; assignments: any[] }>(`/workforce/shifts${section ? `?section=${section}` : ""}`)).data,
  createWorkforceShift: async (data: Record<string, unknown>) => (await request<any>("/workforce/shifts", { method: "POST", body: JSON.stringify(data) })).data,
  updateWorkforceShift: async (id: string, data: Record<string, unknown>) => (await request<any>(`/workforce/shifts/${id}`, { method: "PATCH", body: JSON.stringify(data) })).data,
  deleteWorkforceShift: async (id: string) => (await request<any>(`/workforce/shifts/${id}`, { method: "DELETE" })).data,
  assignWorkforceShift: async (data: Record<string, unknown>) => (await request<any>("/workforce/shift-assignments", { method: "POST", body: JSON.stringify(data) })).data,
  requestShiftSwap: async (data: { targetEmployeeId: string; shiftDate: string; reason: string }) => (await request<any>("/workforce/shift-swaps", { method: "POST", body: JSON.stringify(data) })).data,
  listShiftSwaps: async (mine = false) => (await request<any[]>(`/workforce/shift-swaps${mine ? "/mine" : ""}`)).data,
  reviewShiftSwap: async (id: string, decision: "approved" | "rejected", comment?: string) => (await request<any>(`/workforce/shift-swaps/${id}/review`, { method: "PATCH", body: JSON.stringify({ decision, comment }) })).data,
  cancelShiftSwap: async (id: string) => (await request<any>(`/workforce/shift-swaps/${id}`, { method: "DELETE" })).data,
  getPayrollCompensation: async () => (await request<any>("/payroll/compensation")).data,
  listPayrollEmployees: async (params?: Record<string, unknown>) => request<any[]>(`/payroll/employees?${buildQueryString(params)}`),
  createPayrollComponent: async (data: Record<string, unknown>) => (await request<any>("/payroll/components", { method: "POST", body: JSON.stringify(data) })).data,
  createPayStructure: async (data: Record<string, unknown>) => (await request<any>("/payroll/structures", { method: "POST", body: JSON.stringify(data) })).data,
  updatePayStructure: async (id: string, data: Record<string, unknown>) => (await request<any>(`/payroll/structures/${id}`, { method: "PATCH", body: JSON.stringify(data) })).data,
  deletePayStructure: async (id: string) => (await request<any>(`/payroll/structures/${id}`, { method: "DELETE" })).data,
  assignCompensation: async (data: Record<string, unknown>) => (await request<any>("/payroll/assignments", { method: "POST", body: JSON.stringify(data) })).data,
  updateCompensationAssignment: async (id: string, data: Record<string, unknown>) => (await request<any>(`/payroll/assignments/${id}`, { method: "PATCH", body: JSON.stringify(data) })).data,
  deleteCompensationAssignment: async (id: string) => (await request<any>(`/payroll/assignments/${id}`, { method: "DELETE" })).data,
  listDailyEarnings: async (params?: Record<string, unknown>) => (await request<any[]>(`/payroll/daily-earnings?${buildQueryString(params)}`)).data,
  createDailyEarning: async (data: Record<string, unknown>) => (await request<any>("/payroll/daily-earnings", { method: "POST", body: JSON.stringify(data) })).data,
  reviewDailyEarning: async (id: string, decision: "approved" | "rejected") => (await request<any>(`/payroll/daily-earnings/${id}/review`, { method: "PATCH", body: JSON.stringify({ decision }) })).data,
  listPayrollRuns: async () => (await request<any[]>("/payroll/runs")).data,
  createPayrollRun: async (data: Record<string, unknown>) => (await request<any>("/payroll/runs", { method: "POST", body: JSON.stringify(data) })).data,
  cancelPayrollRun: async (id: string) => (await request<any>(`/payroll/runs/${id}/cancel`, { method: "POST" })).data,
  deletePayrollRun: async (id: string) => (await request<any>(`/payroll/runs/${id}`, { method: "DELETE" })).data,
  createPayrollRevision: async (id: string, data: Record<string, unknown>) => (await request<any>(`/payroll/runs/${id}/revisions`, { method: "POST", body: JSON.stringify(data) })).data,
  cancelPayrollRevision: async (id: string) => (await request<any>(`/payroll/runs/${id}/cancel-revision`, { method: "POST" })).data,
  submitPayrollRun: async (id: string) => (await request<any>(`/payroll/runs/${id}/submit`, { method: "POST" })).data,
  approvePayrollRun: async (id: string) => (await request<any>(`/payroll/runs/${id}/approve`, { method: "POST" })).data,
  finalizePayrollRun: async (id: string) => (await request<any>(`/payroll/runs/${id}/finalize`, { method: "POST" })).data,
  recordPayrollPayment: async (id: string, data: Record<string, unknown>) => (await request<any>(`/payroll/runs/${id}/payments`, { method: "POST", body: JSON.stringify(data) })).data,
  listMyPayroll: async () => (await request<any[]>("/my-payroll")).data,
  getOvertime: async (section?: "policies" | "entries") => (await request<any>(`/overtime${section ? `?section=${section}` : ""}`)).data,
  createOvertimePolicy: async (data: Record<string, unknown>) => (await request<any>("/overtime/policies", { method: "POST", body: JSON.stringify(data) })).data,
  updateOvertimePolicy: async (id: string, data: Record<string, unknown>) => (await request<any>(`/overtime/policies/${id}`, { method: "PATCH", body: JSON.stringify(data) })).data,
  deleteOvertimePolicy: async (id: string) => (await request<any>(`/overtime/policies/${id}`, { method: "DELETE" })).data,
  createOvertimeEntry: async (data: Record<string, unknown>) => (await request<any>("/overtime/entries", { method: "POST", body: JSON.stringify(data) })).data,
  reviewOvertime: async (id: string, decision: "approved" | "rejected") => (await request<any>(`/overtime/entries/${id}/review`, { method: "PATCH", body: JSON.stringify({ decision }) })).data,
  getLeaveAdmin: async () => (await request<any>("/leave/types")).data,
  getLeaveTypes: async () => (await request<any>("/leave/types/available")).data,
  listLeaveRequests: async (mine = false) => (await request<any[]>(`/leave/requests${mine ? "/mine" : ""}`)).data,
  createLeaveType: async (data: Record<string, unknown>) => (await request<any>("/leave/types", { method: "POST", body: JSON.stringify(data) })).data,
  updateLeaveType: async (id: string, data: Record<string, unknown>) => (await request<any>(`/leave/types/${id}`, { method: "PATCH", body: JSON.stringify(data) })).data,
  deleteLeaveType: async (id: string) => (await request<any>(`/leave/types/${id}`, { method: "DELETE" })).data,
  createLeaveRequest: async (data: Record<string, unknown>) => (await request<any>("/leave/requests", { method: "POST", body: JSON.stringify(data) })).data,
  reviewLeaveRequest: async (id: string, decision: "approved" | "rejected", comment = "") => (await request<any>(`/leave/requests/${id}/review`, { method: "PATCH", body: JSON.stringify({ decision, comment }) })).data,
  getWorkforceReport: async (type: "attendance" | "payroll" | "overtime" | "leave", from: string, to: string) => (await request<any>(`/workforce-reports/${type}?${buildQueryString({ from, to })}`)).data,
  listComplianceRules: async () => (await request<any[]>("/compliance/rules")).data,
  createComplianceRule: async (data: Record<string, unknown>) => (await request<any>("/compliance/rules", { method: "POST", body: JSON.stringify(data) })).data,
  submitComplianceRule: async (id: string) => (await request<any>(`/compliance/rules/${id}/submit`, { method: "POST" })).data,
  activateComplianceRule: async (id: string) => (await request<any>(`/compliance/rules/${id}/activate`, { method: "POST" })).data,
  listPendingComplianceRules: async () => (await request<any[]>("/platform/compliance/pending")).data,
  reviewComplianceRule: async (organizationId: string, id: string, data: { decision: "validated" | "rejected"; legalReviewReference: string }) => (await request<any>(`/platform/compliance/${organizationId}/rules/${id}/review`, { method: "POST", body: JSON.stringify(data) })).data,

  // Customers
  listCustomers: async (params?: Record<string, any>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/customers?${query}`);
  },
  getCustomer: async (id: string) => {
    const res = await request<any>(`/customers/${id}`);
    return res.data;
  },
  createCustomer: async (data: any) => {
    const res = await request<any>("/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateCustomer: async (id: string, data: any) => {
    const res = await request<any>(`/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  archiveCustomer: async (id: string) => {
    const res = await request<any>(`/customers/${id}/archive`, {
      method: "POST",
    });
    return res.data;
  },

  // Invoices
  listInvoices: async (params?: Record<string, any>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/invoices?${query}`);
  },
  getInvoice: async (id: string) => {
    const res = await request<any>(`/invoices/${id}`);
    return res.data;
  },
  createInvoiceDraft: async (data: any) => {
    const res = await request<any>("/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateInvoiceDraft: async (id: string, data: any) => {
    const res = await request<any>(`/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  issueInvoice: async (id: string) => {
    const res = await request<any>(`/invoices/${id}/issue`, {
      method: "POST",
    });
    return res.data;
  },
  cancelInvoice: async (id: string, reason: string) => {
    const res = await request<any>(`/invoices/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },
  discardDraft: async (id: string) => {
    const res = await request<any>(`/invoices/${id}`, {
      method: "DELETE",
    });
    return res.data;
  },
  updateAcknowledgement: async (id: string, data: any) => {
    const res = await request<any>(`/invoices/${id}/acknowledgements`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  getAcknowledgementHistory: async (id: string) => {
    const res = await request<any[]>(`/invoices/${id}/acknowledgements`);
    return res.data;
  },

  // Payments
  listPayments: async (params?: Record<string, any>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/payments?${query}`);
  },
  getPayment: async (id: string) => {
    const res = await request<any>(`/payments/${id}`);
    return res.data;
  },
  createPayment: async (data: any) => {
    const res = await request<any>("/payments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  reversePayment: async (id: string, reason: string) => {
    const res = await request<any>(`/payments/${id}/reverse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },
  getInvoiceLedger: async (invoiceId: string) => {
    const res = await request<any[]>(`/payments/invoices/${invoiceId}/ledger`);
    return res.data;
  },

  // Recovery
  listRecoveryAssignments: async (params?: Record<string, any>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/recovery-assignments?${query}`);
  },
  getRecoveryAssignment: async (id: string) => {
    const res = await request<any>(`/recovery-assignments/${id}`);
    return res.data;
  },
  recordRecoveryCallAttempt: async (assignmentId: string, invoiceId: string) => {
    const res = await request<{ invoiceId: string; callAttemptCount: number; phone: string; attemptedAt: string }>(
      `/recovery-assignments/${assignmentId}/invoices/${invoiceId}/call-attempts`,
      { method: "POST" },
    );
    return res.data;
  },
  createRecoveryAssignment: async (data: any) => {
    const res = await request<any>("/recovery-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateRecoveryStatus: async (id: string, data: any) => {
    const res = await request<any>(`/recovery-assignments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  createRecoveryVisit: async (assignmentId: string, data: any) => {
    const res = await request<any>(`/recovery-assignments/${assignmentId}/visits`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  listRecoveryVisits: async (assignmentId: string) => {
    const res = await request<any[]>(`/recovery-assignments/${assignmentId}/visits`);
    return res.data;
  },

  // Commitments
  listCommitments: async (params?: Record<string, any>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/commitments?${query}`);
  },
  getCommitment: async (id: string) => {
    const res = await request<any>(`/commitments/${id}`);
    return res.data;
  },
  createCommitment: async (data: any) => {
    const res = await request<any>("/commitments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  cancelCommitment: async (id: string, reason: string) => {
    const res = await request<any>(`/commitments/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  },
  evaluateCommitment: async (id: string, data: any) => {
    const res = await request<any>(`/commitments/${id}/evaluate`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },

  // Reports
  getDashboardMetrics: async () => {
    const res = await request<any>("/reports/dashboard");
    return res.data;
  },
  getAgingBuckets: async () => {
    const res = await request<any>("/reports/aging");
    return res.data;
  },
  getCustomerOutstanding: async () => {
    const res = await request<any[]>("/reports/outstanding/customers");
    return res.data;
  },

  // Attendance
  getAttendanceConfig: async () => {
    const res = await request<{
      policy: AttendancePolicy;
      locations: AttendanceOfficeLocation[];
      todayShift?: {
        id: string;
        name: string;
        shiftType: string;
        startTime: string;
        endTime: string;
        crossesMidnight: boolean;
        flexibleWindowMinutes: number;
        breaks: Array<{ name: string; startTime: string; endTime: string; paid: boolean }>;
        weeklyOffs: number[];
        isWeeklyOff: boolean;
      } | null;
    }>("/attendance/config");
    return res.data;
  },
  listAttendanceEmployees: async () => {
    return request<Array<{ id: string; name: string; email: string; employeeNumber?: string; profileId?: string | null; hasLogin?: boolean }>>("/attendance/employees");
  },
  getGuardAttendanceConfig: async () => (await request<{ policy: AttendancePolicy; locations: AttendanceOfficeLocation[] }>("/attendance/guard-config")).data,
  guardAttendancePunch: async (data: { employeeId: string; action: "check_in" | "check_out"; photoAssetId: string; officeLocationId?: string; latitude?: number; longitude?: number; gpsAccuracyM?: number }) => (await request<any>("/attendance/guard-punch", { method: "POST", body: JSON.stringify(data) })).data,
  updateAttendancePolicy: async (data: AttendancePolicy) => {
    const res = await request<AttendancePolicy>("/attendance/policy", { method: "PATCH", body: JSON.stringify(data) });
    return res.data;
  },
  createAttendanceLocation: async (data: Omit<AttendanceOfficeLocation, "id">) => {
    const res = await request<AttendanceOfficeLocation>("/attendance/locations", { method: "POST", body: JSON.stringify(data) });
    return res.data;
  },
  updateAttendanceLocation: async (id: string, data: Omit<AttendanceOfficeLocation, "id">) => {
    const res = await request<AttendanceOfficeLocation>(`/attendance/locations/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    return res.data;
  },
  deleteAttendanceLocation: async (id: string) => {
    const res = await request<{ id: string; status: "inactive" }>(`/attendance/locations/${id}`, { method: "DELETE" });
    return res.data;
  },
  adjustAttendance: async (data: { employeeId: string; attendanceDate: string; status: "present" | "half_day" | "absent" | "leave"; checkInAt?: string; checkOutAt?: string; reason: string }) => {
    const res = await request<AttendanceRecord>("/attendance/admin/adjustments", { method: "PUT", body: JSON.stringify(data) });
    return res.data;
  },
  getAttendanceDashboard: async (date: string) => {
    const res = await request<AttendanceDashboard>(`/attendance/dashboard?date=${encodeURIComponent(date)}`);
    return res.data;
  },
  listAttendanceRecords: async (params?: Record<string, unknown>) => {
    const query = buildQueryString(params);
    return request<AttendanceRecord[]>(`/attendance/records?${query}`);
  },
  checkInAttendance: async (data: { officeLocationId?: string; latitude?: number; longitude?: number; gpsAccuracyM?: number; photoAssetId: string }) => {
    const res = await request<AttendanceRecord>("/attendance/check-in", { method: "POST", body: JSON.stringify(data) });
    return res.data;
  },
  checkOutAttendance: async (data: { latitude?: number; longitude?: number; gpsAccuracyM?: number; photoAssetId: string }) => {
    const res = await request<AttendanceRecord>("/attendance/check-out", { method: "POST", body: JSON.stringify(data) });
    return res.data;
  },
  requestAttendanceCorrection: async (data: { attendanceRecordId: string; requestedCheckInAt?: string; requestedCheckOutAt?: string; reason: string; evidenceFileAssetId?: string }) => {
    const res = await request<AttendanceCorrection>("/attendance/corrections", { method: "POST", body: JSON.stringify(data) });
    return res.data;
  },
  listAttendanceCorrections: async (mine = false, params?: Record<string, unknown>) => {
    const query = buildQueryString(params);
    return request<AttendanceCorrection[]>(`/attendance/corrections${mine ? "/mine" : ""}?${query}`);
  },
  reviewAttendanceCorrection: async (id: string, decision: "approved" | "rejected", comment: string) => {
    const res = await request<AttendanceCorrection>(`/attendance/corrections/${id}/review`, { method: "PATCH", body: JSON.stringify({ decision, comment }) });
    return res.data;
  },

  // Platform administration
  listOrganizations: async (params?: Record<string, string>) => {
    const query = buildQueryString(params);
    return request<any[]>(`/platform/organizations${query ? `?${query}` : ""}`);
  },
  createOrganization: async (data: any) => {
    const res = await request<any>("/platform/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateOrganizationStatus: async (id: string, data: { status: string; reason: string }) => {
    const res = await request<any>(`/platform/organizations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return res.data;
  },
  updateOrganizationModule: async (id: string, moduleId: OrganizationModuleKey, enabled: boolean) => {
    const res = await request<any>(`/platform/organizations/${id}/modules/${moduleId}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
    return res.data;
  },

  // Files
  uploadFile: async (file: File, purpose: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", purpose);

    const headers = new Headers();
    if (inMemoryToken) {
      headers.set("Authorization", `Bearer ${inMemoryToken}`);
    }

    const res = await trackedFetch(apiUrl("/files/upload"), {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    const body = await res.json();
    if (!res.ok || body.success === false) {
      throw new ApiError(
        body?.error?.code || "UPLOAD_FAILED",
        body?.error?.message || "File upload failed",
        res.status,
      );
    }
    return body.data;
  },
  getFileBlob: async (fileId: string): Promise<Blob> => {
    const fetchBlob = (token: string | null) => trackedFetch(apiUrl(`/files/${fileId}/download?inline=true`), {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    let response = await fetchBlob(inMemoryToken);
    if (response.status === 401) {
      const refreshed = await trackedFetch(apiUrl("/auth/refresh"), { method: "POST", credentials: "include" });
      if (refreshed.ok) {
        const payload = await refreshed.json();
        setAccessToken(payload.data.accessToken);
        response = await fetchBlob(inMemoryToken);
      }
    }
    if (!response.ok) {
      let message = "Could not load the image preview";
      try { const payload = await response.json(); message = payload?.error?.message || message; } catch { /* The server may return a non-JSON error body. */ }
      throw new ApiError("FILE_PREVIEW_FAILED", message, response.status);
    }
    return response.blob();
  },
  // Health
  fetchHealth: async () => {
    const res = await request<any>("/health");
    return res.data;
  },
};

export async function fetchHealth() {
  const res = await request<any>("/health");
  return res.data;
}
