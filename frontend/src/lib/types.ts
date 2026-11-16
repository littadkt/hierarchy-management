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

export interface TimeSchedule {
  id: string;
  name: string;
  check_in_time: string;
  check_out_time: string;
  buffer_minutes: number;
  monthly_buffer_limit: number;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  employee_count?: number;
}

export interface BufferStatus {
  buffer_days_used: number;
  monthly_limit: number;
  buffer_minutes: number;
  remaining_days: number;
  scheduled_check_in?: string | null;
  scheduled_check_out?: string | null;
  schedule_name?: string | null;
  month_name: string;
}

export interface UserBrief {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  branch?: string | null;
  department?: string | null;
  schedule_id?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  schedule_name?: string | null;
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
  schedule_id?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  schedule_name?: string | null;
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
  allowed_wifi_ips?: string | null;
  wifi_ssid?: string | null;
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
  status: "PRESENT" | "CHECKED_IN" | "HALF_DAY" | "LATE" | "ON_LEAVE" | "REJECTED";
  schedule_check_in?: string | null;
  schedule_check_out?: string | null;
  is_buffer_used?: boolean;
  is_late?: boolean;
  late_minutes?: number;
  check_in_note?: string | null;
  check_out_note?: string | null;
  ip_address?: string | null;
  approval_status?: "APPROVED" | "PENDING" | "REJECTED";
  requires_approval?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  wifi_ssid?: string | null;
  approved_by_id?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  user?: UserBrief | null;
  approved_by?: UserBrief | null;
}

export interface AttendanceTodayStatus {
  is_checked_in: boolean;
  is_checked_out: boolean;
  record?: AttendanceRecord | null;
  worked_seconds: number;
  buffer_status?: BufferStatus | null;
  scheduled_check_in?: string | null;
  scheduled_check_out?: string | null;
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

export type NotificationType =
  | "TASK_ASSIGNED"
  | "CHECKOUT_REMINDER"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECIDED"
  | "SYSTEM";

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  total: number;
  unread_count: number;
}

// ==========================================
// SAP ERP INTERFACES
// ==========================================
export interface ProductServiceTicket {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  product_name: string;
  serial_number?: string | null;
  service_type: string;
  priority: string;
  status: string;
  issue_description: string;
  diagnostic_notes?: string | null;
  parts_replaced?: string | null;
  parts_cost: number;
  service_charge: number;
  total_cost: number;
  assigned_technician_name?: string | null;
  received_date: string;
  expected_delivery_date?: string | null;
  completed_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalProduct {
  id: string;
  product_code: string;
  name: string;
  category: string;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  security_deposit: number;
  total_quantity: number;
  available_quantity: number;
  condition_status: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalBooking {
  id: string;
  booking_number: string;
  rental_product_id?: string | null;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  customer_id_proof?: string | null;
  start_date: string;
  end_date: string;
  actual_return_date?: string | null;
  rate_type: string;
  rental_rate: number;
  quantity: number;
  total_amount: number;
  security_deposit: number;
  deposit_refunded: number;
  damage_charges: number;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapSalesOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  order_date: string;
  total_amount: number;
  tax_amount: number;
  status: string;
  payment_status: string;
  items_summary?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapDashboardStats {
  active_service_tickets: number;
  completed_services_this_month: number;
  service_revenue: number;
  total_service_revenue?: number;
  total_rental_assets: number;
  active_rentals: number;
  rental_revenue: number;
  total_rental_revenue?: number;
  open_sales_orders: number;
  total_sales_revenue: number;
  inventory_items_count: number;
  low_stock_alerts_count: number;
  gl_accounts_count?: number;
  total_posted_jv?: number;
  cost_centers_count?: number;
  materials_count?: number;
  open_pr_count?: number;
  open_quotations_count?: number;
  hcm_employees_count?: number;
  open_production_orders?: number;
  warehouse_bins_count?: number;
  active_abap_scripts?: number;
  total_tax_collected?: number;
  total_itc_credit?: number;
  fi_gl_accounts_count?: number;
  co_cost_centers_count?: number;
  mm_materials_count?: number;
  sd_quotations_count?: number;
  pp_production_orders_count?: number;
  wm_warehouse_bins_count?: number;
  abap_scripts_count?: number;
  tax_rates_count?: number;
  invoices_count?: number;
  total_invoiced_revenue?: number;
  pending_invoices_due?: number;
  total_receivables_due?: number;
  total_payables_due?: number;
  total_customers?: number;
  total_vendors?: number;
  vendors_count?: number;
  open_purchase_orders?: number;
  purchase_orders_count?: number;
  goods_receipts_count?: number;
  outbound_deliveries_count?: number;
  total_stock_valuation?: number;
}

// -------------------------------------------------------------
// 1. SAP FI - FINANCIAL ACCOUNTING
// -------------------------------------------------------------
export interface SapGlAccount {
  id: string;
  account_number: string;
  account_name: string;
  account_type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" | string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface SapJournalEntry {
  id: string;
  entry_number: string;
  posting_date: string;
  reference: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  currency: string;
  narration: string;
  status: "POSTED" | "DRAFT" | "REVERSED" | string;
  tax_code?: string | null;
  tax_amount: number;
  created_at: string;
}

// -------------------------------------------------------------
// 2. SAP CO - COST & PROFIT MANAGEMENT
// -------------------------------------------------------------
export interface SapCostCenter {
  id: string;
  center_code: string;
  name: string;
  manager_name: string;
  department: string;
  budget_amount: number;
  actual_spent: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface SapProfitCenter {
  id: string;
  center_code: string;
  name: string;
  head_name: string;
  target_revenue: number;
  actual_revenue: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

// -------------------------------------------------------------
// 3. SAP MM - MATERIAL MANAGEMENT
// -------------------------------------------------------------
export interface SapMaterialMaster {
  id: string;
  material_code: string;
  name: string;
  material_type: "RAW_MATERIAL" | "SPARE_PART" | "FINISHED_GOOD" | "OPERATING_SUPPLY" | string;
  base_uom: string;
  current_stock: number;
  safety_stock: number;
  unit_price: number;
  storage_location: string;
  valuation_class: string;
  hsn_code: string;
  tax_rate: number;
  created_at: string;
}

export interface SapPurchaseRequisition {
  id: string;
  pr_number: string;
  material_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  estimated_cost: number;
  tax_amount: number;
  requested_by: string;
  status: "PENDING" | "APPROVED" | "PO_CREATED" | "REJECTED" | string;
  required_date: string;
  created_at: string;
}

// -------------------------------------------------------------
// 4. SAP SD - SALES & DISTRIBUTION (QUOTATIONS)
// -------------------------------------------------------------
export interface SapQuotation {
  id: string;
  quotation_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  pricing_condition: string;
  valid_until: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED_TO_ORDER" | string;
  notes?: string | null;
  created_at: string;
}

// -------------------------------------------------------------
// 5. SAP HCM - HUMAN RESOURCE MANAGEMENT
// -------------------------------------------------------------
export interface SapHcmEmployee {
  id: string;
  personnel_number: string;
  full_name: string;
  designation: string;
  department: string;
  employment_type: "PERMANENT" | "CONTRACT" | "TRAINEE" | string;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  tax_deduction_tds: number;
  net_salary: number;
  joining_date: string;
  status: "ACTIVE" | "ON_LEAVE" | "RESIGNED" | string;
  created_at: string;
}

// -------------------------------------------------------------
// 6. SAP PP - PRODUCTION PLANNING
// -------------------------------------------------------------
export interface SapProductionOrder {
  id: string;
  order_number: string;
  product_name: string;
  planned_quantity: number;
  produced_quantity: number;
  uom: string;
  work_center: string;
  start_date: string;
  end_date: string;
  status: "PLANNED" | "RELEASED" | "IN_PROCESS" | "COMPLETED" | "CANCELLED" | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | string;
  created_at: string;
}

export interface SapBomItem {
  id: string;
  bom_code: string;
  parent_product: string;
  component_code: string;
  component_name: string;
  quantity: number;
  uom: string;
  scrap_factor_pct: number;
  created_at: string;
}

// -------------------------------------------------------------
// 7. SAP WM - WAREHOUSE MANAGEMENT
// -------------------------------------------------------------
export interface SapWarehouseBin {
  id: string;
  bin_code: string;
  warehouse_zone: string;
  storage_type: "RACK" | "SHELF" | "FLOOR_PALLET" | string;
  max_weight_capacity_kg: number;
  current_weight_kg: number;
  current_material_code?: string | null;
  current_material_name?: string | null;
  current_stock_qty: number;
  status: "EMPTY" | "OCCUPIED" | "FULL" | "LOCKED" | string;
  created_at: string;
}

export interface SapTransferOrder {
  id: string;
  transfer_number: string;
  material_code: string;
  material_name: string;
  source_bin: string;
  destination_bin: string;
  quantity: number;
  uom: string;
  status: "OPEN" | "CONFIRMED" | "CANCELLED" | string;
  created_at: string;
}

// -------------------------------------------------------------
// 8. SAP ABAP - PROGRAMMING & CUSTOMIZATION WORKBENCH
// -------------------------------------------------------------
export interface SapAbapScript {
  id: string;
  script_name: string;
  title: string;
  module: "FI" | "CO" | "MM" | "SD" | "HCM" | "PP" | "WM" | "TAX" | string;
  code: string;
  author: string;
  version: string;
  execution_count: number;
  last_run_at?: string | null;
  last_output?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SapAbapRunResponse {
  status: string;
  execution_time_ms: number;
  output_log: string;
  result_dataset: Array<Record<string, any>>;
}

// -------------------------------------------------------------
// 9. TAX OPTION - TAX SLABS & TAX LEDGER
// -------------------------------------------------------------
export interface SapTaxRate {
  id: string;
  tax_code: string;
  tax_name: string;
  tax_type: "GST" | "IGST" | "VAT" | "TDS" | "CESS" | string;
  rate_percentage: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SapTaxLedger {
  id: string;
  transaction_number: string;
  source_module: string;
  invoice_reference: string;
  hsn_sac_code: string;
  taxable_amount: number;
  tax_rate_pct: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  entry_type: "OUTPUT_TAX" | "INPUT_TAX_CREDIT" | "TDS_DEDUCTED" | string;
  posting_date: string;
  party_name: string;
  party_gstin?: string | null;
  created_at: string;
}

export interface SapTaxSummary {
  total_output_tax: number;
  total_input_credit: number;
  net_tax_payable: number;
  tax_breakdown_by_rate: Record<string, number>;
}

// -------------------------------------------------------------
// 10. SAP SALES & DISTRIBUTION (SD) ENTERPRISE
// -------------------------------------------------------------
export interface SapCustomer {
  id: string;
  customer_code: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone: string;
  gstin?: string | null;
  pan?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  city?: string | null;
  state?: string | null;
  credit_limit: number;
  outstanding_balance: number;
  payment_terms: string;
  customer_group: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SapCustomerEnquiry {
  id: string;
  enquiry_number: string;
  customer_name: string;
  contact_phone: string;
  contact_email?: string | null;
  requirement_details: string;
  source: string;
  estimated_value: number;
  status: string;
  assigned_to?: string | null;
  created_at: string;
}

export interface SapInvoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  billing_date: string;
  due_date: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_gstin?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  source_module: string;
  source_reference?: string | null;
  payment_terms: string;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  payment_method?: string | null;
  notes?: string | null;
  items_summary?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapOutboundDelivery {
  id: string;
  delivery_number: string;
  sales_order_number: string;
  customer_name: string;
  shipping_address: string;
  carrier_name: string;
  tracking_number: string;
  shipping_date: string;
  estimated_delivery: string;
  actual_delivery?: string | null;
  status: string;
  total_packages: number;
  total_weight_kg: number;
  driver_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapPosSale {
  id: string;
  bill_number: string;
  counter_code: string;
  cashier_name: string;
  customer_name: string;
  customer_phone?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  tender_amount: number;
  change_returned: number;
  payment_mode: string;
  items_json?: string | null;
  created_at: string;
}

// -------------------------------------------------------------
// 11. SAP MATERIALS MANAGEMENT (MM) & PURCHASING
// -------------------------------------------------------------
export interface SapVendor {
  id: string;
  vendor_code: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone: string;
  gstin?: string | null;
  pan?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  payment_terms: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
  ifsc_code?: string | null;
  rating: number;
  outstanding_payable: number;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SapPurchaseOrder {
  id: string;
  po_number: string;
  vendor_code: string;
  vendor_name: string;
  vendor_gstin?: string | null;
  order_date: string;
  expected_delivery_date: string;
  material_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_terms: string;
  shipping_address?: string | null;
  approval_status: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SapGoodsReceipt {
  id: string;
  grn_number: string;
  po_reference: string;
  vendor_name: string;
  received_date: string;
  material_code: string;
  material_name: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  uom: string;
  warehouse_zone: string;
  storage_bin: string;
  quality_status: string;
  received_by: string;
  delivery_challan_number?: string | null;
  remarks?: string | null;
  created_at: string;
}

export interface SapVendorBill {
  id: string;
  bill_number: string;
  vendor_bill_ref: string;
  po_reference?: string | null;
  grn_reference?: string | null;
  vendor_code: string;
  vendor_name: string;
  vendor_gstin?: string | null;
  bill_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_payable: number;
  status: string;
  created_at: string;
}

export interface SapDebitNote {
  id: string;
  debit_note_number: string;
  original_bill_ref: string;
  vendor_code: string;
  vendor_name: string;
  return_reason: string;
  debit_amount: number;
  tax_reversed: number;
  total_debit: number;
  status: string;
  created_at: string;
}

// -------------------------------------------------------------
// 12. SAP INVENTORY MODULE
// -------------------------------------------------------------
export interface SapStockTransfer {
  id: string;
  transfer_code: string;
  material_code: string;
  material_name: string;
  source_godown: string;
  destination_godown: string;
  quantity: number;
  uom: string;
  transfer_date: string;
  authorized_by: string;
  status: string;
  created_at: string;
}

export interface SapStockMovement {
  id: string;
  document_number: string;
  movement_type: string;
  material_code: string;
  material_name: string;
  quantity: number;
  uom: string;
  storage_location: string;
  reference_order?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SapStockTaking {
  id: string;
  count_cycle_code: string;
  material_code: string;
  material_name: string;
  storage_location: string;
  system_book_quantity: number;
  physical_counted_quantity: number;
  variance_quantity: number;
  variance_value: number;
  counted_by: string;
  reconciled_status: string;
  count_date: string;
}

export interface SapDamagedItem {
  id: string;
  incident_number: string;
  material_code: string;
  material_name: string;
  damaged_quantity: number;
  uom: string;
  estimated_loss_value: number;
  damage_reason: string;
  disposal_action: string;
  approved_by: string;
  created_at: string;
}

export interface SapPriceChange {
  id: string;
  change_number: string;
  material_code: string;
  material_name: string;
  old_selling_price: number;
  new_selling_price: number;
  effective_date: string;
  reason: string;
  changed_by: string;
  created_at: string;
}

// -------------------------------------------------------------
// 13. SAP FINANCIAL ACCOUNTING (FI) VOUCHERS & BRS
// -------------------------------------------------------------
export interface SapAccountingVoucher {
  id: string;
  voucher_number: string;
  voucher_type: string;
  voucher_date: string;
  debit_ledger: string;
  credit_ledger: string;
  amount: number;
  narration: string;
  reference_number?: string | null;
  cheque_or_utr_number?: string | null;
  status: string;
  created_at: string;
}

export interface SapBankReconciliation {
  id: string;
  statement_number: string;
  bank_account_ledger: string;
  period_date: string;
  balance_as_per_company_books: number;
  balance_as_per_bank_statement: number;
  uncredited_deposits: number;
  unpresented_cheques: number;
  bank_charges_not_booked: number;
  reconciled_difference: number;
  status: string;
  created_at: string;
}

// -------------------------------------------------------------
// 14. SAP ADMINISTRATION, TEMPLATES & DATA MIGRATION
// -------------------------------------------------------------
export interface SapVoucherFormat {
  id: string;
  format_code: string;
  title: string;
  doc_type: string;
  header_title: string;
  footer_terms: string;
  show_gst_breakup: boolean;
  show_qr_code: boolean;
  company_pan_display: string;
  company_gstin_display: string;
  is_default: boolean;
  created_at: string;
}

export interface SapDataMigration {
  id: string;
  batch_code: string;
  entity_type: string;
  total_records: number;
  imported_success: number;
  import_failed: number;
  status: string;
  filename: string;
  uploaded_by: string;
  created_at: string;
}

// -------------------------------------------------------------
// 15. COMPREHENSIVE DRILL-DOWN STATEMENTS & FINANCIAL REPORTS
// -------------------------------------------------------------
export interface TrialBalanceItem {
  account_number: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export interface SapTrialBalanceReport {
  items: TrialBalanceItem[];
  total_debits: number;
  total_credits: number;
  is_balanced: boolean;
}

export interface SapProfitLossReport {
  total_revenue: number;
  sales_revenue: number;
  service_revenue: number;
  rental_revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  operating_expenses: number;
  depreciation: number;
  net_profit: number;
}

export interface SapBalanceSheetReport {
  current_assets: number;
  fixed_assets: number;
  total_assets: number;
  current_liabilities: number;
  long_term_liabilities: number;
  total_liabilities: number;
  equity_retained_earnings: number;
  total_liabilities_and_equity: number;
}

export interface ReceivablesAgeingBucket {
  customer_code: string;
  customer_name: string;
  total_outstanding: number;
  current_0_30_days: number;
  bucket_31_60_days: number;
  bucket_61_90_days: number;
  bucket_90_plus_days: number;
}

export interface SapReceivablesAgeingReport {
  buckets: ReceivablesAgeingBucket[];
  grand_total_outstanding: number;
  total_0_30: number;
  total_31_60: number;
  total_61_90: number;
  total_90_plus: number;
}

export interface SalesRegisterEntry {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_gstin?: string | null;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  status: string;
}

export interface SapSalesRegisterReport {
  entries: SalesRegisterEntry[];
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_sales: number;
}



// ==========================================
// CRM SUITE & AI INTERFACES
// ==========================================
export interface CrmLead {
  id: string;
  lead_code: string;
  full_name: string;
  company_name?: string | null;
  email?: string | null;
  phone: string;
  source: string;
  status: string;
  estimated_value: number;
  assigned_to_name?: string | null;
  ai_score: number;
  ai_qualification_summary?: string | null;
  ai_recommended_action?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDeal {
  id: string;
  deal_code: string;
  title: string;
  customer_name: string;
  amount: number;
  stage: string;
  probability: number;
  expected_close_date?: string | null;
  assigned_to_name?: string | null;
  ai_win_probability: number;
  ai_deal_risks?: string | null;
  ai_deal_recommendations?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmCustomer {
  id: string;
  customer_code: string;
  name: string;
  company_name?: string | null;
  email?: string | null;
  phone: string;
  industry?: string | null;
  address?: string | null;
  total_spend: number;
  status: string;
  customer_tier: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmTicket {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assigned_agent_name?: string | null;
  sla_due_date?: string | null;
  ai_sentiment?: string | null;
  ai_suggested_response?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmDashboardStats {
  total_leads: number;
  qualified_leads: number;
  open_pipeline_value: number;
  total_deals_count: number;
  won_deals_count: number;
  total_customers: number;
  open_tickets: number;
  avg_ai_lead_score: number;
}

export interface CrmAiChatResponse {
  response: string;
  relevant_links?: Array<{ label: string; url: string }>;
}

export interface CrmAiDraftResponse {
  subject: string;
  content: string;
  suggested_call_to_action: string;
}






