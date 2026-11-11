from datetime import datetime, timezone
import io
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.broadcaster import broadcaster
from app.models.attendance import Attendance, AttendanceStatus
from app.models.branch import Branch
from app.models.user import Role, User
from app.schemas.attendance import (
    AttendanceOut,
    AttendanceReportResponse,
    AttendanceReportSummary,
    AttendanceTodayStatus,
)


class AttendanceService:
    @staticmethod
    def get_today_date_str() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    @staticmethod
    async def get_today_status(
        session: AsyncSession, user_id: uuid.UUID
    ) -> AttendanceTodayStatus:
        today = AttendanceService.get_today_date_str()
        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user))
            .where(Attendance.user_id == user_id, Attendance.date == today)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()

        if not record:
            return AttendanceTodayStatus(
                is_checked_in=False,
                is_checked_out=False,
                record=None,
                worked_seconds=0,
            )

        now = datetime.now(timezone.utc)
        if record.check_out_time:
            worked = int((record.check_out_time - record.check_in_time).total_seconds())
        else:
            worked = max(0, int((now - record.check_in_time).total_seconds()))

        return AttendanceTodayStatus(
            is_checked_in=True,
            is_checked_out=record.check_out_time is not None,
            record=AttendanceOut.model_validate(record),
            worked_seconds=worked,
        )

    @staticmethod
    async def check_in(
        session: AsyncSession,
        user: User,
        note: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Attendance:
        today = AttendanceService.get_today_date_str()
        now = datetime.now(timezone.utc)

        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user))
            .where(Attendance.user_id == user.id, Attendance.date == today)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()

        if record:
            if record.check_out_time is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"You are already checked in today at {record.check_in_time.strftime('%I:%M %p UTC')}.",
                )
            # Re-opening / Resuming attendance session
            record.check_out_time = None
            record.status = AttendanceStatus.CHECKED_IN
            if note:
                record.check_in_note = (
                    f"{record.check_in_note} | Resumed: {note.strip()}"
                    if record.check_in_note
                    else note.strip()
                )
            record.updated_at = now
            await session.commit()
            await session.refresh(record)
        else:
            record = Attendance(
                user_id=user.id,
                date=today,
                check_in_time=now,
                check_out_time=None,
                total_hours=0.0,
                status=AttendanceStatus.CHECKED_IN,
                check_in_note=note.strip() if note else None,
                ip_address=ip_address,
            )
            session.add(record)

            # Keep login tracking fields updated for user
            user.last_login_at = now
            if user.today_first_login_date != today:
                user.today_first_login_date = today
                user.today_first_login_at = now

            await session.commit()
            await session.refresh(record)

        # Broadcast real-time event
        await broadcaster.broadcast(
            "ATTENDANCE_UPDATED",
            {
                "action": "CHECK_IN",
                "user_id": str(user.id),
                "user_name": user.full_name,
                "date": record.date,
                "check_in_time": record.check_in_time.isoformat(),
            },
        )
        return record

    @staticmethod
    async def check_out(
        session: AsyncSession,
        user: User,
        note: Optional[str] = None,
    ) -> Attendance:
        today = AttendanceService.get_today_date_str()
        now = datetime.now(timezone.utc)

        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user))
            .where(Attendance.user_id == user.id, Attendance.date == today)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()

        if not record or record.check_out_time is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active check-in session found for today. Please check in first.",
            )

        record.check_out_time = now
        duration_seconds = max(0.0, (now - record.check_in_time).total_seconds())
        total_hours = round(duration_seconds / 3600.0, 2)
        record.total_hours = total_hours

        # Mark half-day if less than 4 hours worked, otherwise present
        if total_hours < 4.0:
            record.status = AttendanceStatus.HALF_DAY
        else:
            record.status = AttendanceStatus.PRESENT

        if note:
            record.check_out_note = note.strip()
        record.updated_at = now

        await session.commit()
        await session.refresh(record)

        # Broadcast real-time event
        await broadcaster.broadcast(
            "ATTENDANCE_UPDATED",
            {
                "action": "CHECK_OUT",
                "user_id": str(user.id),
                "user_name": user.full_name,
                "date": record.date,
                "check_out_time": record.check_out_time.isoformat(),
                "total_hours": record.total_hours,
                "status": record.status.value,
            },
        )
        return record

    @staticmethod
    def _apply_role_filters(query, current_user: User):
        """Scope query according to organizational hierarchy roles"""
        if current_user.role == Role.SUPER_ADMIN:
            return query
        elif current_user.role == Role.ADMIN:
            if current_user.branch:
                return query.where(
                    or_(
                        User.branch == current_user.branch,
                        User.id == current_user.id,
                    )
                )
            return query
        elif current_user.role == Role.IN_CHARGE:
            return query.where(
                or_(
                    User.id == current_user.id,
                    and_(
                        User.branch == current_user.branch,
                        User.department == current_user.department,
                    ),
                    User.reports_to_id == current_user.id,
                )
            )
        elif current_user.role == Role.TEAM_LEADER:
            return query.where(
                or_(
                    User.id == current_user.id,
                    User.reports_to_id == current_user.id,
                )
            )
        else:  # STAFF
            return query.where(Attendance.user_id == current_user.id)

    @staticmethod
    async def list_attendance_report(
        session: AsyncSession,
        current_user: User,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        branch_id: Optional[uuid.UUID] = None,
        department: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> AttendanceReportResponse:
        base_query = (
            select(Attendance)
            .join(User, Attendance.user_id == User.id)
            .options(selectinload(Attendance.user))
        )
        base_query = AttendanceService._apply_role_filters(base_query, current_user)

        # Filters
        if start_date:
            base_query = base_query.where(Attendance.date >= start_date)
        if end_date:
            base_query = base_query.where(Attendance.date <= end_date)
        if user_id:
            base_query = base_query.where(Attendance.user_id == user_id)
        if status_filter:
            base_query = base_query.where(Attendance.status == status_filter)
        if department:
            base_query = base_query.where(User.department.ilike(f"%{department.strip()}%"))
        if branch_id:
            b_stmt = select(Branch.name).where(Branch.id == branch_id)
            b_name = (await session.execute(b_stmt)).scalar_one_or_none()
            if b_name:
                base_query = base_query.where(User.branch.ilike(b_name.strip()))

        # Calculate KPI summary from full matching dataset
        subq = base_query.subquery()
        summary_stmt = select(
            func.count(subq.c.id).label("total_records"),
            func.coalesce(func.sum(subq.c.total_hours), 0.0).label("total_hours"),
            func.count(subq.c.id).filter(subq.c.check_out_time.is_(None)).label("currently_checked_in"),
            func.count(subq.c.id).filter(subq.c.status == AttendanceStatus.PRESENT).label("present_count"),
            func.count(subq.c.id).filter(subq.c.status == AttendanceStatus.HALF_DAY).label("half_day_count"),
        ).select_from(subq)

        sum_res = (await session.execute(summary_stmt)).one()
        tot_records = sum_res.total_records or 0
        tot_hours = round(float(sum_res.total_hours or 0.0), 2)
        avg_hours = round(tot_hours / tot_records, 2) if tot_records > 0 else 0.0

        summary = AttendanceReportSummary(
            total_records=tot_records,
            total_hours=tot_hours,
            average_hours_per_day=avg_hours,
            currently_checked_in=sum_res.currently_checked_in or 0,
            present_count=sum_res.present_count or 0,
            half_day_count=sum_res.half_day_count or 0,
        )

        # Order & Paginate
        paginated_stmt = (
            base_query.order_by(desc(Attendance.date), desc(Attendance.check_in_time))
            .offset(skip)
            .limit(limit)
        )
        records = (await session.execute(paginated_stmt)).scalars().all()

        return AttendanceReportResponse(
            items=[AttendanceOut.model_validate(r) for r in records],
            total=tot_records,
            skip=skip,
            limit=limit,
            summary=summary,
        )

    @staticmethod
    async def export_excel_report(
        session: AsyncSession,
        current_user: User,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        branch_id: Optional[uuid.UUID] = None,
        department: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
    ) -> bytes:
        base_query = (
            select(Attendance)
            .join(User, Attendance.user_id == User.id)
            .options(selectinload(Attendance.user))
        )
        base_query = AttendanceService._apply_role_filters(base_query, current_user)

        if start_date:
            base_query = base_query.where(Attendance.date >= start_date)
        if end_date:
            base_query = base_query.where(Attendance.date <= end_date)
        if user_id:
            base_query = base_query.where(Attendance.user_id == user_id)
        if status_filter:
            base_query = base_query.where(Attendance.status == status_filter)
        if department:
            base_query = base_query.where(User.department.ilike(f"%{department.strip()}%"))
        if branch_id:
            b_stmt = select(Branch.name).where(Branch.id == branch_id)
            b_name = (await session.execute(b_stmt)).scalar_one_or_none()
            if b_name:
                base_query = base_query.where(User.branch.ilike(b_name.strip()))

        stmt = base_query.order_by(desc(Attendance.date), desc(Attendance.check_in_time)).limit(5000)
        records = (await session.execute(stmt)).scalars().all()

        wb = Workbook()
        ws = wb.active
        ws.title = "Attendance Report"

        headers = [
            "Date",
            "Employee Name",
            "Email",
            "Role",
            "Branch",
            "Department",
            "Check-In Time",
            "Check-Out Time",
            "Hours Worked",
            "Status",
            "Notes",
        ]
        ws.append(headers)

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0"),
        )

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        total_hours_sum = 0.0

        for r_idx, att in enumerate(records, start=2):
            u = att.user
            in_str = att.check_in_time.strftime("%I:%M %p") if att.check_in_time else "—"
            out_str = att.check_out_time.strftime("%I:%M %p") if att.check_out_time else "Currently Active"
            notes = " | ".join(filter(None, [att.check_in_note, att.check_out_note])) or "—"
            total_hours_sum += att.total_hours

            row_data = [
                att.date,
                u.full_name if u else "—",
                u.email if u else "—",
                u.role.value if u and u.role else "—",
                u.branch if u and u.branch else "—",
                u.department if u and u.department else "—",
                in_str,
                out_str,
                att.total_hours,
                att.status.value,
                notes,
            ]
            ws.append(row_data)

            for c_idx in range(1, len(row_data) + 1):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.border = thin_border
                cell.alignment = left_align

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        out_io = io.BytesIO()
        wb.save(out_io)
        out_io.seek(0)
        return out_io.getvalue()
