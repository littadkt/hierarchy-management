import axios from "axios";
import {
  AttendanceRecord,
  AttendanceReportResponse,
  AttendanceTodayStatus,
  BackupItem,
  BackupStatus,
  Branch,
  Department,
  BulkDeleteInventoryResult,
  BulkDeleteProductsResult,
  BulkUploadResult,
  ChecklistItem,
  DashboardStats,
  InventoryItem,
  PurchaseRequest,
  PurchaseRequestHistory,
  PurchaseRequestStatus,
  RestoreResult,
  Role,
  Subtask,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
  TaskDetail,
  TaskPerformanceStats,
  TaskPriority,
  TaskStatus,
  User,
  UserBrief,
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderStatus,
  WholesaleProduct,
  WarrantyBrand,
  WarrantyJob,
  WarrantyJobsListResponse,
  WarrantyModel,
  WarrantySerialHistory,
  WarrantyServiceType,
  WarrantyStaff,
  WarrantyStatus,
  UserPermissions,
  WindowDefinition,
  TimeSchedule,
  BufferStatus,
  AppNotification,
  NotificationListResponse,
  ProductServiceTicket,
  RentalProduct,
  RentalBooking,
  SapSalesOrder,
  SapDashboardStats,
  SapGlAccount,
  SapJournalEntry,
  SapCostCenter,
  SapProfitCenter,
  SapMaterialMaster,
  SapPurchaseRequisition,
  SapQuotation,
  SapHcmEmployee,
  SapProductionOrder,
  SapBomItem,
  SapWarehouseBin,
  SapTransferOrder,
  SapAbapScript,
  SapAbapRunResponse,
  SapTaxRate,
  SapTaxLedger,
  SapTaxSummary,
  SapCustomer,
  SapCustomerEnquiry,
  SapInvoice,
  SapOutboundDelivery,
  SapPosSale,
  SapVendor,
  SapPurchaseOrder,
  SapGoodsReceipt,
  SapVendorBill,
  SapDebitNote,
  SapStockTransfer,
  SapStockMovement,
  SapStockTaking,
  SapDamagedItem,
  SapPriceChange,
  SapAccountingVoucher,
  SapBankReconciliation,
  SapVoucherFormat,
  SapDataMigration,
  SapTrialBalanceReport,
  SapProfitLossReport,
  SapBalanceSheetReport,
  SapReceivablesAgeingReport,
  SapSalesRegisterReport,
  CrmLead,
  CrmDeal,
  CrmCustomer,
  CrmTicket,
  CrmDashboardStats,
  CrmAiChatResponse,
  CrmAiDraftResponse,
} from "./types";

/**
 * Resolves the API Base URL dynamically.
 * In a private network deployment, client browsers running on remote laptops
 * route all requests through the origin host (via Next.js rewrite /api/v1)
 * or through the network hostname, avoiding localhost hardcoding.
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    // 1. If explicitly set to a relative path like "/api/v1", use it directly
    if (envUrl && envUrl.startsWith("/")) {
      return envUrl;
    }
    // 2. If envUrl is set to localhost/127.0.0.1, but client is on a LAN IP:
    if (envUrl && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        // Fall back to relative /api/v1 which automatically hits the hosting machine via Next.js proxy
        return "/api/v1";
      }
    }
    // 3. If envUrl is set to any other external URL, use it
    if (envUrl) {
      return envUrl;
    }
    // 4. Default to relative /api/v1
    return "/api/v1";
  }
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach token, handle FormData boundaries, & ensure LAN URL resolution
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    // Dynamically adjust baseURL if needed for private network access
    if (
      !config.baseURL ||
      config.baseURL.includes("localhost") ||
      config.baseURL.includes("127.0.0.1")
    ) {
      if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        config.baseURL = "/api/v1";
      }
    }
    // When sending FormData, remove hardcoded Content-Type so Axios & browser supply boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
    }
    const token = localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: automatically handle 401 Unauthorized / Token Expiration on private networks
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        const isAuthEndpoint = error.config?.url?.includes("/auth/login");
        if (!isAuthEndpoint) {
          localStorage.removeItem("token");
          if (!window.location.pathname.startsWith("/login")) {
            window.location.href = "/login?expired=1";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Helper for extracting clean error message
export const getErrorMessage = (error: unknown, fallback?: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
    }
    return error.response?.data?.message || error.message || fallback || "An error occurred";
  }
  return (error as Error)?.message || fallback || "An unexpected error occurred";
};

// API Services
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login/json", { email, password });
    return response.data;
  },
  getMe: async (): Promise<User> => {
    const response = await api.get("/auth/me");
    return response.data;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
  logout: async () => {
    try {
      const response = await api.post("/auth/logout");
      return response.data;
    } catch {
      // In case token already expired, proceed with client cleanup
      return { message: "Logged out" };
    }
  },
};



export const usersApi = {
  list: async (role?: Role): Promise<User[]> => {
    const params = role ? { role } : {};
    const response = await api.get("/users", { params });
    return response.data;
  },
  get: async (id: string): Promise<User> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  create: async (data: {
    email: string;
    full_name: string;
    password: string;
    role: Role;
    branch?: string | null;
    department?: string | null;
    reports_to_id?: string | null;
    schedule_id?: string | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
  }): Promise<User> => {
    const response = await api.post("/users", data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      email: string;
      full_name: string;
      password?: string;
      role?: Role;
      is_active: boolean;
      branch?: string | null;
      department?: string | null;
      reports_to_id?: string | null;
      schedule_id?: string | null;
      check_in_time?: string | null;
      check_out_time?: string | null;
      can_place_wholesale_orders?: boolean;
    }>
  ): Promise<User> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
  setLeave: async (
    id: string,
    payload: {
      is_on_leave: boolean;
      leave_date?: string | null;
      leave_reason?: string | null;
    }
  ): Promise<User> => {
    const response = await api.post(`/users/${id}/leave`, payload);
    return response.data;
  },
  getAssignable: async (): Promise<UserBrief[]> => {
    const response = await api.get("/users/assignable");
    return response.data;
  },
  getEligibleApprovers: async (forUserId: string): Promise<UserBrief[]> => {
    const response = await api.get("/users/eligible-approvers", {
      params: { for_user_id: forUserId },
    });
    return response.data;
  },
};

export const branchesApi = {
  list: async (activeOnly = false): Promise<Branch[]> => {
    const response = await api.get("/branches", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },
  create: async (data: {
    name: string;
    code?: string | null;
    city?: string | null;
    address?: string | null;
    allowed_wifi_ips?: string | null;
    wifi_ssid?: string | null;
    is_active?: boolean;
  }): Promise<Branch> => {
    const response = await api.post("/branches", data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      name: string;
      code?: string | null;
      city?: string | null;
      address?: string | null;
      allowed_wifi_ips?: string | null;
      wifi_ssid?: string | null;
      is_active: boolean;
    }>
  ): Promise<Branch> => {
    const response = await api.put(`/branches/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/branches/${id}`);
  },
};

export const departmentsApi = {
  list: async (activeOnly = false): Promise<Department[]> => {
    const response = await api.get("/departments", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },
  create: async (data: {
    name: string;
    code?: string | null;
    description?: string | null;
    is_active?: boolean;
  }): Promise<Department> => {
    const response = await api.post("/departments", data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      name: string;
      code?: string | null;
      description?: string | null;
      is_active: boolean;
    }>
  ): Promise<Department> => {
    const response = await api.put(`/departments/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/departments/${id}`);
  },
};



export const attachmentsApi = {
  upload: async (
    taskId: string,
    files: File[],
    subtaskId?: string
  ): Promise<TaskAttachment[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const url = subtaskId
      ? `/tasks/${taskId}/subtasks/${subtaskId}/attachments`
      : `/tasks/${taskId}/attachments`;
    const response = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
  list: async (
    taskId: string,
    subtaskId?: string
  ): Promise<TaskAttachment[]> => {
    const url = subtaskId
      ? `/tasks/${taskId}/subtasks/${subtaskId}/attachments`
      : `/tasks/${taskId}/attachments`;
    const response = await api.get(url);
    return response.data;
  },
  delete: async (attachmentId: string): Promise<void> => {
    await api.delete(`/tasks/attachments/${attachmentId}`);
  },
  getUrl: (attachmentId: string, download = false): string => {
    const baseURL = api.defaults.baseURL || "/api/v1";
    return `${baseURL}/tasks/attachments/${attachmentId}/download?download=${download}`;
  },
  downloadBlob: async (attachmentId: string, filename: string): Promise<void> => {
    const response = await api.get(`/tasks/attachments/${attachmentId}/download?download=true`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const tasksApi = {
  list: async (filters?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_to_id?: string;
    created_by_id?: string;
    is_recurring?: boolean;
    requires_approval?: boolean;
    search?: string;
    due_date_scope?: string;
    user_scope?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: Task[]; total: number }> => {
    const response = await api.get("/tasks", { params: filters });
    return response.data;
  },
  get: async (id: string): Promise<TaskDetail> => {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },
  create: async (data: any): Promise<Task> => {
    const response = await api.post("/tasks", data);
    return response.data;
  },
  update: async (id: string, data: any): Promise<Task> => {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },
  bulkDelete: async (taskIds: string[]): Promise<{ deleted_count: number }> => {
    const response = await api.post("/tasks/bulk-delete", { task_ids: taskIds });
    return response.data;
  },
  reorder: async (taskIds: string[]): Promise<{ message: string }> => {
    const response = await api.patch("/tasks/reorder", { task_ids: taskIds });
    return response.data;
  },
  reorderSubtasks: async (
    taskId: string,
    subtaskIds: string[]
  ): Promise<{ message: string }> => {
    const response = await api.patch(`/tasks/${taskId}/subtasks/reorder`, {
      subtask_ids: subtaskIds,
    });
    return response.data;
  },
  uploadAttachments: (
    taskId: string,
    files: File[],
    subtaskId?: string
  ): Promise<TaskAttachment[]> => attachmentsApi.upload(taskId, files, subtaskId),
  getAttachments: (
    taskId: string,
    subtaskId?: string
  ): Promise<TaskAttachment[]> => attachmentsApi.list(taskId, subtaskId),
  deleteAttachment: (attachmentId: string): Promise<void> =>
    attachmentsApi.delete(attachmentId),
  getAttachmentUrl: (attachmentId: string, download = false): string =>
    attachmentsApi.getUrl(attachmentId, download),
  downloadAttachmentBlob: (attachmentId: string, filename: string): Promise<void> =>
    attachmentsApi.downloadBlob(attachmentId, filename),
  updateStatus: async (
    id: string,
    status: TaskStatus,
    comment?: string
  ): Promise<Task> => {
    const response = await api.patch(`/tasks/${id}/status`, { status, comment });
    return response.data;
  },
  getSubordinateTodayStatus: async (): Promise<{
    can_complete_or_submit: boolean;
    subordinates_count: number;
    pending_tasks_count: number;
    pending_tasks: Array<{
      id: string;
      title: string;
      status: string;
      assigned_to_id: string;
      assigned_to_name: string;
      assigned_to_role: string;
      due_date?: string | null;
    }>;
  }> => {
    const response = await api.get("/tasks/subordinates/today-status");
    return response.data;
  },
  addComment: async (taskId: string, content: string): Promise<TaskComment> => {
    const response = await api.post(`/tasks/${taskId}/comments`, { content });
    return response.data;
  },
  getComments: async (taskId: string): Promise<TaskComment[]> => {
    const response = await api.get(`/tasks/${taskId}/comments`);
    return response.data;
  },
  getActivities: async (taskId: string): Promise<TaskActivity[]> => {
    const response = await api.get(`/tasks/${taskId}/activities`);
    return response.data;
  },
  getSubtasks: async (taskId: string): Promise<Subtask[]> => {
    const response = await api.get(`/tasks/${taskId}/subtasks`);
    return response.data;
  },
  createSubtask: async (
    taskId: string,
    data: {
      title: string;
      description?: string | null;
      due_date?: string | null;
      assigned_to_id?: string | null;
    }
  ): Promise<Subtask> => {
    const response = await api.post(`/tasks/${taskId}/subtasks`, data);
    return response.data;
  },
  updateSubtask: async (
    taskId: string,
    subtaskId: string,
    data: Partial<{
      title: string;
      description?: string | null;
      is_completed?: boolean;
      due_date?: string | null;
      assigned_to_id?: string | null;
    }>
  ): Promise<Subtask> => {
    const response = await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, data);
    return response.data;
  },
  toggleSubtask: async (
    taskId: string,
    subtaskId: string,
    is_completed: boolean
  ): Promise<Subtask> => {
    const response = await api.patch(
      `/tasks/${taskId}/subtasks/${subtaskId}/toggle`,
      { is_completed }
    );
    return response.data;
  },
  deleteSubtask: async (taskId: string, subtaskId: string): Promise<void> => {
    await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
  },
};

export const approvalsApi = {
  getPending: async (params?: {
    sort_by?: string;
    order?: string;
    date?: string;
    submitted_by_id?: string;
    approver_id?: string;
    priority?: string;
    submitted_date?: string;
  }): Promise<Task[]> => {
    const response = await api.get("/approvals/pending", { params });
    return response.data;
  },
  submit: async (taskId: string, comments?: string): Promise<Task> => {
    const response = await api.post(`/approvals/${taskId}/submit`, { comments });
    return response.data;
  },
  decide: async (
    taskId: string,
    action: "APPROVE" | "REJECT",
    comments?: string
  ): Promise<Task> => {
    const response = await api.post(`/approvals/${taskId}/decision`, {
      action,
      comments,
    });
    return response.data;
  },
};



export const hierarchyApi = {
  getOverview: async (): Promise<User[]> => {
    const response = await api.get("/hierarchy/overview");
    return response.data;
  },
  getTree: async (): Promise<any[]> => {
    const response = await api.get("/hierarchy/tree");
    return response.data;
  },
};



export const statsApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const response = await api.get("/stats/dashboard");
    return response.data;
  },
  getPerformance: async (params?: {
    user_id?: string;
    branch?: string;
    department?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<TaskPerformanceStats> => {
    const response = await api.get("/stats/performance", { params });
    return response.data;
  },
  exportPerformanceBlob: async (params?: {
    user_id?: string;
    branch?: string;
    department?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> => {
    const response = await api.get("/stats/performance/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },
};



export const inventoryApi = {
  byCode: async (code: string, branchId?: string): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/by-code/${encodeURIComponent(code)}`, {
      params: branchId ? { branch_id: branchId } : undefined,
    });
    return response.data;
  },
  list: async (filters?: {
    search?: string;
    category?: string;
    branch_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: InventoryItem[]; total: number; skip: number; limit: number }> => {
    const response = await api.get("/inventory", { params: filters });
    return response.data;
  },
  get: async (id: string): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },
  create: async (data: {
    branch_id?: string;
    code?: string;
    name?: string;
    rate?: number;
    category?: string;
    brand?: string;
    vendor?: string;
    quantity?: number;
  }): Promise<InventoryItem> => {
    const response = await api.post("/inventory", data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      branch_id?: string;
      code: string;
      name: string;
      rate: number;
      category: string;
      brand: string;
      vendor: string;
      quantity: number;
    }>
  ): Promise<InventoryItem> => {
    const response = await api.put(`/inventory/${id}`, data);
    return response.data;
  },
  updateQuantity: async (id: string, quantity: number): Promise<InventoryItem> => {
    const response = await api.patch(`/inventory/${id}/quantity`, { quantity });
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/inventory/${id}`);
  },
  bulkDelete: async (itemIds: string[]): Promise<BulkDeleteInventoryResult> => {
    const response = await api.post("/inventory/bulk-delete", {
      item_ids: itemIds,
    });
    return response.data;
  },
  downloadTemplate: async (): Promise<Blob> => {
    const response = await api.get("/inventory/template", {
      responseType: "blob",
    });
    return response.data;
  },
  uploadExcel: async (file: File, branchId?: string): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    if (branchId) {
      formData.append("branch_id", branchId);
    }
    const response = await api.post("/inventory/upload-excel", formData);
    return response.data;
  },
};



export const purchaseApi = {
  getManager: async (): Promise<UserBrief | null> => {
    const response = await api.get("/purchase-requests/manager");
    return response.data;
  },
  getMyManager: async (): Promise<UserBrief | null> => {
    const response = await api.get("/purchase-requests/my-manager");
    return response.data;
  },
  getInCharges: async (): Promise<UserBrief[]> => {
    const response = await api.get("/purchase-requests/in-charges");
    return response.data;
  },
  getManagers: async (): Promise<UserBrief[]> => {
    const response = await api.get("/purchase-requests/managers");
    return response.data;
  },
  assignManager: async (userId: string): Promise<UserBrief> => {
    const response = await api.post("/purchase-requests/assign-manager", { user_id: userId });
    return response.data;
  },
  createRequest: async (data: {
    code: string;
    name?: string;
    rate?: number;
    category?: string;
    brand?: string;
    vendor?: string;
    quantity: number;
    notes?: string | null;
  }): Promise<PurchaseRequest> => {
    const response = await api.post("/purchase-requests", data);
    return response.data;
  },
  listRequests: async (filters?: {
    status?: PurchaseRequestStatus;
    search?: string;
    sort_by?: string;
    order?: string;
    date?: string;
    pm_filter?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: PurchaseRequest[]; total: number; skip: number; limit: number }> => {
    const response = await api.get("/purchase-requests", { params: filters });
    return response.data;
  },
  getRequest: async (id: string): Promise<PurchaseRequest> => {
    const response = await api.get(`/purchase-requests/${id}`);
    return response.data;
  },
  updateRequest: async (
    id: string,
    data: Partial<{
      name: string;
      rate: number;
      category: string;
      brand: string;
      vendor: string;
      quantity: number;
      notes: string | null;
    }>
  ): Promise<PurchaseRequest> => {
    const response = await api.put(`/purchase-requests/${id}`, data);
    return response.data;
  },
  deleteRequest: async (id: string): Promise<void> => {
    await api.delete(`/purchase-requests/${id}`);
  },
  updateStatus: async (
    id: string,
    status: PurchaseRequestStatus,
    remarks?: string
  ): Promise<PurchaseRequest> => {
    const response = await api.patch(`/purchase-requests/${id}/status`, {
      status,
      remarks,
    });
    return response.data;
  },
  getHistory: async (id: string): Promise<PurchaseRequestHistory[]> => {
    const response = await api.get(`/purchase-requests/${id}/history`);
    return response.data;
  },
};



export const wholesaleApi = {
  getCustomers: async (
    filters?:
      | {
          search?: string;
          skip?: number;
          limit?: number;
        }
      | string
  ): Promise<{ items: WholesaleCustomer[]; total: number; skip: number; limit: number }> => {
    const params = typeof filters === "string" ? { search: filters } : filters;
    const response = await api.get("/wholesale/customers", { params });
    return response.data;
  },
  getCustomer: async (id: string): Promise<WholesaleCustomer> => {
    const response = await api.get(`/wholesale/customers/${id}`);
    return response.data;
  },
  createCustomer: async (data: {
    name: string;
    place: string;
    contact_number: string;
    email?: string | null;
    address?: string | null;
  }): Promise<WholesaleCustomer> => {
    const response = await api.post("/wholesale/customers", data);
    return response.data;
  },
  updateCustomer: async (
    id: string,
    data: Partial<{
      name: string;
      place: string;
      contact_number: string;
      email?: string | null;
      address?: string | null;
    }>
  ): Promise<WholesaleCustomer> => {
    const response = await api.put(`/wholesale/customers/${id}`, data);
    return response.data;
  },
  deleteCustomer: async (id: string): Promise<void> => {
    await api.delete(`/wholesale/customers/${id}`);
  },
  downloadCustomersTemplate: async (): Promise<Blob> => {
    const response = await api.get("/wholesale/customers/template", {
      responseType: "blob",
    });
    return response.data;
  },
  uploadCustomersExcel: async (file: File): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/wholesale/customers/upload-excel", formData);
    return response.data;
  },
  getProducts: async (filters?: {
    search?: string;
    category?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: WholesaleProduct[]; total: number; skip: number; limit: number }> => {
    const response = await api.get("/wholesale/products", { params: filters });
    return response.data;
  },
  getProduct: async (id: string): Promise<WholesaleProduct> => {
    const response = await api.get(`/wholesale/products/${id}`);
    return response.data;
  },
  getProductByCode: async (code: string): Promise<WholesaleProduct> => {
    const response = await api.get(`/wholesale/products/by-code/${encodeURIComponent(code)}`);
    return response.data;
  },
  createProduct: async (data: {
    code: string;
    name: string;
    rate: number;
    category: string;
    brand: string;
    vendor: string;
    quantity: number;
  }): Promise<WholesaleProduct> => {
    const response = await api.post("/wholesale/products", data);
    return response.data;
  },
  updateProduct: async (
    id: string,
    data: Partial<{
      code: string;
      name: string;
      rate: number;
      category: string;
      brand: string;
      vendor: string;
      quantity: number;
    }>
  ): Promise<WholesaleProduct> => {
    const response = await api.put(`/wholesale/products/${id}`, data);
    return response.data;
  },
  deleteProduct: async (id: string): Promise<void> => {
    await api.delete(`/wholesale/products/${id}`);
  },
  bulkDeleteProducts: async (productIds: string[]): Promise<BulkDeleteProductsResult> => {
    const response = await api.post("/wholesale/products/bulk-delete", {
      product_ids: productIds,
    });
    return response.data;
  },
  downloadProductsTemplate: async (): Promise<Blob> => {
    const response = await api.get("/wholesale/products/template", {
      responseType: "blob",
    });
    return response.data;
  },
  uploadProductsExcel: async (file: File): Promise<BulkUploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/wholesale/products/upload-excel", formData);
    return response.data;
  },
  placeOrder: async (data: {
    customer_id: string;
    product_id?: string;
    quantity?: number;
    items?: Array<{ product_id: string; quantity: number }>;
    place?: string;
    contact_number?: string;
    notes?: string;
  }): Promise<WholesaleOrder | WholesaleOrder[]> => {
    const response = await api.post("/wholesale/orders", data);
    return response.data;
  },
  listOrders: async (filters?: {
    status?: WholesaleOrderStatus;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: WholesaleOrder[]; total: number }> => {
    const response = await api.get("/wholesale/orders", { params: filters });
    return response.data;
  },
  updateOrder: async (
    orderId: string,
    data: Partial<{
      customer_id?: string;
      product_id?: string;
      quantity?: number;
      place?: string;
      contact_number?: string;
      notes?: string;
      status?: WholesaleOrderStatus;
    }>
  ): Promise<WholesaleOrder> => {
    const response = await api.put(`/wholesale/orders/${orderId}`, data);
    return response.data;
  },
  deleteOrder: async (orderId: string): Promise<void> => {
    await api.delete(`/wholesale/orders/${orderId}`);
  },
  updateOrderStatus: async (
    orderId: string,
    status: WholesaleOrderStatus
  ): Promise<WholesaleOrder> => {
    const response = await api.patch(`/wholesale/orders/${orderId}/status`, { status });
    return response.data;
  },
  listUsersForPermissions: async (): Promise<UserBrief[]> => {
    const response = await api.get("/wholesale/permissions/users");
    return response.data;
  },
  setPermission: async (
    userId: string,
    canPlace: boolean
  ): Promise<UserBrief> => {
    const response = await api.post("/wholesale/permissions", {
      user_id: userId,
      can_place_wholesale_orders: canPlace,
    });
    return response.data;
  },
};

export const checklistApi = {
  list: async (): Promise<ChecklistItem[]> => {
    const response = await api.get("/checklist");
    return response.data;
  },
  getUsers: async (): Promise<UserBrief[]> => {
    const response = await api.get("/checklist/users");
    return response.data;
  },
  create: async (data: {
    title: string;
    description?: string | null;
    due_date?: string | null;
    target_user_id?: string | null;
  }): Promise<ChecklistItem> => {
    const response = await api.post("/checklist", data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      title: string;
      description?: string | null;
      is_completed?: boolean;
      due_date?: string | null;
      target_user_id?: string | null;
    }>
  ): Promise<ChecklistItem> => {
    const response = await api.put(`/checklist/${id}`, data);
    return response.data;
  },
  toggle: async (id: string, is_completed: boolean): Promise<ChecklistItem> => {
    const response = await api.patch(`/checklist/${id}/toggle`, { is_completed });
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/checklist/${id}`);
  },
  clearCompleted: async (): Promise<{ cleared_count: number }> => {
    const response = await api.delete("/checklist/clear-completed");
    return response.data;
  },
  reorder: async (itemIds: string[]): Promise<{ message: string }> => {
    const response = await api.patch("/checklist/reorder", { item_ids: itemIds });
    return response.data;
  },
};

export const backupApi = {
  getStatus: async (): Promise<BackupStatus> => {
    const response = await api.get("/backup/status");
    return response.data;
  },
  list: async (): Promise<BackupItem[]> => {
    const response = await api.get("/backup/list");
    return response.data;
  },
  createManual: async (): Promise<any> => {
    const response = await api.post("/backup/create", {}, {
      timeout: 120000,
    });
    return response.data;
  },
  restoreUpload: async (file: File): Promise<RestoreResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/backup/restore/upload", formData, {
      timeout: 120000,
    });
    return response.data;
  },
  restoreExisting: async (filename: string): Promise<RestoreResult> => {
    const response = await api.post(`/backup/restore/existing/${encodeURIComponent(filename)}`, null, {
      timeout: 120000,
    });
    return response.data;
  },
  delete: async (filename: string): Promise<{ message: string }> => {
    const response = await api.delete(`/backup/${encodeURIComponent(filename)}`);
    return response.data;
  },
  download: async (filename: string) => {
    const response = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const attendanceApi = {
  getToday: async (): Promise<AttendanceTodayStatus> => {
    const response = await api.get("/attendance/today");
    return response.data;
  },
  checkIn: async (
    payload?:
      | {
          note?: string;
          latitude?: number | null;
          longitude?: number | null;
          accuracy?: number | null;
          wifi_ssid?: string | null;
        }
      | string
  ): Promise<AttendanceRecord> => {
    const body = typeof payload === "string" ? { note: payload } : payload || {};
    const response = await api.post("/attendance/check-in", body);
    return response.data;
  },
  getPendingApprovals: async (): Promise<AttendanceRecord[]> => {
    const response = await api.get("/attendance/pending-approvals");
    return response.data;
  },
  approveCheckIn: async (id: string): Promise<AttendanceRecord> => {
    const response = await api.post(`/attendance/${id}/approve`);
    return response.data;
  },
  rejectCheckIn: async (id: string, reason?: string): Promise<AttendanceRecord> => {
    const response = await api.post(`/attendance/${id}/reject`, { reason });
    return response.data;
  },
  checkOut: async (note?: string): Promise<AttendanceRecord> => {
    const response = await api.post("/attendance/check-out", { note });
    return response.data;
  },
  getMyHistory: async (params?: {
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }): Promise<AttendanceReportResponse> => {
    const response = await api.get("/attendance/my-history", { params });
    return response.data;
  },
  getReport: async (params?: {
    start_date?: string;
    end_date?: string;
    branch_id?: string;
    department?: string;
    user_id?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<AttendanceReportResponse> => {
    const response = await api.get("/attendance/report", { params });
    return response.data;
  },
  exportReportBlob: async (params?: {
    start_date?: string;
    end_date?: string;
    branch_id?: string;
    department?: string;
    user_id?: string;
    status?: string;
  }): Promise<Blob> => {
    const response = await api.get("/attendance/export", {
      params,
      responseType: "blob",
    });
    return response.data;
  },
  getBufferStatus: async (userId?: string): Promise<BufferStatus> => {
    const response = await api.get("/attendance/buffer-status", {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },
};

export const schedulesApi = {
  list: async (): Promise<TimeSchedule[]> => {
    const response = await api.get("/schedules");
    return response.data;
  },
  create: async (data: {
    name: string;
    check_in_time: string;
    check_out_time: string;
    buffer_minutes?: number;
    monthly_buffer_limit?: number;
    description?: string;
  }): Promise<TimeSchedule> => {
    const response = await api.post("/schedules", data);
    return response.data;
  },
  update: async (
    id: string,
    data: Partial<{
      name: string;
      check_in_time: string;
      check_out_time: string;
      buffer_minutes: number;
      monthly_buffer_limit: number;
      description: string;
      is_active: boolean;
    }>
  ): Promise<TimeSchedule> => {
    const response = await api.put(`/schedules/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/schedules/${id}`);
  },
};

export const warrantyApi = {
  // Service Types
  getServiceTypes: async (activeOnly = false): Promise<WarrantyServiceType[]> => {
    const response = await api.get("/warranty/service-types", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },
  createServiceType: async (data: {
    name: string;
    description?: string | null;
  }): Promise<WarrantyServiceType> => {
    const response = await api.post("/warranty/service-types", data);
    return response.data;
  },
  updateServiceType: async (
    id: string,
    data: { name?: string; description?: string | null; is_active?: boolean }
  ): Promise<WarrantyServiceType> => {
    const response = await api.put(`/warranty/service-types/${id}`, data);
    return response.data;
  },
  deleteServiceType: async (id: string): Promise<void> => {
    await api.delete(`/warranty/service-types/${id}`);
  },

  // Staff
  getStaff: async (activeOnly = false): Promise<WarrantyStaff[]> => {
    const response = await api.get("/warranty/staff", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },
  createStaff: async (data: {
    name: string;
    phone?: string | null;
    email?: string | null;
  }): Promise<WarrantyStaff> => {
    const response = await api.post("/warranty/staff", data);
    return response.data;
  },
  updateStaff: async (
    id: string,
    data: { name?: string; phone?: string | null; email?: string | null; is_active?: boolean }
  ): Promise<WarrantyStaff> => {
    const response = await api.put(`/warranty/staff/${id}`, data);
    return response.data;
  },
  deleteStaff: async (id: string): Promise<void> => {
    await api.delete(`/warranty/staff/${id}`);
  },

  // Brands
  getBrands: async (activeOnly = false): Promise<WarrantyBrand[]> => {
    const response = await api.get("/warranty/brands", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },
  createBrand: async (data: { name: string }): Promise<WarrantyBrand> => {
    const response = await api.post("/warranty/brands", data);
    return response.data;
  },
  updateBrand: async (
    id: string,
    data: { name?: string; is_active?: boolean }
  ): Promise<WarrantyBrand> => {
    const response = await api.put(`/warranty/brands/${id}`, data);
    return response.data;
  },
  deleteBrand: async (id: string): Promise<void> => {
    await api.delete(`/warranty/brands/${id}`);
  },

  // Models
  getModels: async (params?: {
    brand_id?: string;
    active_only?: boolean;
  }): Promise<WarrantyModel[]> => {
    const response = await api.get("/warranty/models", { params });
    return response.data;
  },
  createModel: async (data: {
    name: string;
    brand_id?: string | null;
  }): Promise<WarrantyModel> => {
    const response = await api.post("/warranty/models", data);
    return response.data;
  },
  updateModel: async (
    id: string,
    data: { name?: string; brand_id?: string | null; is_active?: boolean }
  ): Promise<WarrantyModel> => {
    const response = await api.put(`/warranty/models/${id}`, data);
    return response.data;
  },
  deleteModel: async (id: string): Promise<void> => {
    await api.delete(`/warranty/models/${id}`);
  },

  // Warranty Jobs
  listJobs: async (params?: {
    search?: string;
    status?: WarrantyStatus;
    brand_id?: string;
    staff_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<WarrantyJobsListResponse> => {
    const response = await api.get("/warranty/jobs", { params });
    return response.data;
  },
  getJob: async (id: string): Promise<WarrantyJob> => {
    const response = await api.get(`/warranty/jobs/${id}`);
    return response.data;
  },
  createJob: async (data: {
    customer_name: string;
    customer_phone?: string | null;
    customer_email?: string | null;
    customer_address?: string | null;
    service_type_id?: string | null;
    service_type_name?: string | null;
    staff_id?: string | null;
    staff_name?: string | null;
    product_name: string;
    serial_number: string;
    brand_id?: string | null;
    brand_name?: string | null;
    model_id?: string | null;
    model_name?: string | null;
    work_description: string;
    status?: WarrantyStatus;
    notes?: string | null;
  }): Promise<WarrantyJob> => {
    const response = await api.post("/warranty/jobs", data);
    return response.data;
  },
  updateJob: async (
    id: string,
    data: Partial<{
      customer_name: string;
      customer_phone?: string | null;
      customer_email?: string | null;
      customer_address?: string | null;
      service_type_id?: string | null;
      service_type_name?: string | null;
      staff_id?: string | null;
      staff_name?: string | null;
      product_name: string;
      serial_number: string;
      brand_id?: string | null;
      brand_name?: string | null;
      model_id?: string | null;
      model_name?: string | null;
      work_description: string;
      status: WarrantyStatus;
      notes?: string | null;
      completed_date?: string | null;
      delivered_date?: string | null;
    }>
  ): Promise<WarrantyJob> => {
    const response = await api.put(`/warranty/jobs/${id}`, data);
    return response.data;
  },
  updateStatus: async (
    id: string,
    status: WarrantyStatus,
    notes?: string
  ): Promise<WarrantyJob> => {
    const response = await api.patch(`/warranty/jobs/${id}/status`, { status, notes });
    return response.data;
  },
  deleteJob: async (id: string): Promise<void> => {
    await api.delete(`/warranty/jobs/${id}`);
  },

  // Serial History
  getSerialHistory: async (
    serialNumber: string,
    excludeJobId?: string
  ): Promise<WarrantySerialHistory> => {
    const response = await api.get(
      `/warranty/jobs/serial-history/${encodeURIComponent(serialNumber)}`,
      { params: excludeJobId ? { exclude_job_id: excludeJobId } : undefined }
    );
    return response.data;
  },
};

export const permissionsApi = {
  getWindows: async (): Promise<WindowDefinition[]> => {
    const response = await api.get("/permissions/windows");
    return response.data;
  },
  getUserPermissions: async (userId: string): Promise<UserPermissions> => {
    const response = await api.get(`/permissions/users/${userId}`);
    return response.data;
  },
  updateUserPermissions: async (
    userId: string,
    permissions: UserPermissions
  ): Promise<UserPermissions> => {
    const response = await api.put(`/permissions/users/${userId}`, { permissions });
    return response.data;
  },
  resetUserPermissions: async (userId: string): Promise<UserPermissions> => {
    const response = await api.post(`/permissions/users/${userId}/reset`);
    return response.data;
  },
};

export const notificationsApi = {
  list: async (params?: { limit?: number; unread_only?: boolean }): Promise<NotificationListResponse> => {
    const response = await api.get("/notifications", { params });
    return response.data;
  },
  markAsRead: async (id: string): Promise<AppNotification> => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },
  markAllAsRead: async (): Promise<{ message: string; count: number }> => {
    const response = await api.post("/notifications/mark-all-read");
    return response.data;
  },
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};

// ==========================================
// SAP ERP API SERVICES
// ==========================================
export const sapApi = {
  getDashboardStats: async (): Promise<SapDashboardStats> => {
    const response = await api.get("/sap/dashboard");
    return response.data;
  },

  // Service Tickets
  listServices: async (params?: {
    search?: string;
    status?: string;
    service_type?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: ProductServiceTicket[]; total: number }> => {
    const response = await api.get("/sap/services", { params });
    return response.data;
  },
  getService: async (id: string): Promise<ProductServiceTicket> => {
    const response = await api.get(`/sap/services/${id}`);
    return response.data;
  },
  createService: async (data: Partial<ProductServiceTicket>): Promise<ProductServiceTicket> => {
    const response = await api.post("/sap/services", data);
    return response.data;
  },
  updateService: async (id: string, data: Partial<ProductServiceTicket>): Promise<ProductServiceTicket> => {
    const response = await api.put(`/sap/services/${id}`, data);
    return response.data;
  },
  deleteService: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/sap/services/${id}`);
    return response.data;
  },

  // Rental Products
  listRentalProducts: async (params?: {
    category?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: RentalProduct[]; total: number }> => {
    const response = await api.get("/sap/rentals/products", { params });
    return response.data;
  },
  getRentalProduct: async (id: string): Promise<RentalProduct> => {
    const response = await api.get(`/sap/rentals/products/${id}`);
    return response.data;
  },
  createRentalProduct: async (data: Partial<RentalProduct>): Promise<RentalProduct> => {
    const response = await api.post("/sap/rentals/products", data);
    return response.data;
  },
  updateRentalProduct: async (id: string, data: Partial<RentalProduct>): Promise<RentalProduct> => {
    const response = await api.put(`/sap/rentals/products/${id}`, data);
    return response.data;
  },
  deleteRentalProduct: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/sap/rentals/products/${id}`);
    return response.data;
  },

  // Rental Bookings
  listRentalBookings: async (params?: {
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: RentalBooking[]; total: number }> => {
    const response = await api.get("/sap/rentals/bookings", { params });
    return response.data;
  },
  createRentalBooking: async (data: Partial<RentalBooking>): Promise<RentalBooking> => {
    const response = await api.post("/sap/rentals/bookings", data);
    return response.data;
  },
  updateRentalBooking: async (id: string, data: Partial<RentalBooking>): Promise<RentalBooking> => {
    const response = await api.put(`/sap/rentals/bookings/${id}`, data);
    return response.data;
  },

  // Sales Orders
  listSalesOrders: async (params?: {
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: SapSalesOrder[]; total: number }> => {
    const response = await api.get("/sap/sales", { params });
    return response.data;
  },
  createSalesOrder: async (data: Partial<SapSalesOrder>): Promise<SapSalesOrder> => {
    const response = await api.post("/sap/sales", data);
    return response.data;
  },
  updateSalesOrder: async (id: string, data: Partial<SapSalesOrder>): Promise<SapSalesOrder> => {
    const response = await api.put(`/sap/sales/${id}`, data);
    return response.data;
  },

  // 1. SAP FI - Financial Accounting
  listGlAccounts: async (params?: { account_type?: string; search?: string }): Promise<SapGlAccount[]> => {
    const response = await api.get("/sap/fi/gl-accounts", { params });
    return response.data;
  },
  createGlAccount: async (data: Partial<SapGlAccount>): Promise<SapGlAccount> => {
    const response = await api.post("/sap/fi/gl-accounts", data);
    return response.data;
  },
  listJournalEntries: async (params?: { search?: string; limit?: number }): Promise<SapJournalEntry[]> => {
    const response = await api.get("/sap/fi/journal-entries", { params });
    return response.data;
  },
  createJournalEntry: async (data: Partial<SapJournalEntry>): Promise<SapJournalEntry> => {
    const response = await api.post("/sap/fi/journal-entries", data);
    return response.data;
  },

  // 2. SAP CO - Cost & Profit Management
  listCostCenters: async (params?: { search?: string }): Promise<SapCostCenter[]> => {
    const response = await api.get("/sap/co/cost-centers", { params });
    return response.data;
  },
  createCostCenter: async (data: Partial<SapCostCenter>): Promise<SapCostCenter> => {
    const response = await api.post("/sap/co/cost-centers", data);
    return response.data;
  },
  listProfitCenters: async (params?: { search?: string }): Promise<SapProfitCenter[]> => {
    const response = await api.get("/sap/co/profit-centers", { params });
    return response.data;
  },
  createProfitCenter: async (data: Partial<SapProfitCenter>): Promise<SapProfitCenter> => {
    const response = await api.post("/sap/co/profit-centers", data);
    return response.data;
  },

  // 3. SAP MM - Material Management
  listMaterials: async (params?: { material_type?: string; search?: string }): Promise<SapMaterialMaster[]> => {
    const response = await api.get("/sap/mm/materials", { params });
    return response.data;
  },
  createMaterial: async (data: Partial<SapMaterialMaster>): Promise<SapMaterialMaster> => {
    const response = await api.post("/sap/mm/materials", data);
    return response.data;
  },
  listPurchaseRequisitions: async (params?: { status?: string; search?: string }): Promise<SapPurchaseRequisition[]> => {
    const response = await api.get("/sap/mm/purchase-requisitions", { params });
    return response.data;
  },
  listPurchaseReqs: async (params?: { status?: string; search?: string }): Promise<SapPurchaseRequisition[]> => {
    const response = await api.get("/sap/mm/purchase-requisitions", { params });
    return response.data;
  },
  createPurchaseRequisition: async (data: Partial<SapPurchaseRequisition>): Promise<SapPurchaseRequisition> => {
    const response = await api.post("/sap/mm/purchase-requisitions", data);
    return response.data;
  },
  createPurchaseReq: async (data: Partial<SapPurchaseRequisition>): Promise<SapPurchaseRequisition> => {
    const response = await api.post("/sap/mm/purchase-requisitions", data);
    return response.data;
  },
  updatePurchaseReqStatus: async (id: string, status: string): Promise<SapPurchaseRequisition> => {
    const response = await api.put(`/sap/mm/purchase-requisitions/${id}`, { status });
    return response.data;
  },

  // 4. SAP SD - Sales & Distribution (Quotations)
  listQuotations: async (params?: { status?: string; search?: string }): Promise<SapQuotation[]> => {
    const response = await api.get("/sap/sd/quotations", { params });
    return response.data;
  },
  createQuotation: async (data: Partial<SapQuotation>): Promise<SapQuotation> => {
    const response = await api.post("/sap/sd/quotations", data);
    return response.data;
  },
  updateQuotationStatus: async (id: string, status: string): Promise<SapQuotation> => {
    const response = await api.put(`/sap/sd/quotations/${id}`, { status });
    return response.data;
  },

  // 5. SAP HCM - Human Resource Management
  listHcmEmployees: async (params?: { department?: string; search?: string }): Promise<SapHcmEmployee[]> => {
    const response = await api.get("/sap/hcm/employees", { params });
    return response.data;
  },
  createHcmEmployee: async (data: Partial<SapHcmEmployee>): Promise<SapHcmEmployee> => {
    const response = await api.post("/sap/hcm/employees", data);
    return response.data;
  },

  // 6. SAP PP - Production Planning
  listProductionOrders: async (params?: { status?: string; search?: string }): Promise<SapProductionOrder[]> => {
    const response = await api.get("/sap/pp/production-orders", { params });
    return response.data;
  },
  createProductionOrder: async (data: Partial<SapProductionOrder>): Promise<SapProductionOrder> => {
    const response = await api.post("/sap/pp/production-orders", data);
    return response.data;
  },
  updateProductionOrderStatus: async (id: string, status: string): Promise<SapProductionOrder> => {
    const response = await api.put(`/sap/pp/production-orders/${id}`, { status });
    return response.data;
  },
  listBomItems: async (params?: { bom_code?: string; search?: string }): Promise<SapBomItem[]> => {
    const response = await api.get("/sap/pp/bom-items", { params });
    return response.data;
  },
  createBomItem: async (data: Partial<SapBomItem>): Promise<SapBomItem> => {
    const response = await api.post("/sap/pp/bom-items", data);
    return response.data;
  },

  // 7. SAP WM - Warehouse Management
  listWarehouseBins: async (params?: { zone?: string; warehouse_zone?: string; status?: string; search?: string }): Promise<SapWarehouseBin[]> => {
    const queryParams: Record<string, any> = { ...params };
    if (params?.warehouse_zone && !params.zone) {
      queryParams.zone = params.warehouse_zone;
    }
    const response = await api.get("/sap/wm/warehouse-bins", { params: queryParams });
    return response.data;
  },
  createWarehouseBin: async (data: Partial<SapWarehouseBin>): Promise<SapWarehouseBin> => {
    const response = await api.post("/sap/wm/warehouse-bins", data);
    return response.data;
  },
  listTransferOrders: async (params?: { status?: string; search?: string }): Promise<SapTransferOrder[]> => {
    const response = await api.get("/sap/wm/transfer-orders", { params });
    return response.data;
  },
  createTransferOrder: async (data: Partial<SapTransferOrder>): Promise<SapTransferOrder> => {
    const response = await api.post("/sap/wm/transfer-orders", data);
    return response.data;
  },
  updateTransferOrderStatus: async (id: string, status: string): Promise<SapTransferOrder> => {
    const response = await api.put(`/sap/wm/transfer-orders/${id}`, { status });
    return response.data;
  },

  // 8. SAP ABAP - Programming Workbench
  listAbapScripts: async (params?: { module?: string; search?: string }): Promise<SapAbapScript[]> => {
    const response = await api.get("/sap/abap/scripts", { params });
    return response.data;
  },
  createAbapScript: async (data: Partial<SapAbapScript>): Promise<SapAbapScript> => {
    const response = await api.post("/sap/abap/scripts", data);
    return response.data;
  },
  runAbapScript: async (scriptId: string, parameters?: Record<string, any>): Promise<SapAbapRunResponse> => {
    const response = await api.post(`/sap/abap/scripts/${scriptId}/run`, { parameters: parameters || {} });
    return response.data;
  },

  // 9. TAX OPTION - Tax Slabs & Tax Ledgers
  listTaxRates: async (params?: { search?: string }): Promise<SapTaxRate[]> => {
    const response = await api.get("/sap/tax/rates", { params });
    return response.data;
  },
  createTaxRate: async (data: Partial<SapTaxRate>): Promise<SapTaxRate> => {
    const response = await api.post("/sap/tax/rates", data);
    return response.data;
  },
  listTaxLedgers: async (params?: { entry_type?: string; source_module?: string; search?: string; limit?: number }): Promise<SapTaxLedger[]> => {
    const response = await api.get("/sap/tax/ledgers", { params });
    return response.data;
  },
  createTaxLedger: async (data: Partial<SapTaxLedger>): Promise<SapTaxLedger> => {
    const response = await api.post("/sap/tax/ledgers", data);
    return response.data;
  },
  getTaxSummary: async (): Promise<SapTaxSummary> => {
    const response = await api.get("/sap/tax/summary");
    return response.data;
  },

  // 10. SALES MODULE (CUSTOMERS, ENQUIRIES, INVOICES, DELIVERIES, POS)
  listCustomers: async (params?: { search?: string; customer_group?: string; is_active?: boolean; skip?: number; limit?: number }): Promise<{ items: SapCustomer[]; total: number }> => {
    const response = await api.get("/sap/customers", { params });
    return response.data;
  },
  getCustomer: async (id: string): Promise<SapCustomer> => {
    const response = await api.get(`/sap/customers/${id}`);
    return response.data;
  },
  createCustomer: async (data: Partial<SapCustomer>): Promise<SapCustomer> => {
    const response = await api.post("/sap/customers", data);
    return response.data;
  },
  updateCustomer: async (id: string, data: Partial<SapCustomer>): Promise<SapCustomer> => {
    const response = await api.patch(`/sap/customers/${id}`, data);
    return response.data;
  },

  listEnquiries: async (params?: { search?: string; enquiry_status?: string; skip?: number; limit?: number }): Promise<{ items: SapCustomerEnquiry[]; total: number }> => {
    const response = await api.get("/sap/enquiries", { params });
    return response.data;
  },
  createEnquiry: async (data: Partial<SapCustomerEnquiry>): Promise<SapCustomerEnquiry> => {
    const response = await api.post("/sap/enquiries", data);
    return response.data;
  },
  updateEnquiry: async (id: string, data: Partial<SapCustomerEnquiry>): Promise<SapCustomerEnquiry> => {
    const response = await api.patch(`/sap/enquiries/${id}`, data);
    return response.data;
  },

  listInvoices: async (params?: { search?: string; invoice_type?: string; invoice_status?: string; skip?: number; limit?: number }): Promise<{ items: SapInvoice[]; total: number }> => {
    const response = await api.get("/sap/invoices", { params });
    return response.data;
  },
  getInvoice: async (id: string): Promise<SapInvoice> => {
    const response = await api.get(`/sap/invoices/${id}`);
    return response.data;
  },
  createInvoice: async (data: Partial<SapInvoice>): Promise<SapInvoice> => {
    const response = await api.post("/sap/invoices", data);
    return response.data;
  },
  updateInvoice: async (id: string, data: Partial<SapInvoice>): Promise<SapInvoice> => {
    const response = await api.patch(`/sap/invoices/${id}`, data);
    return response.data;
  },
  recordInvoicePayment: async (id: string, data: { amount_paid: number; payment_method?: string; notes?: string }): Promise<SapInvoice> => {
    const response = await api.post(`/sap/invoices/${id}/payments`, data);
    return response.data;
  },

  listDeliveries: async (params?: { search?: string; delivery_status?: string; skip?: number; limit?: number }): Promise<{ items: SapOutboundDelivery[]; total: number }> => {
    const response = await api.get("/sap/deliveries", { params });
    return response.data;
  },
  createDelivery: async (data: Partial<SapOutboundDelivery>): Promise<SapOutboundDelivery> => {
    const response = await api.post("/sap/deliveries", data);
    return response.data;
  },
  updateDelivery: async (id: string, data: Partial<SapOutboundDelivery>): Promise<SapOutboundDelivery> => {
    const response = await api.patch(`/sap/deliveries/${id}`, data);
    return response.data;
  },

  listPosSales: async (params?: { search?: string; payment_mode?: string; skip?: number; limit?: number }): Promise<{ items: SapPosSale[]; total: number }> => {
    const response = await api.get("/sap/pos-sales", { params });
    return response.data;
  },
  createPosSale: async (data: Partial<SapPosSale>): Promise<SapPosSale> => {
    const response = await api.post("/sap/pos-sales", data);
    return response.data;
  },

  // 11. PURCHASE MODULE (VENDORS, PO, GRN, AP BILLS, DEBIT NOTES)
  listVendors: async (params?: { search?: string; category?: string; is_active?: boolean; skip?: number; limit?: number }): Promise<{ items: SapVendor[]; total: number }> => {
    const response = await api.get("/sap/vendors", { params });
    return response.data;
  },
  getVendor: async (id: string): Promise<SapVendor> => {
    const response = await api.get(`/sap/vendors/${id}`);
    return response.data;
  },
  createVendor: async (data: Partial<SapVendor>): Promise<SapVendor> => {
    const response = await api.post("/sap/vendors", data);
    return response.data;
  },
  updateVendor: async (id: string, data: Partial<SapVendor>): Promise<SapVendor> => {
    const response = await api.patch(`/sap/vendors/${id}`, data);
    return response.data;
  },

  listPurchaseOrders: async (params?: { search?: string; po_status?: string; skip?: number; limit?: number }): Promise<{ items: SapPurchaseOrder[]; total: number }> => {
    const response = await api.get("/sap/purchase-orders", { params });
    return response.data;
  },
  getPurchaseOrder: async (id: string): Promise<SapPurchaseOrder> => {
    const response = await api.get(`/sap/purchase-orders/${id}`);
    return response.data;
  },
  createPurchaseOrder: async (data: Partial<SapPurchaseOrder>): Promise<SapPurchaseOrder> => {
    const response = await api.post("/sap/purchase-orders", data);
    return response.data;
  },
  updatePurchaseOrder: async (id: string, data: Partial<SapPurchaseOrder>): Promise<SapPurchaseOrder> => {
    const response = await api.patch(`/sap/purchase-orders/${id}`, data);
    return response.data;
  },

  listGoodsReceipts: async (params?: { search?: string; po_reference?: string; skip?: number; limit?: number }): Promise<{ items: SapGoodsReceipt[]; total: number }> => {
    const response = await api.get("/sap/goods-receipts", { params });
    return response.data;
  },
  createGoodsReceipt: async (data: Partial<SapGoodsReceipt>): Promise<SapGoodsReceipt> => {
    const response = await api.post("/sap/goods-receipts", data);
    return response.data;
  },

  listVendorBills: async (params?: { search?: string; bill_status?: string; skip?: number; limit?: number }): Promise<{ items: SapVendorBill[]; total: number }> => {
    const response = await api.get("/sap/vendor-bills", { params });
    return response.data;
  },
  createVendorBill: async (data: Partial<SapVendorBill>): Promise<SapVendorBill> => {
    const response = await api.post("/sap/vendor-bills", data);
    return response.data;
  },
  updateVendorBill: async (id: string, data: Partial<SapVendorBill>): Promise<SapVendorBill> => {
    const response = await api.patch(`/sap/vendor-bills/${id}`, data);
    return response.data;
  },

  listDebitNotes: async (params?: { search?: string; skip?: number; limit?: number }): Promise<{ items: SapDebitNote[]; total: number }> => {
    const response = await api.get("/sap/debit-notes", { params });
    return response.data;
  },
  createDebitNote: async (data: Partial<SapDebitNote>): Promise<SapDebitNote> => {
    const response = await api.post("/sap/debit-notes", data);
    return response.data;
  },

  // 12. INVENTORY MODULE (TRANSFERS, MOVEMENTS, STOCK TAKING, DAMAGED, PRICE)
  listStockTransfers: async (params?: { search?: string; status?: string; skip?: number; limit?: number }): Promise<{ items: SapStockTransfer[]; total: number }> => {
    const response = await api.get("/sap/stock-transfers", { params });
    return response.data;
  },
  createStockTransfer: async (data: Partial<SapStockTransfer>): Promise<SapStockTransfer> => {
    const response = await api.post("/sap/stock-transfers", data);
    return response.data;
  },

  listStockMovements: async (params?: { search?: string; movement_type?: string; skip?: number; limit?: number }): Promise<{ items: SapStockMovement[]; total: number }> => {
    const response = await api.get("/sap/stock-movements", { params });
    return response.data;
  },
  createStockMovement: async (data: Partial<SapStockMovement>): Promise<SapStockMovement> => {
    const response = await api.post("/sap/stock-movements", data);
    return response.data;
  },

  listStockTakings: async (params?: { search?: string; status?: string; skip?: number; limit?: number }): Promise<{ items: SapStockTaking[]; total: number }> => {
    const response = await api.get("/sap/stock-takings", { params });
    return response.data;
  },
  createStockTaking: async (data: Partial<SapStockTaking>): Promise<SapStockTaking> => {
    const response = await api.post("/sap/stock-takings", data);
    return response.data;
  },

  listDamagedItems: async (params?: { search?: string; skip?: number; limit?: number }): Promise<{ items: SapDamagedItem[]; total: number }> => {
    const response = await api.get("/sap/damaged-items", { params });
    return response.data;
  },
  createDamagedItem: async (data: Partial<SapDamagedItem>): Promise<SapDamagedItem> => {
    const response = await api.post("/sap/damaged-items", data);
    return response.data;
  },

  listPriceChanges: async (params?: { search?: string; skip?: number; limit?: number }): Promise<{ items: SapPriceChange[]; total: number }> => {
    const response = await api.get("/sap/price-changes", { params });
    return response.data;
  },
  createPriceChange: async (data: Partial<SapPriceChange>): Promise<SapPriceChange> => {
    const response = await api.post("/sap/price-changes", data);
    return response.data;
  },

  // 13. FINANCE MODULE (VOUCHERS, BRS, STATEMENTS)
  listAccountingVouchers: async (params?: { voucher_type?: string; search?: string; skip?: number; limit?: number }): Promise<{ items: SapAccountingVoucher[]; total: number }> => {
    const response = await api.get("/sap/accounting-vouchers", { params });
    return response.data;
  },
  createAccountingVoucher: async (data: Partial<SapAccountingVoucher>): Promise<SapAccountingVoucher> => {
    const response = await api.post("/sap/accounting-vouchers", data);
    return response.data;
  },

  listBankReconciliations: async (params?: { bank_account?: string; search?: string; skip?: number; limit?: number }): Promise<{ items: SapBankReconciliation[]; total: number }> => {
    const response = await api.get("/sap/bank-reconciliations", { params });
    return response.data;
  },
  createBankReconciliation: async (data: Partial<SapBankReconciliation>): Promise<SapBankReconciliation> => {
    const response = await api.post("/sap/bank-reconciliations", data);
    return response.data;
  },

  // 14. FINANCIAL REPORTS
  getTrialBalanceReport: async (): Promise<SapTrialBalanceReport> => {
    const response = await api.get("/sap/reports/trial-balance");
    return response.data;
  },
  getProfitLossReport: async (): Promise<SapProfitLossReport> => {
    const response = await api.get("/sap/reports/profit-loss");
    return response.data;
  },
  getBalanceSheetReport: async (): Promise<SapBalanceSheetReport> => {
    const response = await api.get("/sap/reports/balance-sheet");
    return response.data;
  },
  getReceivablesAgeingReport: async (): Promise<SapReceivablesAgeingReport> => {
    const response = await api.get("/sap/reports/receivables-ageing");
    return response.data;
  },
  getSalesRegisterReport: async (): Promise<SapSalesRegisterReport> => {
    const response = await api.get("/sap/reports/sales-register");
    return response.data;
  },

  // 15. ADMINISTRATION, FORMATS & DATA MIGRATION
  listVoucherFormats: async (): Promise<SapVoucherFormat[]> => {
    const response = await api.get("/sap/voucher-formats");
    return response.data;
  },
  createVoucherFormat: async (data: Partial<SapVoucherFormat>): Promise<SapVoucherFormat> => {
    const response = await api.post("/sap/voucher-formats", data);
    return response.data;
  },
  listDataMigrations: async (): Promise<SapDataMigration[]> => {
    const response = await api.get("/sap/data-migrations");
    return response.data;
  },
  createDataMigration: async (data: Partial<SapDataMigration>): Promise<SapDataMigration> => {
    const response = await api.post("/sap/data-migrations", data);
    return response.data;
  },
};

// ==========================================
// CRM SUITE & AI API SERVICES
// ==========================================
export const crmApi = {
  getDashboardStats: async (): Promise<CrmDashboardStats> => {
    const response = await api.get("/crm/dashboard");
    return response.data;
  },

  // Leads
  listLeads: async (params?: {
    search?: string;
    status?: string;
    source?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: CrmLead[]; total: number }> => {
    const response = await api.get("/crm/leads", { params });
    return response.data;
  },
  getLead: async (id: string): Promise<CrmLead> => {
    const response = await api.get(`/crm/leads/${id}`);
    return response.data;
  },
  createLead: async (data: Partial<CrmLead>): Promise<CrmLead> => {
    const response = await api.post("/crm/leads", data);
    return response.data;
  },
  updateLead: async (id: string, data: Partial<CrmLead>): Promise<CrmLead> => {
    const response = await api.put(`/crm/leads/${id}`, data);
    return response.data;
  },
  deleteLead: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/crm/leads/${id}`);
    return response.data;
  },

  // Deals
  listDeals: async (params?: {
    stage?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: CrmDeal[]; total: number }> => {
    const response = await api.get("/crm/deals", { params });
    return response.data;
  },
  getDeal: async (id: string): Promise<CrmDeal> => {
    const response = await api.get(`/crm/deals/${id}`);
    return response.data;
  },
  createDeal: async (data: Partial<CrmDeal>): Promise<CrmDeal> => {
    const response = await api.post("/crm/deals", data);
    return response.data;
  },
  updateDeal: async (id: string, data: Partial<CrmDeal>): Promise<CrmDeal> => {
    const response = await api.put(`/crm/deals/${id}`, data);
    return response.data;
  },
  deleteDeal: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/crm/deals/${id}`);
    return response.data;
  },

  // Customers 360
  listCustomers: async (params?: {
    search?: string;
    tier?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: CrmCustomer[]; total: number }> => {
    const response = await api.get("/crm/customers", { params });
    return response.data;
  },
  getCustomer: async (id: string): Promise<CrmCustomer> => {
    const response = await api.get(`/crm/customers/${id}`);
    return response.data;
  },
  createCustomer: async (data: Partial<CrmCustomer>): Promise<CrmCustomer> => {
    const response = await api.post("/crm/customers", data);
    return response.data;
  },
  updateCustomer: async (id: string, data: Partial<CrmCustomer>): Promise<CrmCustomer> => {
    const response = await api.put(`/crm/customers/${id}`, data);
    return response.data;
  },
  deleteCustomer: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/crm/customers/${id}`);
    return response.data;
  },

  // Tickets
  listTickets: async (params?: {
    search?: string;
    status?: string;
    priority?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ items: CrmTicket[]; total: number }> => {
    const response = await api.get("/crm/tickets", { params });
    return response.data;
  },
  getTicket: async (id: string): Promise<CrmTicket> => {
    const response = await api.get(`/crm/tickets/${id}`);
    return response.data;
  },
  createTicket: async (data: Partial<CrmTicket>): Promise<CrmTicket> => {
    const response = await api.post("/crm/tickets", data);
    return response.data;
  },
  updateTicket: async (id: string, data: Partial<CrmTicket>): Promise<CrmTicket> => {
    const response = await api.put(`/crm/tickets/${id}`, data);
    return response.data;
  },
  deleteTicket: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/crm/tickets/${id}`);
    return response.data;
  },

  // AI Agent Endpoints
  analyzeLead: async (leadId: string): Promise<any> => {
    const response = await api.post(`/crm/ai/analyze-lead/${leadId}`);
    return response.data;
  },
  analyzeDeal: async (dealId: string): Promise<any> => {
    const response = await api.post(`/crm/ai/analyze-deal/${dealId}`);
    return response.data;
  },
  draftContent: async (data: {
    context_type: string;
    recipient_name: string;
    topic_or_subject: string;
    additional_context?: string;
    tone?: string;
  }): Promise<CrmAiDraftResponse> => {
    const response = await api.post("/crm/ai/draft", data);
    return response.data;
  },
  chatCopilot: async (query: string, history?: any[]): Promise<CrmAiChatResponse> => {
    const response = await api.post("/crm/ai/chat", { query, history });
    return response.data;
  },
};






