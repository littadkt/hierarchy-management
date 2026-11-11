from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.warranty import WarrantyStatus
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
from app.services.warranty_service import WarrantyService

router = APIRouter()


# =============================================================================
# LOOKUP: SERVICE TYPES
# =============================================================================
@router.get("/service-types", response_model=List[WarrantyServiceTypeOut])
async def list_service_types(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.list_service_types(session, active_only=active_only)


@router.post("/service-types", response_model=WarrantyServiceTypeOut, status_code=status.HTTP_201_CREATED)
async def create_service_type(
    payload: WarrantyServiceTypeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.create_service_type(session, payload)


@router.put("/service-types/{type_id}", response_model=WarrantyServiceTypeOut)
async def update_service_type(
    type_id: uuid.UUID,
    payload: WarrantyServiceTypeUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.update_service_type(session, type_id, payload)


@router.delete("/service-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_type(
    type_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await WarrantyService.delete_service_type(session, type_id)


# =============================================================================
# LOOKUP: STAFF
# =============================================================================
@router.get("/staff", response_model=List[WarrantyStaffOut])
async def list_staff(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.list_staff(session, active_only=active_only)


@router.post("/staff", response_model=WarrantyStaffOut, status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: WarrantyStaffCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.create_staff(session, payload)


@router.put("/staff/{staff_id}", response_model=WarrantyStaffOut)
async def update_staff(
    staff_id: uuid.UUID,
    payload: WarrantyStaffUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.update_staff(session, staff_id, payload)


@router.delete("/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    staff_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await WarrantyService.delete_staff(session, staff_id)


# =============================================================================
# LOOKUP: BRANDS
# =============================================================================
@router.get("/brands", response_model=List[WarrantyBrandOut])
async def list_brands(
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.list_brands(session, active_only=active_only)


@router.post("/brands", response_model=WarrantyBrandOut, status_code=status.HTTP_201_CREATED)
async def create_brand(
    payload: WarrantyBrandCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.create_brand(session, payload)


@router.put("/brands/{brand_id}", response_model=WarrantyBrandOut)
async def update_brand(
    brand_id: uuid.UUID,
    payload: WarrantyBrandUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.update_brand(session, brand_id, payload)


@router.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(
    brand_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await WarrantyService.delete_brand(session, brand_id)


# =============================================================================
# LOOKUP: MODELS
# =============================================================================
@router.get("/models", response_model=List[WarrantyModelOut])
async def list_models(
    brand_id: Optional[uuid.UUID] = Query(None),
    active_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.list_models(session, brand_id=brand_id, active_only=active_only)


@router.post("/models", response_model=WarrantyModelOut, status_code=status.HTTP_201_CREATED)
async def create_model(
    payload: WarrantyModelCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.create_model(session, payload)


@router.put("/models/{model_id}", response_model=WarrantyModelOut)
async def update_model(
    model_id: uuid.UUID,
    payload: WarrantyModelUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.update_model(session, model_id, payload)


@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(
    model_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await WarrantyService.delete_model(session, model_id)


# =============================================================================
# WARRANTY JOBS & SERIAL NUMBER HISTORY
# =============================================================================
@router.get("/jobs/serial-history/{serial_number}", response_model=WarrantySerialHistory)
async def get_serial_history(
    serial_number: str,
    exclude_job_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Search past service records for a product serial number across all customers.
    """
    return await WarrantyService.get_serial_history(
        session, serial_number=serial_number, exclude_job_id=exclude_job_id
    )


@router.get("/jobs", response_model=WarrantyJobsListResponse)
async def list_warranty_jobs(
    search: Optional[str] = Query(None),
    status: Optional[WarrantyStatus] = Query(None),
    brand_id: Optional[uuid.UUID] = Query(None),
    staff_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    items, total, status_counts = await WarrantyService.list_jobs(
        session,
        search=search,
        status_filter=status,
        brand_id=brand_id,
        staff_id=staff_id,
        skip=skip,
        limit=limit,
    )
    return {
        "items": items,
        "total": total,
        "status_counts": status_counts,
    }


@router.post("/jobs", response_model=WarrantyJobOut, status_code=status.HTTP_201_CREATED)
async def register_warranty_job(
    payload: WarrantyJobCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Register a new warranty job"""
    return await WarrantyService.create_job(session, current_user, payload)


@router.get("/jobs/{job_id}", response_model=WarrantyJobOut)
async def get_warranty_job(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.get_job(session, job_id)


@router.put("/jobs/{job_id}", response_model=WarrantyJobOut)
async def update_warranty_job(
    job_id: uuid.UUID,
    payload: WarrantyJobUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.update_job(session, current_user, job_id, payload)


@router.patch("/jobs/{job_id}/status", response_model=WarrantyJobOut)
async def update_warranty_job_status(
    job_id: uuid.UUID,
    payload: WarrantyJobStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    return await WarrantyService.update_job_status(
        session, current_user, job_id, payload.status, notes=payload.notes
    )


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warranty_job(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await WarrantyService.delete_job(session, current_user, job_id)
