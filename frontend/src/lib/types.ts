export type Role = "SUPER_ADMIN" | "ADMIN" | "IN_CHARGE" | "TEAM_LEADER" | "STAFF";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "PENDING_APPROVAL" | "COMPLETED" | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type RecurrencePattern = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export type ActivityAction =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "ASSIGNED"
  | "APPROVAL_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "RECURRENCE_GENERATED";

export interface WindowPermission {
  add: boolean;
  display: boolean;
  edit: boolean;
  delete: boolean;
}

export type UserPermissions = Record<string, WindowPermission>;

export interface WindowDefinition {
  id: string;
  name: string;
  parent_id?: string;
  level: number;
  is_group?: boolean;
  sidebar_href?: string;
}

export interface UserBrief {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  branch?: string | null;
  department?: string | null;
  reports_to_id?: string | null;
  is_purchase_manager?: boolean;
  can_place_wholesale_orders?: boolean;
  last_login_at?: string | null;
  today_first_login_at?: string | null;
  permissions?: UserPermissions;
}

export interface UserTaskStats {
  total_assigned: number;
  pending: number;
  in_progress: number;
  pending_approval: number;
  completed: number;
  cancelled: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  branch?: string | null;
  department?: string | null;
  is_purchase_manager?: boolean;
  can_place_wholesale_orders?: boolean;
  reports_to_id?: string | null;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  today_first_login_at?: string | null;
  is_on_leave?: boolean;
  leave_date?: string | null;
  leave_reason?: string | null;
  permissions?: UserPermissions;
  task_stats?: UserTaskStats;
  manager_name?: string | null;
  creator_name?: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PurchaseRequestStatus = "OPEN" | "ORDERED" | "NOT_IN_STOCK" | "RECEIVED";

export interface InventoryItem {
  id: string;
  branch_id?: string | null;
  branch_name?: string | null;
  code: string;
  name: string;
  rate: number;
  category: string;
  brand: string;
  vendor: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestHistory {
  id: string;
  purchase_request_id: string;
  changed_by_id?: string | null;
  old_status?: PurchaseRequestStatus | null;
  new_status: PurchaseRequestStatus;
  remarks?: string | null;
  created_at: string;
  changed_by?: UserBrief | null;
}

export interface PurchaseRequest {
  id: string;
  code: string;
  name: string;
  rate: number;
  category?: string | null;
  brand?: string | null;
  vendor: string;
  quantity: number;
  notes?: string | null;
  inventory_item_id?: string | null;
  requested_by_id: string;
  purchase_manager_id?: string | null;
  status: PurchaseRequestStatus;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  requested_by?: UserBrief | null;
  purchase_manager?: UserBrief | null;
  history?: PurchaseRequestHistory[];
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  subtask_id?: string | null;
  filename: string;
  file_size: number;
  content_type?: string | null;
  uploaded_by_id: string;
  created_at: string;
  uploaded_by?: UserBrief | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;

  created_by_id: string;
  assigned_to_id: string;
  requires_approval: boolean;
  approver_id?: string | null;

  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern;
  recurrence_interval: number;
  recurrence_day_of_week?: number | null;
  recurrence_days_of_week?: number[] | null;
  recurrence_day_of_month?: number | null;
  recurrence_end_date?: string | null;
  next_run_date?: string | null;
  parent_task_id?: string | null;

  completed_at?: string | null;
  order_index?: number;
  created_at: string;
  updated_at: string;

  created_by?: UserBrief | null;
  assigned_to?: UserBrief | null;
  approver?: UserBrief | null;

  subtasks_count?: number;
  completed_subtasks_count?: number;
  attachments_count?: number;
  attachments?: TaskAttachment[];
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description?: string | null;
  is_completed: boolean;
  due_date?: string | null;
  order_index?: number;
  assigned_to_id?: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  assigned_to?: UserBrief | null;
  created_by?: UserBrief | null;
  attachments_count?: number;
  attachments?: TaskAttachment[];
}

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id?: string | null;
  action: ActivityAction;
  old_value?: string | null;
  new_value?: string | null;
  details?: string | null;
  created_at: string;
  user?: UserBrief | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: UserBrief | null;
}

export interface TaskDetail extends Task {
  comments_count: number;
  activities_count: number;
  subtasks?: Subtask[];
}

export interface TaskPerformanceMetrics {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  pending_tasks: number;
  pending_approval_tasks: number;
  cancelled_tasks: number;
  overdue_tasks: number;
  on_time_completed_tasks: number;
  task_completion_rate: number;
  on_time_rate: number;
}

export interface SubtaskPerformanceMetrics {
  total_subtasks: number;
  completed_subtasks: number;
  pending_subtasks: number;
  subtask_completion_rate: number;
  avg_subtasks_per_task: number;
}

export interface UserPerformance {
  user_id: string;
  full_name: string;
  role: Role;
  branch?: string | null;
  department?: string | null;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_pending: number;
  tasks_overdue: number;
  task_completion_rate: number;
  subtasks_total: number;
  subtasks_completed: number;
  subtask_completion_rate: number;
  overall_performance_score: number;
}

export interface TaskPerformanceStats {
  scope: string;
  overall_performance_score: number;
  task_metrics: TaskPerformanceMetrics;
  subtask_metrics: SubtaskPerformanceMetrics;
  team_performance: UserPerformance[];
}

export interface DashboardStats {
  user_counts_by_role: Record<string, number>;
  task_counts_by_status: Record<string, number>;
  my_tasks_count: number;
  my_pending_approvals_count: number;
  recurring_tasks_count: number;
  today_logged_in_count?: number;
  today_logins?: {
    id: string;
    full_name: string;
    email: string;
    role: Role;
    branch?: string | null;
    department?: string | null;
    today_first_login_at?: string | null;
    last_login_at?: string | null;
    check_out_time?: string | null;
    status?: string | null;
  }[];
  task_performance?: TaskPerformanceStats | null;
}

export interface WholesaleCustomer {
  id: string;
  name: string;
  place: string;
  contact_number: string;
  email?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WholesaleProduct {
  id: string;
  code: string;
  name: string;
  rate: number;
  category: string;
  brand: string;
  vendor: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export type WholesaleOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED";

export interface WholesaleOrderItemCreate {
  product_id: string;
  quantity: number;
}

export interface WholesaleOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  place: string;
  contact_number: string;
  product_id: string;
  product_code: string;
  product_name: string;
  unit_rate: number;
  quantity: number;
  total_amount: number;
  status: WholesaleOrderStatus;
  notes?: string | null;
  placed_by_id: string;
  created_at: string;
  updated_at: string;
  placed_by?: UserBrief | null;
  customer?: WholesaleCustomer | null;
  product?: WholesaleProduct | null;
}

export interface BulkUploadResult {
  total_rows: number;
  success_count: number;
  updated_count: number;
  failed_count: number;
  errors: string[];
}

export interface BulkDeleteProductsResult {
  deleted_count: number;
  failed_count: number;
  errors: string[];
}

export interface BulkDeleteInventoryResult {
  deleted_count: number;
  failed_count: number;
  errors: string[];
}

export interface ChecklistItem {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  is_completed: boolean;
  due_date?: string | null;
  order_index?: number;
  target_user_id?: string | null;
  target_user?: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface BackupItem {
  filename: string;
  size_bytes: number;
  formatted_size: string;
  created_at: string;
  is_automated: boolean;
}

export interface BackupStatus {
  schedule: string;
  schedule_hour: number;
  schedule_minute: number;
  backup_directory: string;
  total_backups: number;
  scheduler_running: boolean;
  database_name: string;
  latest_backup?: BackupItem | null;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restored_file: string;
  file_size: string;
  duration_seconds: number;
  safety_backup?: string | null;
  restored_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string;
  check_out_time?: string | null;
  total_hours: number;
  status: "PRESENT" | "CHECKED_IN" | "HALF_DAY" | "LATE" | "ON_LEAVE";
  check_in_note?: string | null;
  check_out_note?: string | null;
  ip_address?: string | null;
  created_at: string;
  updated_at: string;
  user?: UserBrief | null;
}

export interface AttendanceTodayStatus {
  is_checked_in: boolean;
  is_checked_out: boolean;
  record?: AttendanceRecord | null;
  worked_seconds: number;
}

export interface AttendanceReportSummary {
  total_records: number;
  total_hours: number;
  average_hours_per_day: number;
  currently_checked_in: number;
  present_count: number;
  half_day_count: number;
}

export interface AttendanceReportResponse {
  items: AttendanceRecord[];
  total: number;
  skip: number;
  limit: number;
  summary: AttendanceReportSummary;
}

export type WarrantyStatus =
  | "RECEIVED"
  | "SEND_TO_COMPANY"
  | "WARRANTY_COMPLETED"
  | "REJECTED"
  | "DELIVERED";

export interface WarrantyServiceType {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarrantyStaff {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarrantyBrand {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarrantyModel {
  id: string;
  name: string;
  brand_id?: string | null;
  brand?: WarrantyBrand | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarrantyJob {
  id: string;
  job_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;

  service_type_id?: string | null;
  service_type_name?: string | null;
  service_type?: WarrantyServiceType | null;

  staff_id?: string | null;
  staff_name?: string | null;
  staff?: WarrantyStaff | null;

  product_name: string;
  serial_number: string;
  brand_id?: string | null;
  brand_name?: string | null;
  brand?: WarrantyBrand | null;

  model_id?: string | null;
  model_name?: string | null;
  model_rel?: WarrantyModel | null;

  work_description: string;
  status: WarrantyStatus;
  notes?: string | null;

  received_date: string;
  completed_date?: string | null;
  delivered_date?: string | null;

  created_by_id?: string | null;
  created_by?: UserBrief | null;

  created_at: string;
  updated_at: string;
}

export interface WarrantySerialHistory {
  serial_number: string;
  total_services: number;
  jobs: WarrantyJob[];
}

export interface WarrantyJobsListResponse {
  items: WarrantyJob[];
  total: number;
  status_counts: Record<string, number>;
}




