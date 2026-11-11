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
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ");
    }
    return error.response?.data?.message || error.message || "An error occurred";
  }
  return (error as Error)?.message || "An unexpected error occurred";
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
  getPending: async (params?: { sort_by?: string; order?: string; date?: string }): Promise<Task[]> => {
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
  }): Promise<TaskPerformanceStats> => {
    const response = await api.get("/stats/performance", { params });
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
  checkIn: async (note?: string): Promise<AttendanceRecord> => {
    const response = await api.post("/attendance/check-in", { note });
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





