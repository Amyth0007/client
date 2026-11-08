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

let inMemoryToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryToken = token;
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

async function request<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<{ data: T; meta?: { page: number; limit: number; total: number } }> {
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (inMemoryToken) {
    headers.set("Authorization", `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
    credentials: "include", // send cookies for refresh token
  });

  // Handle 401 and try refresh once
  if (res.status === 401 && !isRetry && !path.startsWith("/auth/login") && !path.startsWith("/auth/refresh")) {
    try {
      const refreshRes = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setAccessToken(refreshData.data.accessToken);
        return request<T>(path, options, true);
      }
    } catch {
      setAccessToken(null);
    }
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
}

export const api = {
  // Auth
  login: async (credentials: { email: string; password: string }) => {
    const res = await request<{ accessToken: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setAccessToken(res.data.accessToken);
    return res.data;
  },
  refresh: async () => {
    const res = await request<{ accessToken: string; user: any }>("/auth/refresh", {
      method: "POST",
    });
    setAccessToken(res.data.accessToken);
    return res.data;
  },
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
    }
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

  // Files
  uploadFile: async (file: File, purpose: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", purpose);

    const headers = new Headers();
    if (inMemoryToken) {
      headers.set("Authorization", `Bearer ${inMemoryToken}`);
    }

    const res = await fetch("/api/v1/files/upload", {
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
    const fetchBlob = (token: string | null) => fetch(`/api/v1/files/${fileId}/download?inline=true`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    let response = await fetchBlob(inMemoryToken);
    if (response.status === 401) {
      const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
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
