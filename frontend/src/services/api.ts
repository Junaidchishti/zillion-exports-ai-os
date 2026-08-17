const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('zx_auth_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('zx_auth_token', token);
  } else {
    localStorage.removeItem('zx_auth_token');
  }
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `API Error: ${response.status} ${response.statusText}`);
  }

  return data as T;
}

export const api = {
  // Auth
  initiateLogin: (username: string, passwordPlain: string, selectedLanguage: 'en' | 'ur') =>
    request<{
      requireOtp: boolean;
      challengeToken: string;
      maskedEmail: string;
      expirySeconds: number;
      userSummary: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password: passwordPlain, selectedLanguage }),
    }),
  verifyOtp: (challengeToken: string, otp: string) =>
    request<{ user: any; token: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, otp }),
    }),
  resendOtp: (challengeToken: string) =>
    request<{
      requireOtp: boolean;
      challengeToken: string;
      maskedEmail: string;
      expirySeconds: number;
      userSummary?: any;
    }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ challengeToken }),
    }),
  loginDirect: (username: string, passwordPlain: string, selectedLanguage: 'en' | 'ur') =>
    request<{ user: any; token: string }>('/auth/direct-login', {
      method: 'POST',
      body: JSON.stringify({ username, password: passwordPlain, selectedLanguage }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: any }>('/auth/me'),

  // Agent Interactivity
  chatWithAgent: (department: string, message: string, sessionState?: any) =>
    request('/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ department, message, sessionState }),
    }),
  confirmAgentAction: (department: string, payload: any) =>
    request('/agent/confirm', {
      method: 'POST',
      body: JSON.stringify({ department, payload }),
    }),

  // Order Intake & BOM Approval Pipeline
  parseEmailOrder: (emailSubject: string, emailBody: string) =>
    request('/orders/email-intake', {
      method: 'POST',
      body: JSON.stringify({ emailSubject, emailBody }),
    }),
  submitOrderDraft: (extractedOrder: any) =>
    request('/orders/submit-draft', {
      method: 'POST',
      body: JSON.stringify({ extractedOrder }),
    }),
  approveOrderMerchandiser: (orderId: number) =>
    request(`/orders/${orderId}/merch-approve`, { method: 'POST' }),
  approveOrderCEO: (orderId: number) =>
    request(`/orders/${orderId}/ceo-approve`, { method: 'POST' }),

  // Store & Inventory
  getAccessories: () => request('/store/accessories'),
  getStoreTransactions: () => request('/store/transactions'),
  recordStoreMovement: (payload: any) =>
    request('/store/movement', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  checkInFabricRoll: (payload: any) =>
    request('/store/check-in-roll', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Cutting Module
  getCuttingEntries: () => request('/cutting/entries'),
  getFabricRolls: () => request('/cutting/rolls'),
  getCuttingAnalytics: () => request('/cutting/analytics'),
  updateCuttingEntry: (id: number, payload: { totalPiecesCut?: number; wasteMeters?: number; notes?: string; reason: string }) =>
    request(`/cutting/entry/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Production & Orders
  getProductionOverview: () => request('/production/overview'),
  getOrders: () => request('/production/orders'),
  getBottlenecks: () => request('/production/bottlenecks'),
  getStyles: () => request('/production/styles'),

  // Approvals & Requests
  getMyRequests: () => request('/approvals/my-requests'),
  getPendingApprovals: () => request('/approvals/pending'),
  reviewApproval: (requestId: number, decision: 'APPROVED' | 'REJECTED', comments?: string) =>
    request('/approvals/review', {
      method: 'POST',
      body: JSON.stringify({ requestId, decision, comments }),
    }),
  createAllocationRequest: (payload: any) =>
    request('/approvals/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // QR Code
  resolveQR: (token: string) => request(`/qr/resolve/${token}`),
  getPOQRs: (poNumber: string) => request(`/qr/po/${poNumber}`),

  // Finance & Master Rates
  getFinanceSummary: () => request('/finance/summary'),
  getSupplierInvoices: () => request('/finance/supplier-invoices'),
  getCustomerReceivables: () => request('/finance/customer-receivables'),
  getProductionMasters: () => request('/finance/production-masters'),
  getMasterRates: () => request('/finance/rates'),
  saveMasterRate: (payload: any) =>
    request('/finance/rates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  disburseMasterPayment: (payload: any) =>
    request('/finance/disburse-payment', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Audit Logs
  getAuditLogs: (limit: number = 50, entity?: string, po?: string) => {
    let url = `/audit/logs?limit=${limit}`;
    if (entity) url += `&entity=${entity}`;
    if (po) url += `&po=${po}`;
    return request(url);
  },

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id: number) => request(`/notifications/${id}/read`, { method: 'POST' }),
};
