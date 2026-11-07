from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.task import TaskPriority, TaskStatus
from app.models.user import User
from app.schemas.activity import ActivityOut, CommentCreate, CommentOut
from app.schemas.subtask import SubtaskCreate, SubtaskOut, SubtaskToggle, SubtaskUpdate
from app.schemas.task import BulkDeleteTasks, TaskCreate, TaskDetailOut, TaskOut, TaskStatusUpdate, TaskUpdate
from app.services.subtask_service import SubtaskService
from app.services.task_service import TaskService

router = APIRouter()


class TaskListResponse(BaseModel):
    items: List[TaskOut]
    total: int
    skip: int
    limit: int


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_task(
    task_in: TaskCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a task (recurring or non-recurring):
    - Checkbox to mark if needs higher level approval + designated approver
    - Allowed assignees based on role:
      - Super Admin: anyone
      - Admin: In-charge, Team Leader, Staff, Self
      - In-charge: Team Leader, Staff, Self
      - Team Leader: Staff, Self
      - Staff: Self only
    """
    return await TaskService.create_task(session, current_user, task_in)


@router.get("", response_model=TaskListResponse)
@router.get("/", response_model=TaskListResponse, include_in_schema=False)
async def list_tasks(
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    assigned_to_id: Optional[uuid.UUID] = None,
    created_by_id: Optional[uuid.UUID] = None,
    is_recurring: Optional[bool] = None,
    requires_approval: Optional[bool] = None,
    search: Optional[str] = None,
    due_date_scope: Optional[str] = Query(None, description="Scope tasks by due date: 'today', 'upcoming', 'overdue'"),
    user_scope: Optional[str] = Query(None, description="Filter tasks by user scope: 'me', 'subordinates', or 'all'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List tasks scoped to user's hierarchical permissions"""
    tasks, total = await TaskService.list_tasks(
        session=session,
        current_user=current_user,
        status_filter=status,
        priority_filter=priority,
        assigned_to_id=assigned_to_id,
        created_by_id=created_by_id,
        is_recurring=is_recurring,
        requires_approval=requires_approval,
        search=search,
        due_date_scope=due_date_scope,
        user_scope=user_scope,
        skip=skip,
        limit=limit,
    )
    return {
        "items": tasks,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{task_id}", response_model=TaskDetailOut)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Get single task details with comments and activity counts"""
    task = await TaskService.get_by_id(session, task_id, current_user=current_user)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return task


@router.put("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    task_in: TaskUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update task details adhering to role restrictions:
    - Super Admin: All tasks
    - Admin: Team Leader's tasks, Staff tasks, own tasks. CANNOT edit In-charge's tasks.
    - In-charge: Staff tasks, own tasks. CANNOT edit Team Leader's tasks.
    - Team Leader: Own tasks. CANNOT edit Staff tasks.
    - Staff: Restricted from updating other tasks.
    """
    return await TaskService.update_task(session, current_user, task_id, task_in)


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_tasks(
    payload: BulkDeleteTasks,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Bulk delete multiple tasks conforming to user hierarchy/creator permissions.
    """
    deleted = await TaskService.bulk_delete_tasks(session, current_user, payload.task_ids)
    return {"deleted_count": deleted}


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete task adhering to role restrictions:
    - Admin CANNOT delete In-charge's tasks
    - In-charge CANNOT delete Team Leader's tasks
    - Team Leader CANNOT delete Staff's tasks
    """
    await TaskService.delete_task(session, current_user, task_id)


@router.patch("/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: uuid.UUID,
    status_update: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update task status.
    RESTRICTION: If the task requires higher-level approval, non-approvers CANNOT
    update status to 'COMPLETED'. They must submit the task for approval instead.
    """
    return await TaskService.update_task_status(session, current_user, task_id, status_update)


@router.post("/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def add_task_comment(
    task_id: uuid.UUID,
    comment_in: CommentCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Add a discussion or review comment to a task"""
    return await TaskService.add_comment(session, current_user, task_id, comment_in.content)


@router.get("/{task_id}/comments", response_model=List[CommentOut])
async def get_task_comments(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Get all comments on a task"""
    return await TaskService.get_comments(session, current_user, task_id)


@router.get("/{task_id}/activities", response_model=List[ActivityOut])
async def get_task_activities(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Get full audit log of all changes, approvals, and status transitions on a task"""
    return await TaskService.get_activities(session, current_user, task_id)


# --- Subtask Endpoints ---
@router.get("/{task_id}/subtasks", response_model=List[SubtaskOut])
async def list_subtasks(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """List all subtasks under a task"""
    return await SubtaskService.list_subtasks(session, current_user, task_id)


@router.post(
    "/{task_id}/subtasks",
    response_model=SubtaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_subtask(
    task_id: uuid.UUID,
    subtask_in: SubtaskCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Add a new subtask under a task"""
    return await SubtaskService.create_subtask(session, current_user, task_id, subtask_in)


@router.put("/{task_id}/subtasks/{subtask_id}", response_model=SubtaskOut)
async def update_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    subtask_in: SubtaskUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Update subtask title, details, assignee, due date, or completion status"""
    return await SubtaskService.update_subtask(
        session, current_user, task_id, subtask_id, subtask_in
    )


@router.patch("/{task_id}/subtasks/{subtask_id}/toggle", response_model=SubtaskOut)
async def toggle_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    payload: SubtaskToggle,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """Quickly toggle subtask completion status"""
    return await SubtaskService.toggle_subtask(
        session, current_user, task_id, subtask_id, payload.is_completed
    )


@router.delete(
    "/{task_id}/subtasks/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Delete a subtask under a task"""
    await SubtaskService.delete_subtask(session, current_user, task_id, subtask_id)


