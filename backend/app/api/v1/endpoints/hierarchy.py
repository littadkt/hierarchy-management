from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import Role, User
from app.schemas.user import UserWithStats
from app.services.user_service import UserService

router = APIRouter()


class HierarchyNode(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: Role
    branch: Optional[str] = None
    department: Optional[str] = None
    task_counts: Dict[str, int]
    subordinates: List["HierarchyNode"] = []


@router.get("/overview", response_model=List[UserWithStats])
async def get_hierarchy_overview(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Super Admin Provision:
    'View all admins, in-charge team leaders and staff with their task details'
    Also accessible by Admin / In-charge / Team Leader for their respective subordinate trees.
    """
    return await UserService.get_hierarchy_users_with_task_stats(session, current_user)


@router.get("/tree")
async def get_hierarchy_tree(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Returns organizational tree starting from root users down to staff"""
    users_with_stats = await UserService.get_hierarchy_users_with_task_stats(session, current_user)

    # Build node map
    node_map = {}
    for u in users_with_stats:
        node_map[u.id] = {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "branch": u.branch,
            "department": u.department,
            "reports_to_id": u.reports_to_id,
            "task_stats": u.task_stats.model_dump(),
            "is_on_leave": u.is_on_leave,
            "leave_date": u.leave_date,
            "leave_reason": u.leave_reason,
            "subordinates": [],
        }

    roots = []
    for u in users_with_stats:
        node = node_map[u.id]
        if u.reports_to_id and u.reports_to_id in node_map and u.reports_to_id != u.id:
            node_map[u.reports_to_id]["subordinates"].append(node)
        else:
            roots.append(node)

    return roots

