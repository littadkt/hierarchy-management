from datetime import datetime
from typing import Any, Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.attendance import (
    AttendanceOut,
    AttendanceReportResponse,
    AttendanceTodayStatus,
    CheckInRequest,
    CheckOutRequest,
)
from app.services.attendance_service import AttendanceService

router = APIRouter()


@router.get("/today", response_model=AttendanceTodayStatus)
async def get_today_status(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Get current user's attendance status and active session duration for today"""
    return await AttendanceService.get_today_status(session, current_user.id)


@router.post("/check-in", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
async def check_in(
    request: Request,
    payload: Optional[CheckInRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Record user check-in for today"""
    ip_addr = request.client.host if request.client else None
    note = payload.note if payload else None
    return await AttendanceService.check_in(
        session=session,
        user=current_user,
        note=note,
        ip_address=ip_addr,
    )


@router.post("/check-out", response_model=AttendanceOut)
async def check_out(
    payload: Optional[CheckOutRequest] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Record user check-out for today and calculate worked hours"""
    note = payload.note if payload else None
    return await AttendanceService.check_out(
        session=session,
        user=current_user,
        note=note,
    )


@router.get("/my-history", response_model=AttendanceReportResponse)
async def get_my_attendance_history(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """View personal attendance log"""
    return await AttendanceService.list_attendance_report(
        session=session,
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
    )


@router.get("/report", response_model=AttendanceReportResponse)
async def get_attendance_report(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    branch_id: Optional[uuid.UUID] = Query(None, description="Filter by Branch"),
    department: Optional[str] = Query(None, description="Filter by Department"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by User"),
    status: Optional[str] = Query(None, description="PRESENT, CHECKED_IN, HALF_DAY, LATE"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """View team/organization attendance report (scoped by role hierarchy)"""
    return await AttendanceService.list_attendance_report(
        session=session,
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        department=department,
        user_id=user_id,
        status_filter=status,
        skip=skip,
        limit=limit,
    )


@router.get("/export")
async def export_attendance_report(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    branch_id: Optional[uuid.UUID] = Query(None, description="Filter by Branch"),
    department: Optional[str] = Query(None, description="Filter by Department"),
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by User"),
    status: Optional[str] = Query(None, description="Filter by Status"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Download attendance report as a formatted Excel spreadsheet"""
    excel_bytes = await AttendanceService.export_excel_report(
        session=session,
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        branch_id=branch_id,
        department=department,
        user_id=user_id,
        status_filter=status,
    )
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"attendance_report_{timestamp}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
