import enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ApprovalAction(str, enum.Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class ApprovalDecision(BaseModel):
    action: ApprovalAction
    comments: Optional[str] = Field(None, max_length=1000, description="Notes on approval or rejection reasons")


class SubmitForApproval(BaseModel):
    comments: Optional[str] = Field(None, max_length=1000, description="Notes summarizing completed work for reviewer")


class PendingTaskSummaryItem(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    due_date: Optional[str] = None
    is_overdue: bool = False
    is_due_today: bool = False
    assigned_to_id: Optional[str] = None
    assigned_to_name: str
    assigned_to_role: str


class UserPendingSummary(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    branch: Optional[str] = None
    department: Optional[str] = None
    user_pending_tasks: List[PendingTaskSummaryItem]
    subordinates_count: int
    subordinates_pending_tasks: List[PendingTaskSummaryItem]


class ApprovalPendingContextOut(BaseModel):
    task_id: str
    task_title: str
    approver: Optional[UserPendingSummary] = None
    assignee: Optional[UserPendingSummary] = None
    primary_user: UserPendingSummary
    total_pending_count: int


