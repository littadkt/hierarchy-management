from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.purchase_request import PurchaseRequestStatus
from app.models.user import User
from app.schemas.purchase_request import (
    PurchaseRequestCreate,
    PurchaseRequestHistoryOut,
    PurchaseRequestOut,
    PurchaseRequestStatusUpdate,
    PurchaseRequestUpdate,
)
from app.schemas.user import UserBrief
from app.services.purchase_service import PurchaseService

router = APIRouter()


class AssignPurchaseManagerRequest(BaseModel):
    user_id: uuid.UUID


class PurchaseRequestListResponse(BaseModel):
    items: List[PurchaseRequestOut]
    total: int
    skip: int
    limit: int


@router.get("/manager", response_model=Optional[UserBrief])
async def get_current_purchase_manager(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Get the currently designated Purchase Manager (an In-Charge user)"""
    return await PurchaseService.get_active_purchase_manager(session)


@router.get("/my-manager", response_model=Optional[UserBrief])
async def get_my_purchase_manager(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Get the default purchase manager for the current user:
    - For Staff: returns their assigned Team Leader.
    - For other roles (Team Leader, In-Charge, Admin, Super Admin): returns None (self-managed).
    """
    return await PurchaseService.get_default_purchase_manager_for_user(session, current_user)


@router.get("/in-charges", response_model=List[UserBrief])
async def get_in_charge_candidates(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List all In-Charge users so Super Admin can pick and assign as Purchase Manager"""
    return await PurchaseService.get_in_charge_users(session)


@router.get("/managers", response_model=List[UserBrief])
async def get_all_purchase_managers(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    List all PM / TL users (Team Leaders, In-Charges, Purchase Managers)
    available for filtering or assignment in Purchase Desk.
    """
    return await PurchaseService.get_all_purchase_managers(session)


@router.post("/assign-manager", response_model=UserBrief)
async def assign_purchase_manager(
    body: AssignPurchaseManagerRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Super Admin Provision:
    Pick an In-Charge user and assign him/her as Purchase Manager.
    """
    return await PurchaseService.assign_purchase_manager(
        session=session,
        operator=current_user,
        incharge_user_id=body.user_id,
    )


@router.post("", response_model=PurchaseRequestOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PurchaseRequestOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_purchase_request(
    request_in: PurchaseRequestCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    All user types provision:
    Scan barcode (or input code), fetch or enter product details,
    and submit request with quantity to the Purchase Manager.
    """
    return await PurchaseService.create_purchase_request(
        session=session,
        requester=current_user,
        request_in=request_in,
    )


@router.get("", response_model=PurchaseRequestListResponse)
@router.get("/", response_model=PurchaseRequestListResponse, include_in_schema=False)
async def list_purchase_requests(
    status: Optional[PurchaseRequestStatus] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = Query(None, description="Sort field: 'user', 'managed_by', 'date', 'total', 'name'"),
    order: Optional[str] = Query("desc", description="Sort direction: 'asc' or 'desc'"),
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    pm_filter: Optional[str] = Query(None, description="Filter: 'PM_MANAGED', 'SELF_MANAGED', or PM UUID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    List purchase requests:
    - Super Admin & Admin: See all purchase requests.
    - Purchase Manager: Sees all purchase requests.
    - Other users: See their own submitted purchase requests.
    Supports sorting by users, date, and total value, as well as filtering by date and PM.
    """
    requests, total = await PurchaseService.list_purchase_requests(
        session=session,
        current_user=current_user,
        status_filter=status,
        search=search,
        sort_by=sort_by,
        order=order,
        date_filter=date,
        pm_filter=pm_filter,
        skip=skip,
        limit=limit,
    )
    return {
        "items": requests,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{request_id}", response_model=PurchaseRequestOut)
async def get_purchase_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await PurchaseService.get_by_id(session, request_id)


@router.put("/{request_id}", response_model=PurchaseRequestOut)
async def update_purchase_request(
    request_id: uuid.UUID,
    req_in: PurchaseRequestUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Edit purchase request details"""
    return await PurchaseService.update_purchase_request(
        session=session,
        operator=current_user,
        request_id=request_id,
        req_in=req_in,
    )


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_purchase_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete purchase request"""
    await PurchaseService.delete_purchase_request(
        session=session,
        operator=current_user,
        request_id=request_id,
    )


@router.patch("/{request_id}/status", response_model=PurchaseRequestOut)
async def update_purchase_request_status(
    request_id: uuid.UUID,
    status_update: PurchaseRequestStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Purchase Manager provision:
    Mark status as 'ORDERED', 'OPEN' (default), 'NOT_IN_STOCK', or 'RECEIVED' (complete).
    """
    return await PurchaseService.update_status(
        session=session,
        operator=current_user,
        request_id=request_id,
        status_update=status_update,
    )


@router.get("/{request_id}/history", response_model=List[PurchaseRequestHistoryOut])
async def get_purchase_request_history(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    View all status transitions and history of purchase requests:
    Shown to Super Admin, Admin, Purchase Manager, and Requester.
    """
    return await PurchaseService.get_history(
        session=session,
        operator=current_user,
        request_id=request_id,
    )

