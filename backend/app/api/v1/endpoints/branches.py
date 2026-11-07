from typing import Any, List
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import Role, User
from app.schemas.branch import BranchCreate, BranchOut, BranchUpdate
from app.services.branch_service import BranchService

router = APIRouter()


def require_branch_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins and Admins can manage branch locations.",
        )
    return current_user


@router.get("", response_model=List[BranchOut])
async def list_branches(
    active_only: bool = Query(False, description="Filter for active branches only"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List all registered branches (accessible by all authenticated users for dropdowns)."""
    return await BranchService.list_branches(session, active_only=active_only)


@router.post("", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_in: BranchCreate,
    current_user: User = Depends(require_branch_admin),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Create a new branch location."""
    return await BranchService.create_branch(session, branch_in)


@router.put("/{branch_id}", response_model=BranchOut)
@router.patch("/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: uuid.UUID,
    branch_in: BranchUpdate,
    current_user: User = Depends(require_branch_admin),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update branch details (name, code, city, address, active status)."""
    return await BranchService.update_branch(session, branch_id, branch_in)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: uuid.UUID,
    current_user: User = Depends(require_branch_admin),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a branch location if no users are currently assigned to it."""
    await BranchService.delete_branch(session, branch_id)
