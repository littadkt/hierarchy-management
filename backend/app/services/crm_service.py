from datetime import datetime, timezone
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CrmCustomer, CrmDeal, CrmLead, CrmTicket
from app.schemas.crm import (
    CrmCustomerCreate,
    CrmCustomerUpdate,
    CrmDashboardStats,
    CrmDealCreate,
    CrmDealUpdate,
    CrmLeadCreate,
    CrmLeadUpdate,
    CrmTicketCreate,
    CrmTicketUpdate,
)


class CrmService:
    # -------------------------------------------------------------
    # 1. LEADS MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_leads(
        session: AsyncSession,
        search: Optional[str] = None,
        lead_status: Optional[str] = None,
        source: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[CrmLead], int]:
        stmt = select(CrmLead)

        if lead_status and lead_status.upper() != "ALL":
            stmt = stmt.where(CrmLead.status == lead_status.upper())

        if source and source.upper() != "ALL":
            stmt = stmt.where(CrmLead.source == source.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    CrmLead.lead_code.ilike(search_term),
                    CrmLead.full_name.ilike(search_term),
                    CrmLead.company_name.ilike(search_term),
                    CrmLead.phone.ilike(search_term),
                    CrmLead.email.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(CrmLead.created_at)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_lead(session: AsyncSession, lead_id: uuid.UUID) -> Optional[CrmLead]:
        stmt = select(CrmLead).where(CrmLead.id == lead_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_lead(session: AsyncSession, data: CrmLeadCreate) -> CrmLead:
        lead_code = data.lead_code
        if not lead_code:
            count_res = await session.execute(select(func.count(CrmLead.id)))
            current_count = (count_res.scalar() or 0) + 1
            lead_code = f"LED-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        # Calculate preliminary AI score based on lead metadata
        score = 50
        summary = "Standard inbound inquiry."
        rec = "Conduct initial qualification call within 24 hours."

        if data.company_name:
            score += 15
        if data.email and "@" in data.email:
            score += 10
        if data.estimated_value > 50000:
            score += 15
            summary = "High estimated budget enterprise prospect."
            rec = "Assign senior sales engineer and schedule executive demo."
        elif data.estimated_value > 10000:
            score += 10
            summary = "Mid-tier qualified business prospect."
            rec = "Send product catalog & brochure, schedule introductory call."

        if data.source in ["REFERRAL", "PARTNER"]:
            score += 10

        ai_score = min(99, max(20, data.ai_score or score))
        ai_summary = data.ai_qualification_summary or summary
        ai_rec = data.ai_recommended_action or rec

        lead = CrmLead(
            lead_code=lead_code,
            full_name=data.full_name.strip(),
            company_name=data.company_name.strip() if data.company_name else None,
            email=data.email.strip() if data.email else None,
            phone=data.phone.strip(),
            source=data.source.upper(),
            status=data.status.upper(),
            estimated_value=data.estimated_value,
            assigned_to_name=data.assigned_to_name,
            ai_score=ai_score,
            ai_qualification_summary=ai_summary,
            ai_recommended_action=ai_rec,
            notes=data.notes,
        )
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        return lead

    @staticmethod
    async def update_lead(
        session: AsyncSession, lead_id: uuid.UUID, data: CrmLeadUpdate
    ) -> CrmLead:
        lead = await CrmService.get_lead(session, lead_id)
        if not lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key in ["status", "source"]:
                    setattr(lead, key, str(value).upper())
                else:
                    setattr(lead, key, value)

        await session.commit()
        await session.refresh(lead)
        return lead

    @staticmethod
    async def delete_lead(session: AsyncSession, lead_id: uuid.UUID) -> bool:
        lead = await CrmService.get_lead(session, lead_id)
        if not lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
        await session.delete(lead)
        await session.commit()
        return True

    # -------------------------------------------------------------
    # 2. DEALS / PIPELINE MANAGEMENT
    # -------------------------------------------------------------
    @staticmethod
    async def list_deals(
        session: AsyncSession,
        stage: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[CrmDeal], int]:
        stmt = select(CrmDeal)

        if stage and stage.upper() != "ALL":
            stmt = stmt.where(CrmDeal.stage == stage.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    CrmDeal.deal_code.ilike(search_term),
                    CrmDeal.title.ilike(search_term),
                    CrmDeal.customer_name.ilike(search_term),
                    CrmDeal.assigned_to_name.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(CrmDeal.amount)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_deal(session: AsyncSession, deal_id: uuid.UUID) -> Optional[CrmDeal]:
        stmt = select(CrmDeal).where(CrmDeal.id == deal_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_deal(session: AsyncSession, data: CrmDealCreate) -> CrmDeal:
        deal_code = data.deal_code
        if not deal_code:
            count_res = await session.execute(select(func.count(CrmDeal.id)))
            current_count = (count_res.scalar() or 0) + 1
            deal_code = f"DL-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        # Stage to probability mapping
        prob_map = {
            "DISCOVERY": 25,
            "PROPOSAL": 50,
            "NEGOTIATION": 75,
            "CLOSED_WON": 100,
            "CLOSED_LOST": 0,
        }
        stage_upper = data.stage.upper()
        prob = prob_map.get(stage_upper, data.probability)

        ai_win = prob
        ai_risks = "Timeline slip or budget freeze." if prob < 50 else "Standard closing conditions."
        ai_recs = "Schedule solution presentation and clarify decision maker." if prob < 60 else "Finalize contract terms and confirm payment schedule."

        deal = CrmDeal(
            deal_code=deal_code,
            title=data.title.strip(),
            customer_name=data.customer_name.strip(),
            amount=data.amount,
            stage=stage_upper,
            probability=prob,
            expected_close_date=data.expected_close_date,
            assigned_to_name=data.assigned_to_name,
            ai_win_probability=data.ai_win_probability or ai_win,
            ai_deal_risks=data.ai_deal_risks or ai_risks,
            ai_deal_recommendations=data.ai_deal_recommendations or ai_recs,
            notes=data.notes,
        )
        session.add(deal)
        await session.commit()
        await session.refresh(deal)
        return deal

    @staticmethod
    async def update_deal(
        session: AsyncSession, deal_id: uuid.UUID, data: CrmDealUpdate
    ) -> CrmDeal:
        deal = await CrmService.get_deal(session, deal_id)
        if not deal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key == "stage":
                    setattr(deal, key, str(value).upper())
                else:
                    setattr(deal, key, value)

        await session.commit()
        await session.refresh(deal)
        return deal

    @staticmethod
    async def delete_deal(session: AsyncSession, deal_id: uuid.UUID) -> bool:
        deal = await CrmService.get_deal(session, deal_id)
        if not deal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
        await session.delete(deal)
        await session.commit()
        return True

    # -------------------------------------------------------------
    # 3. CUSTOMER 360 DIRECTORY
    # -------------------------------------------------------------
    @staticmethod
    async def list_customers(
        session: AsyncSession,
        search: Optional[str] = None,
        tier: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[CrmCustomer], int]:
        stmt = select(CrmCustomer)

        if tier and tier.upper() != "ALL":
            stmt = stmt.where(CrmCustomer.customer_tier == tier.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    CrmCustomer.customer_code.ilike(search_term),
                    CrmCustomer.name.ilike(search_term),
                    CrmCustomer.company_name.ilike(search_term),
                    CrmCustomer.phone.ilike(search_term),
                    CrmCustomer.email.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(CrmCustomer.total_spend)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_customer(session: AsyncSession, customer_id: uuid.UUID) -> Optional[CrmCustomer]:
        stmt = select(CrmCustomer).where(CrmCustomer.id == customer_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_customer(session: AsyncSession, data: CrmCustomerCreate) -> CrmCustomer:
        customer_code = data.customer_code
        if not customer_code:
            count_res = await session.execute(select(func.count(CrmCustomer.id)))
            current_count = (count_res.scalar() or 0) + 1
            customer_code = f"CUST-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        customer = CrmCustomer(
            customer_code=customer_code,
            name=data.name.strip(),
            company_name=data.company_name.strip() if data.company_name else None,
            email=data.email.strip() if data.email else None,
            phone=data.phone.strip(),
            industry=data.industry,
            address=data.address,
            total_spend=data.total_spend,
            status=data.status.upper(),
            customer_tier=data.customer_tier.upper(),
            notes=data.notes,
        )
        session.add(customer)
        await session.commit()
        await session.refresh(customer)
        return customer

    @staticmethod
    async def update_customer(
        session: AsyncSession, customer_id: uuid.UUID, data: CrmCustomerUpdate
    ) -> CrmCustomer:
        customer = await CrmService.get_customer(session, customer_id)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key in ["status", "customer_tier"]:
                    setattr(customer, key, str(value).upper())
                else:
                    setattr(customer, key, value)

        await session.commit()
        await session.refresh(customer)
        return customer

    @staticmethod
    async def delete_customer(session: AsyncSession, customer_id: uuid.UUID) -> bool:
        customer = await CrmService.get_customer(session, customer_id)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        await session.delete(customer)
        await session.commit()
        return True

    # -------------------------------------------------------------
    # 4. SUPPORT TICKETS & SLA
    # -------------------------------------------------------------
    @staticmethod
    async def list_tickets(
        session: AsyncSession,
        search: Optional[str] = None,
        ticket_status: Optional[str] = None,
        priority: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[CrmTicket], int]:
        stmt = select(CrmTicket)

        if ticket_status and ticket_status.upper() != "ALL":
            stmt = stmt.where(CrmTicket.status == ticket_status.upper())

        if priority and priority.upper() != "ALL":
            stmt = stmt.where(CrmTicket.priority == priority.upper())

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    CrmTicket.ticket_number.ilike(search_term),
                    CrmTicket.customer_name.ilike(search_term),
                    CrmTicket.subject.ilike(search_term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        stmt = stmt.order_by(desc(CrmTicket.created_at)).offset(skip).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def get_ticket(session: AsyncSession, ticket_id: uuid.UUID) -> Optional[CrmTicket]:
        stmt = select(CrmTicket).where(CrmTicket.id == ticket_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_ticket(session: AsyncSession, data: CrmTicketCreate) -> CrmTicket:
        ticket_number = data.ticket_number
        if not ticket_number:
            count_res = await session.execute(select(func.count(CrmTicket.id)))
            current_count = (count_res.scalar() or 0) + 1
            ticket_number = f"TCK-{datetime.now().strftime('%Y%m')}-{current_count:04d}"

        # Basic sentiment heuristic based on description
        desc_lower = data.description.lower()
        sentiment = "NEUTRAL"
        if any(w in desc_lower for w in ["angry", "unacceptable", "furious", "urgent", "immediately", "broken", "worst"]):
            sentiment = "ESCALATION_RISK"
        elif any(w in desc_lower for w in ["thank", "great", "appreciate", "helpful"]):
            sentiment = "POSITIVE"

        suggested_response = (
            f"Dear {data.customer_name},\n\n"
            f"Thank you for contacting Littad Support. We have received your ticket regarding '{data.subject}' (Ticket: {ticket_number}).\n"
            f"Our technical team is reviewing your report and will reach back out shortly.\n\n"
            f"Best regards,\nLittad Support Team"
        )

        ticket = CrmTicket(
            ticket_number=ticket_number,
            customer_name=data.customer_name.strip(),
            customer_email=data.customer_email,
            customer_phone=data.customer_phone,
            subject=data.subject.strip(),
            description=data.description.strip(),
            priority=data.priority.upper(),
            status=data.status.upper(),
            assigned_agent_name=data.assigned_agent_name,
            sla_due_date=data.sla_due_date,
            ai_sentiment=sentiment,
            ai_suggested_response=suggested_response,
            resolution_notes=data.resolution_notes,
        )
        session.add(ticket)
        await session.commit()
        await session.refresh(ticket)
        return ticket

    @staticmethod
    async def update_ticket(
        session: AsyncSession, ticket_id: uuid.UUID, data: CrmTicketUpdate
    ) -> CrmTicket:
        ticket = await CrmService.get_ticket(session, ticket_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            if value is not None:
                if key in ["status", "priority", "ai_sentiment"]:
                    setattr(ticket, key, str(value).upper())
                else:
                    setattr(ticket, key, value)

        await session.commit()
        await session.refresh(ticket)
        return ticket

    @staticmethod
    async def delete_ticket(session: AsyncSession, ticket_id: uuid.UUID) -> bool:
        ticket = await CrmService.get_ticket(session, ticket_id)
        if not ticket:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        await session.delete(ticket)
        await session.commit()
        return True

    # -------------------------------------------------------------
    # 5. CRM DASHBOARD STATS
    # -------------------------------------------------------------
    @staticmethod
    async def get_dashboard_stats(session: AsyncSession) -> CrmDashboardStats:
        # Total leads
        total_leads_res = await session.execute(select(func.count(CrmLead.id)))
        total_leads = total_leads_res.scalar() or 0

        # Qualified leads
        qual_leads_res = await session.execute(
            select(func.count(CrmLead.id)).where(
                CrmLead.status.in_(["QUALIFIED", "PROPOSAL_SENT", "CONVERTED"])
            )
        )
        qualified_leads = qual_leads_res.scalar() or 0

        # Average AI Score
        avg_score_res = await session.execute(select(func.avg(CrmLead.ai_score)))
        avg_score = float(avg_score_res.scalar() or 50.0)

        # Open pipeline value
        pipeline_res = await session.execute(
            select(func.sum(CrmDeal.amount)).where(
                CrmDeal.stage.in_(["DISCOVERY", "PROPOSAL", "NEGOTIATION"])
            )
        )
        open_pipeline_value = float(pipeline_res.scalar() or 0.0)

        # Total deals count
        total_deals_res = await session.execute(select(func.count(CrmDeal.id)))
        total_deals_count = total_deals_res.scalar() or 0

        # Won deals count
        won_deals_res = await session.execute(
            select(func.count(CrmDeal.id)).where(CrmDeal.stage == "CLOSED_WON")
        )
        won_deals_count = won_deals_res.scalar() or 0

        # Total customers
        cust_res = await session.execute(select(func.count(CrmCustomer.id)))
        total_customers = cust_res.scalar() or 0

        # Open tickets
        tickets_res = await session.execute(
            select(func.count(CrmTicket.id)).where(
                CrmTicket.status.in_(["OPEN", "IN_PROGRESS", "PENDING_CUSTOMER"])
            )
        )
        open_tickets = tickets_res.scalar() or 0

        return CrmDashboardStats(
            total_leads=total_leads,
            qualified_leads=qualified_leads,
            open_pipeline_value=open_pipeline_value,
            total_deals_count=total_deals_count,
            won_deals_count=won_deals_count,
            total_customers=total_customers,
            open_tickets=open_tickets,
            avg_ai_lead_score=round(avg_score, 1),
        )
