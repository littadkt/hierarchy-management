from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.crm import (
    CrmAiChatRequest,
    CrmAiChatResponse,
    CrmAiDealAnalyzeResponse,
    CrmAiDraftRequest,
    CrmAiDraftResponse,
    CrmAiLeadAnalyzeResponse,
    CrmCustomerCreate,
    CrmCustomerOut,
    CrmCustomerUpdate,
    CrmDashboardStats,
    CrmDealCreate,
    CrmDealOut,
    CrmDealUpdate,
    CrmLeadCreate,
    CrmLeadOut,
    CrmLeadUpdate,
    CrmTicketCreate,
    CrmTicketOut,
    CrmTicketUpdate,
)
from app.services.crm_ai_service import CrmAiService
from app.services.crm_service import CrmService

router = APIRouter()


class LeadListResponse(BaseModel):
    items: List[CrmLeadOut]
    total: int


class DealListResponse(BaseModel):
    items: List[CrmDealOut]
    total: int


class CustomerListResponse(BaseModel):
    items: List[CrmCustomerOut]
    total: int


class TicketListResponse(BaseModel):
    items: List[CrmTicketOut]
    total: int


# -------------------------------------------------------------
# CRM DASHBOARD STATS
# -------------------------------------------------------------
@router.get("/dashboard", response_model=CrmDashboardStats)
async def get_crm_dashboard_stats(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.get_dashboard_stats(session)


# -------------------------------------------------------------
# LEADS MANAGEMENT
# -------------------------------------------------------------
@router.get("/leads", response_model=LeadListResponse)
async def list_leads(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await CrmService.list_leads(
        session, search=search, lead_status=status, source=source, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get("/leads/{lead_id}", response_model=CrmLeadOut)
async def get_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.get_lead(session, lead_id)


@router.post("/leads", response_model=CrmLeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: CrmLeadCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.create_lead(session, payload)


@router.put("/leads/{lead_id}", response_model=CrmLeadOut)
async def update_lead(
    lead_id: uuid.UUID,
    payload: CrmLeadUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.update_lead(session, lead_id, payload)


@router.delete("/leads/{lead_id}")
async def delete_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await CrmService.delete_lead(session, lead_id)
    return {"message": "Lead deleted successfully"}


# -------------------------------------------------------------
# DEALS / PIPELINE MANAGEMENT
# -------------------------------------------------------------
@router.get("/deals", response_model=DealListResponse)
async def list_deals(
    stage: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await CrmService.list_deals(
        session, stage=stage, search=search, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get("/deals/{deal_id}", response_model=CrmDealOut)
async def get_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.get_deal(session, deal_id)


@router.post("/deals", response_model=CrmDealOut, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: CrmDealCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.create_deal(session, payload)


@router.put("/deals/{deal_id}", response_model=CrmDealOut)
async def update_deal(
    deal_id: uuid.UUID,
    payload: CrmDealUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.update_deal(session, deal_id, payload)


@router.delete("/deals/{deal_id}")
async def delete_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await CrmService.delete_deal(session, deal_id)
    return {"message": "Deal deleted successfully"}


# -------------------------------------------------------------
# CUSTOMER 360 DIRECTORY
# -------------------------------------------------------------
@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    search: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await CrmService.list_customers(
        session, search=search, tier=tier, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get("/customers/{customer_id}", response_model=CrmCustomerOut)
async def get_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.get_customer(session, customer_id)


@router.post("/customers", response_model=CrmCustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CrmCustomerCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.create_customer(session, payload)


@router.put("/customers/{customer_id}", response_model=CrmCustomerOut)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CrmCustomerUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.update_customer(session, customer_id, payload)


@router.delete("/customers/{customer_id}")
async def delete_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await CrmService.delete_customer(session, customer_id)
    return {"message": "Customer deleted successfully"}


# -------------------------------------------------------------
# SUPPORT TICKETS & SLA
# -------------------------------------------------------------
@router.get("/tickets", response_model=TicketListResponse)
async def list_tickets(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total = await CrmService.list_tickets(
        session, search=search, ticket_status=status, priority=priority, skip=skip, limit=limit
    )
    return {"items": items, "total": total}


@router.get("/tickets/{ticket_id}", response_model=CrmTicketOut)
async def get_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.get_ticket(session, ticket_id)


@router.post("/tickets", response_model=CrmTicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: CrmTicketCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.create_ticket(session, payload)


@router.put("/tickets/{ticket_id}", response_model=CrmTicketOut)
async def update_ticket(
    ticket_id: uuid.UUID,
    payload: CrmTicketUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await CrmService.update_ticket(session, ticket_id, payload)


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    await CrmService.delete_ticket(session, ticket_id)
    return {"message": "Ticket deleted successfully"}


# -------------------------------------------------------------
# CRM AI AGENT ENDPOINTS
# -------------------------------------------------------------
@router.post("/ai/analyze-lead/{lead_id}", response_model=CrmAiLeadAnalyzeResponse)
async def ai_analyze_lead(
    lead_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Calculates dynamic AI lead qualification score and recommended next step."""
    return await CrmAiService.analyze_lead(session, lead_id)


@router.post("/ai/analyze-deal/{deal_id}", response_model=CrmAiDealAnalyzeResponse)
async def ai_analyze_deal(
    deal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Predicts deal win probability, identifies deal risk factors, and recommends closing strategies."""
    return await CrmAiService.analyze_deal(session, deal_id)


@router.post("/ai/draft", response_model=CrmAiDraftResponse)
async def ai_draft_content(
    payload: CrmAiDraftRequest,
    current_user: User = Depends(get_current_user),
) -> Any:
    """Generates professional support ticket replies, sales pitches, or deal proposals."""
    return await CrmAiService.draft_content(payload)


@router.post("/ai/chat", response_model=CrmAiChatResponse)
async def ai_chat_copilot(
    payload: CrmAiChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Interactive Conversational CRM Copilot answering sales, lead, ticket, and operational questions."""
    return await CrmAiService.chat_copilot(session, payload.model_dump())
