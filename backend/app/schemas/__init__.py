from app.schemas.attendance import (
    AttendanceOut,
    AttendanceReportResponse,
    AttendanceReportSummary,
    AttendanceTodayStatus,
    CheckInRequest,
    CheckOutRequest,
)
from app.schemas.stats import (
    DashboardStats,
    SubtaskPerformanceMetrics,
    TaskPerformanceMetrics,
    TaskPerformanceStats,
    UserPerformance,
)
from app.schemas.token import Token, TokenPayload
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserOut,
    UserBrief,
    UserWithStats,
    UserTaskStats,
)
from app.schemas.task import (
    TaskBase,
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskOut,
    TaskDetailOut,
)
from app.schemas.approval import ApprovalAction, ApprovalDecision, SubmitForApproval
from app.schemas.activity import ActivityOut, CommentCreate, CommentOut
from app.schemas.attachment import AttachmentOut
from app.schemas.inventory import (
    InventoryItemBase,
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemOut,
)
from app.schemas.purchase_request import (
    PurchaseRequestBase,
    PurchaseRequestCreate,
    PurchaseRequestStatusUpdate,
    PurchaseRequestOut,
    PurchaseRequestHistoryOut,
)
from app.schemas.warranty import (
    WarrantyBrandCreate,
    WarrantyBrandOut,
    WarrantyBrandUpdate,
    WarrantyJobCreate,
    WarrantyJobOut,
    WarrantyJobsListResponse,
    WarrantyJobStatusUpdate,
    WarrantyJobUpdate,
    WarrantyModelCreate,
    WarrantyModelOut,
    WarrantyModelUpdate,
    WarrantySerialHistory,
    WarrantyServiceTypeCreate,
    WarrantyServiceTypeOut,
    WarrantyServiceTypeUpdate,
    WarrantyStaffCreate,
    WarrantyStaffOut,
    WarrantyStaffUpdate,
)

__all__ = [
    "Token",
    "TokenPayload",
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserOut",
    "UserBrief",
    "UserWithStats",
    "UserTaskStats",
    "TaskBase",
    "TaskCreate",
    "TaskUpdate",
    "TaskStatusUpdate",
    "TaskOut",
    "TaskDetailOut",
    "ApprovalAction",
    "ApprovalDecision",
    "SubmitForApproval",
    "ActivityOut",
    "CommentCreate",
    "CommentOut",
    "AttachmentOut",
    "InventoryItemBase",
    "InventoryItemCreate",
    "InventoryItemUpdate",
    "InventoryItemOut",
    "PurchaseRequestBase",
    "PurchaseRequestCreate",
    "PurchaseRequestStatusUpdate",
    "PurchaseRequestOut",
    "PurchaseRequestHistoryOut",
]
