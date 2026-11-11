from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel


class TaskPerformanceMetrics(BaseModel):
    total_tasks: int = 0
    completed_tasks: int = 0
    in_progress_tasks: int = 0
    pending_tasks: int = 0
    pending_approval_tasks: int = 0
    cancelled_tasks: int = 0
    overdue_tasks: int = 0
    on_time_completed_tasks: int = 0
    task_completion_rate: float = 0.0
    on_time_rate: float = 0.0


class SubtaskPerformanceMetrics(BaseModel):
    total_subtasks: int = 0
    completed_subtasks: int = 0
    pending_subtasks: int = 0
    subtask_completion_rate: float = 0.0
    avg_subtasks_per_task: float = 0.0


class UserPerformance(BaseModel):
    user_id: str
    full_name: str
    role: str
    branch: Optional[str] = None
    department: Optional[str] = None
    tasks_assigned: int = 0
    tasks_completed: int = 0
    tasks_in_progress: int = 0
    tasks_pending: int = 0
    tasks_overdue: int = 0
    task_completion_rate: float = 0.0
    subtasks_total: int = 0
    subtasks_completed: int = 0
    subtask_completion_rate: float = 0.0
    overall_performance_score: float = 0.0


class TaskPerformanceStats(BaseModel):
    scope: str = "organization"
    overall_performance_score: float = 0.0
    task_metrics: TaskPerformanceMetrics
    subtask_metrics: SubtaskPerformanceMetrics
    team_performance: List[UserPerformance] = []


class DashboardStats(BaseModel):
    user_counts_by_role: Dict[str, int]
    task_counts_by_status: Dict[str, int]
    my_tasks_count: int
    my_pending_approvals_count: int
    recurring_tasks_count: int
    today_logged_in_count: int = 0
    today_logins: List[Dict[str, Any]] = []
    task_performance: Optional[TaskPerformanceStats] = None
