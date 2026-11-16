import re
import uuid
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CrmCustomer, CrmDeal, CrmLead, CrmTicket
from app.schemas.crm import (
    CrmAiChatResponse,
    CrmAiDealAnalyzeResponse,
    CrmAiDraftRequest,
    CrmAiDraftResponse,
    CrmAiLeadAnalyzeResponse,
)


class CrmAiService:
    # -------------------------------------------------------------
    # 1. AI LEAD QUALIFICATION & SCORING
    # -------------------------------------------------------------
    @staticmethod
    async def analyze_lead(session: AsyncSession, lead_id: uuid.UUID) -> CrmAiLeadAnalyzeResponse:
        stmt = select(CrmLead).where(CrmLead.id == lead_id)
        result = await session.execute(stmt)
        lead = result.scalar_one_or_none()
        if not lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

        # Heuristic scoring engine
        score = 40

        # Company presence
        if lead.company_name and len(lead.company_name.strip()) > 2:
            score += 20
        # Valid email
        if lead.email and "@" in lead.email and "." in lead.email:
            score += 10
        # Phone
        if lead.phone and len(lead.phone.strip()) >= 8:
            score += 10

        # Estimated value weighting
        if lead.estimated_value >= 100000:
            score += 20
        elif lead.estimated_value >= 25000:
            score += 15
        elif lead.estimated_value >= 5000:
            score += 10

        # Source weighting
        if lead.source in ["REFERRAL", "PARTNER"]:
            score += 15
        elif lead.source in ["EXHIBITION", "WEBSITE"]:
            score += 10
        elif lead.source == "COLD_CALL":
            score += 5

        # Status progression
        if lead.status in ["QUALIFIED", "PROPOSAL_SENT"]:
            score += 15

        ai_score = min(98, max(25, score))

        if ai_score >= 80:
            tier = "High Priority (Hot Lead)"
            summary = (
                f"Exceptional buying intent detected for {lead.full_name} from {lead.company_name or 'Independent'}. "
                f"Budget estimated at ₹{lead.estimated_value:,.2f} via {lead.source} channel. Profile demonstrates strong fit."
            )
            rec = "Urgent: Assign senior account manager to initiate solution demonstration within 4 hours. Present customized ROI model."
        elif ai_score >= 60:
            tier = "Warm Prospect"
            summary = (
                f"Moderate engagement from {lead.full_name}. Verified contact channels and budget indicator (₹{lead.estimated_value:,.2f}). "
                f"Source: {lead.source}."
            )
            rec = "Send product catalog, schedule discovery meeting, and qualify specific technical requirements."
        else:
            tier = "Nurture Prospect"
            summary = f"Early stage inquiry from {lead.full_name}. Basic contact recorded but missing detailed requirements."
            rec = "Enroll in automated email sequence and verify decision maker credentials before committing field reps."

        # Update lead in DB
        lead.ai_score = ai_score
        lead.ai_qualification_summary = f"[{tier}] {summary}"
        lead.ai_recommended_action = rec
        await session.commit()
        await session.refresh(lead)

        return CrmAiLeadAnalyzeResponse(
            lead_id=lead.id,
            lead_code=lead.lead_code,
            ai_score=ai_score,
            ai_qualification_summary=f"[{tier}] {summary}",
            ai_recommended_action=rec,
        )

    # -------------------------------------------------------------
    # 2. AI DEAL WIN PREDICTOR
    # -------------------------------------------------------------
    @staticmethod
    async def analyze_deal(session: AsyncSession, deal_id: uuid.UUID) -> CrmAiDealAnalyzeResponse:
        stmt = select(CrmDeal).where(CrmDeal.id == deal_id)
        result = await session.execute(stmt)
        deal = result.scalar_one_or_none()
        if not deal:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

        stage_weights = {
            "DISCOVERY": 25,
            "PROPOSAL": 55,
            "NEGOTIATION": 80,
            "CLOSED_WON": 100,
            "CLOSED_LOST": 0,
        }
        base_win = stage_weights.get(deal.stage, deal.probability)

        # Modifiers based on amount & closing timeline
        if deal.amount > 500000:
            # Larger deals have slightly higher procurement governance friction
            win_prob = max(15, base_win - 5)
            risks = "Executive board sign-off required; possible timeline slippage due to procurement committees."
            recs = "Engage CFO / Head of Finance with cost-benefit analysis and risk mitigation warranty guarantees."
        elif deal.amount > 50000:
            win_prob = min(95, base_win + 5)
            risks = "Competitor pricing pressure or internal resource reallocation."
            recs = "Offer milestone-based payment structure and lock in closing date with a limited-time incentive."
        else:
            win_prob = base_win
            risks = "Low ticket deal; customer attention may wander without prompt follow-up."
            recs = "Promptly dispatch standard agreement and provide expedited onboarding support."

        if deal.stage == "CLOSED_WON":
            win_prob = 100
            risks = "None (Deal closed won)."
            recs = "Initiate implementation kickoff and hand over to customer success."
        elif deal.stage == "CLOSED_LOST":
            win_prob = 0
            risks = "Deal lost."
            recs = "Schedule post-mortem debrief with client; set revisit reminder for 6 months."

        deal.ai_win_probability = win_prob
        deal.ai_deal_risks = risks
        deal.ai_deal_recommendations = recs
        await session.commit()
        await session.refresh(deal)

        return CrmAiDealAnalyzeResponse(
            deal_id=deal.id,
            deal_code=deal.deal_code,
            ai_win_probability=win_prob,
            ai_deal_risks=risks,
            ai_deal_recommendations=recs,
        )

    # -------------------------------------------------------------
    # 3. AI RESPONSE & PROPOSAL DRAFTER
    # -------------------------------------------------------------
    @staticmethod
    async def draft_content(data: CrmAiDraftRequest) -> CrmAiDraftResponse:
        ctype = data.context_type.lower()
        rec_name = data.recipient_name or "Valued Client"
        topic = data.topic_or_subject or "Littad Business Solutions"
        extra = data.additional_context or "General business alignment."

        if "ticket" in ctype or "support" in ctype:
            subject = f"Re: {topic} - Littad Support Resolution"
            content = (
                f"Dear {rec_name},\n\n"
                f"Thank you for contacting Littad Customer Support regarding {topic}.\n\n"
                f"We understand the critical importance of keeping your operations running smoothly without interruption. "
                f"Our engineering and support team has reviewed the details you provided:\n"
                f"• Reference: {extra}\n\n"
                f"We are actively applying the necessary resolution and will monitor the system closely. "
                f"Should you need immediate assistance or wish to provide additional details, please do not hesitate to reply to this thread.\n\n"
                f"Warm regards,\n"
                f"Littad Support & Customer Success Team\n"
                f"support@littad.com | +91 98765 43210"
            )
            cta = "Reply to this email or click to schedule a 10-minute diagnostic session."

        elif "pitch" in ctype or "sales" in ctype:
            subject = f"Accelerating {topic} for {rec_name} - Team Littad"
            content = (
                f"Dear {rec_name},\n\n"
                f"I hope this note finds you well.\n\n"
                f"At Littad, we help forward-thinking organizations streamline operations across ERP, customer lifecycle management, "
                f"and automated hierarchical approvals.\n\n"
                f"Given your focus on {topic}, our integrated platform provides:\n"
                f"1. Real-time workflow automation and inventory synchronicity\n"
                f"2. Built-in AI qualification and predictive analytics\n"
                f"3. Enterprise security and branch-level role governance\n\n"
                f"Context details: {extra}\n\n"
                f"Would you be open to a brief 15-minute walkthrough next Tuesday or Wednesday to see how this translates into measurable cost savings?\n\n"
                f"Best regards,\n"
                f"Sales & Partnerships Directorate\n"
                f"Team Littad"
            )
            cta = "Book a 15-minute introductory discovery session."

        else:  # Deal Proposal
            subject = f"Executive Proposal: {topic} - Littad Solutions"
            content = (
                f"EXECUTIVE SUMMARY & PROPOSAL\n\n"
                f"Prepared for: {rec_name}\n"
                f"Subject: {topic}\n"
                f"Date: {datetime.now().strftime('%B %d, %Y')}\n\n"
                f"1. Scope & Objective:\n"
                f"Team Littad proposes a unified deployment covering {topic}, designed to eliminate operational friction and enhance visibility across your organization.\n\n"
                f"2. Solution Architecture & Deliverables:\n"
                f"• Integrated Management System\n"
                f"• Role-based Access Control and Audit Compliance\n"
                f"• Dedicated Support SLA and Ongoing Account Management\n\n"
                f"Key Notes: {extra}\n\n"
                f"3. Next Steps:\n"
                f"Upon mutual review and acceptance of this proposal, our deployment team will initiate phase 1 provisioning within 3 business days.\n\n"
                f"Sincerely,\n"
                f"Littad Enterprise Solutions"
            )
            cta = "Sign proposal acceptance or request customized adjustments."

        return CrmAiDraftResponse(
            subject=subject,
            content=content,
            suggested_call_to_action=cta,
        )

    # -------------------------------------------------------------
    # 4. INTERACTIVE CRM AI COPILOT
    # -------------------------------------------------------------
    @staticmethod
    async def chat_copilot(session: AsyncSession, request_data: dict) -> CrmAiChatResponse:
        query = str(request_data.get("query", "")).strip().lower()

        # Fetch live database facts to provide high-quality context
        leads_res = await session.execute(
            select(CrmLead).order_by(desc(CrmLead.ai_score)).limit(5)
        )
        top_leads = list(leads_res.scalars().all())

        deals_res = await session.execute(
            select(CrmDeal).order_by(desc(CrmDeal.amount)).limit(5)
        )
        top_deals = list(deals_res.scalars().all())

        tickets_res = await session.execute(
            select(CrmTicket).where(CrmTicket.status.in_(["OPEN", "IN_PROGRESS"])).limit(5)
        )
        open_tickets = list(tickets_res.scalars().all())

        cust_count_res = await session.execute(select(func.count(CrmCustomer.id)))
        cust_count = cust_count_res.scalar() or 0

        links = []

        if any(w in query for w in ["lead", "prospect", "score"]):
            lead_summaries = "\n".join(
                [
                    f"• **{l.full_name}** ({l.company_name or 'N/A'}) - AI Score: **{l.ai_score}/100** | Budget: ₹{l.estimated_value:,.2f} | Status: `{l.status}`"
                    for l in top_leads
                ]
            )
            response = (
                f"### 🎯 CRM AI Lead Intelligence\n\n"
                f"Here are the top-ranked leads in your pipeline based on predictive AI scoring:\n\n"
                f"{lead_summaries or 'No active leads found in the system.'}\n\n"
                f"**Key Recommendation**: Prioritize leads with AI Score > 75 for direct executive follow-up and tailored product demonstrations."
            )
            links = [{"label": "View All Leads", "url": "/crm/leads"}]

        elif any(w in query for w in ["deal", "pipeline", "revenue", "opportunity"]):
            deal_summaries = "\n".join(
                [
                    f"• **{d.title}** ({d.customer_name}) - Value: **₹{d.amount:,.2f}** | Stage: `{d.stage}` | Win Prob: **{d.ai_win_probability}%**"
                    for d in top_deals
                ]
            )
            response = (
                f"### 💼 Deal Pipeline & Win Predictions\n\n"
                f"Here are the highest-value opportunities currently being pursued:\n\n"
                f"{deal_summaries or 'No active deals recorded.'}\n\n"
                f"**AI Strategy**: For deals in the `NEGOTIATION` stage, emphasize Littad's warranty and fast service turn-around to accelerate contract closure."
            )
            links = [{"label": "Open Deals Pipeline", "url": "/crm/deals"}]

        elif any(w in query for w in ["ticket", "support", "complaint", "sla"]):
            ticket_summaries = "\n".join(
                [
                    f"• **{t.ticket_number}**: {t.subject} ({t.customer_name}) - Priority: `{t.priority}` | Status: `{t.status}`"
                    for t in open_tickets
                ]
            )
            response = (
                f"### 🎫 Customer Support & SLA Status\n\n"
                f"You have **{len(open_tickets)}** open/in-progress support tickets requiring attention:\n\n"
                f"{ticket_summaries or 'All support tickets are currently resolved!'}\n\n"
                f"**Tip**: High priority tickets with an *Escalation Risk* flag should be reviewed by senior customer success engineers."
            )
            links = [{"label": "Manage Support Tickets", "url": "/crm/tickets"}]

        elif any(w in query for w in ["summary", "overview", "dashboard", "health"]):
            total_lead_count = (await session.execute(select(func.count(CrmLead.id)))).scalar() or 0
            pipeline_sum = (await session.execute(select(func.sum(CrmDeal.amount)))).scalar() or 0.0

            response = (
                f"### 📊 Littad CRM & Commercial Overview\n\n"
                f"• **Active Customers**: {cust_count} accounts\n"
                f"• **Total Tracked Leads**: {total_lead_count}\n"
                f"• **Total Pipeline Value**: ₹{pipeline_sum:,.2f}\n"
                f"• **Open Support Tickets**: {len(open_tickets)}\n\n"
                f"Overall commercial health is robust. Conversion momentum can be maximized by engaging high-scoring leads in the first 24 hours of inquiry."
            )
            links = [
                {"label": "CRM Dashboard", "url": "/crm"},
                {"label": "SAP ERP Suite", "url": "/sap"},
            ]

        else:
            response = (
                f"### 🤖 Littad CRM AI Assistant\n\n"
                f"I am your dedicated CRM & Sales intelligence agent. I can assist you with:\n\n"
                f"1. **Lead Scoring & Qualification**: Ask me *'Which leads are highest priority?'*\n"
                f"2. **Deal Pipeline Analytics**: Ask me *'Summarize our deals and win probabilities'*\n"
                f"3. **Customer Support Monitoring**: Ask me *'What support tickets are open?'*\n"
                f"4. **Smart Drafting**: Ask me *'Draft a sales pitch for enterprise clients'*\n\n"
                f"How would you like to accelerate your commercial workflows today?"
            )
            links = [
                {"label": "Leads", "url": "/crm/leads"},
                {"label": "Deals Pipeline", "url": "/crm/deals"},
                {"label": "Customer 360", "url": "/crm/customers"},
                {"label": "Support Tickets", "url": "/crm/tickets"},
            ]

        return CrmAiChatResponse(response=response, relevant_links=links)
