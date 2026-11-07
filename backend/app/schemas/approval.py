import enum
from typing import Optional
from pydantic import BaseModel, Field


class ApprovalAction(str, enum.Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"


class ApprovalDecision(BaseModel):
    action: ApprovalAction
    comments: Optional[str] = Field(None, max_length=1000, description="Notes on approval or rejection reasons")


class SubmitForApproval(BaseModel):
    comments: Optional[str] = Field(None, max_length=1000, description="Notes summarizing completed work for reviewer")

