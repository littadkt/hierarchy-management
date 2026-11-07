from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import Role, User
from app.schemas.department import DepartmentCreate, DepartmentOut, DepartmentUpdate
from app.services.department_service import DepartmentService

router = APIRouter()


def require_department_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can manage departments.",
        )
    return current_user


@router.get("", response_model=List[DepartmentOut])
async def list_departments(
    active_only: bool = Query(False, description="Filter for active departments only"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List all registered departments (accessible by all authenticated users for dropdowns)."""
    return await DepartmentService.list_departments(session, active_only=active_only)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    department_in: DepartmentCreate,
    current_user: User = Depends(require_department_admin),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new department."""
    return await DepartmentService.create_department(session, department_in)


@router.put("/{department_id}", response_model=DepartmentOut)
@router.patch("/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: uuid.UUID,
    department_in: DepartmentUpdate,
    current_user: User = Depends(require_department_admin),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update department details (name, code, description, active status)."""
    return await DepartmentService.update_department(session, department_id, department_in)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: uuid.UUID,
    current_user: User = Depends(require_department_admin),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a department if no users are currently assigned to it."""
    await DepartmentService.delete_department(session, department_id)

