import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# -------------------------------------------------------------
# CRM LEADS
# -------------------------------------------------------------
class CrmLeadBase(BaseModel):
    full_name: str = Field(..., max_length=255)
    company_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: str = Field(..., max_length=50)
    source: str = Field(default="WEBSITE")  # WEBSITE, REFERRAL, COLD_CALL, EXHIBITION, SOCIAL_MEDIA, PARTNER
    status: str = Field(default="NEW")  # NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT, CONVERTED, LOST
    estimated_value: float = Field(default=0.0, ge=0)
    assigned_to_name: Optional[str] = None
    ai_score: int = Field(default=50, ge=0, le=100)
    ai_qualification_summary: Optional[str] = None
    ai_recommended_action: Optional[str] = None
    notes: Optional[str] = None


class CrmLeadCreate(CrmLeadBase):
    lead_code: Optional[str] = None


class CrmLeadUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    estimated_value: Optional[float] = None
    assigned_to_name: Optional[str] = None
    ai_score: Optional[int] = None
    ai_qualification_summary: Optional[str] = None
    ai_recommended_action: Optional[str] = None
    notes: Optional[str] = None


class CrmLeadOut(CrmLeadBase):
    id: uuid.UUID
    lead_code: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# CRM DEALS / PIPELINE
# -------------------------------------------------------------
class CrmDealBase(BaseModel):
    title: str = Field(..., max_length=255)
    customer_name: str = Field(..., max_length=255)
    amount: float = Field(default=0.0, ge=0)
    stage: str = Field(default="DISCOVERY")  # DISCOVERY, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
    probability: int = Field(default=20, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    ai_win_probability: int = Field(default=50, ge=0, le=100)
    ai_deal_risks: Optional[str] = None
    ai_deal_recommendations: Optional[str] = None
    notes: Optional[str] = None


class CrmDealCreate(CrmDealBase):
    deal_code: Optional[str] = None


class CrmDealUpdate(BaseModel):
    title: Optional[str] = None
    customer_name: Optional[str] = None
    amount: Optional[float] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None
    assigned_to_name: Optional[str] = None
    ai_win_probability: Optional[int] = None
    ai_deal_risks: Optional[str] = None
    ai_deal_recommendations: Optional[str] = None
    notes: Optional[str] = None


class CrmDealOut(CrmDealBase):
    id: uuid.UUID
    deal_code: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# CRM CUSTOMER 360
# -------------------------------------------------------------
class CrmCustomerBase(BaseModel):
    name: str = Field(..., max_length=255)
    company_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: str = Field(..., max_length=50)
    industry: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    total_spend: float = Field(default=0.0, ge=0)
    status: str = Field(default="ACTIVE")  # ACTIVE, CHURNED, PROSPECT
    customer_tier: str = Field(default="STANDARD")  # STANDARD, SILVER, GOLD, PLATINUM
    notes: Optional[str] = None


class CrmCustomerCreate(CrmCustomerBase):
    customer_code: Optional[str] = None


class CrmCustomerUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    total_spend: Optional[float] = None
    status: Optional[str] = None
    customer_tier: Optional[str] = None
    notes: Optional[str] = None


class CrmCustomerOut(CrmCustomerBase):
    id: uuid.UUID
    customer_code: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# CRM SUPPORT TICKETS & SLA
# -------------------------------------------------------------
class CrmTicketBase(BaseModel):
    customer_name: str = Field(..., max_length=255)
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    subject: str = Field(..., max_length=255)
    description: str
    priority: str = Field(default="MEDIUM")  # LOW, MEDIUM, HIGH, URGENT
    status: str = Field(default="OPEN")  # OPEN, IN_PROGRESS, PENDING_CUSTOMER, RESOLVED, CLOSED
    assigned_agent_name: Optional[str] = None
    sla_due_date: Optional[datetime] = None
    ai_sentiment: Optional[str] = "NEUTRAL"
    ai_suggested_response: Optional[str] = None
    resolution_notes: Optional[str] = None


class CrmTicketCreate(CrmTicketBase):
    ticket_number: Optional[str] = None


class CrmTicketUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    subject: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    sla_due_date: Optional[datetime] = None
    ai_sentiment: Optional[str] = None
    ai_suggested_response: Optional[str] = None
    resolution_notes: Optional[str] = None


class CrmTicketOut(CrmTicketBase):
    id: uuid.UUID
    ticket_number: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# CRM DASHBOARD STATS
# -------------------------------------------------------------
class CrmDashboardStats(BaseModel):
    total_leads: int
    qualified_leads: int
    open_pipeline_value: float
    total_deals_count: int
    won_deals_count: int
    total_customers: int
    open_tickets: int
    avg_ai_lead_score: float


# -------------------------------------------------------------
# AI AGENT SCHEMAS
# -------------------------------------------------------------
class CrmAiLeadAnalyzeResponse(BaseModel):
    lead_id: uuid.UUID
    lead_code: str
    ai_score: int
    ai_qualification_summary: str
    ai_recommended_action: str


class CrmAiDealAnalyzeResponse(BaseModel):
    deal_id: uuid.UUID
    deal_code: str
    ai_win_probability: int
    ai_deal_risks: str
    ai_deal_recommendations: str


class CrmAiDraftRequest(BaseModel):
    context_type: str = Field(..., description="'ticket_response', 'sales_pitch', 'deal_proposal'")
    recipient_name: str
    topic_or_subject: str
    additional_context: Optional[str] = None
    tone: Optional[str] = "Professional and helpful"


class CrmAiDraftResponse(BaseModel):
    subject: str
    content: str
    suggested_call_to_action: str


class CrmAiChatRequest(BaseModel):
    query: str
    history: Optional[List[dict]] = None


class CrmAiChatResponse(BaseModel):
    response: str
    relevant_links: Optional[List[dict]] = None
