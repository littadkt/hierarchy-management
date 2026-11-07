from typing import List, Optional
from fastapi import HTTPException, status

from app.models.task import Task, TaskStatus
from app.models.user import Role, User


class HierarchyPermissionError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def get_allowed_roles_to_create(operator_role: Role) -> List[Role]:
    """
    Returns list of roles that operator_role is authorized to create.
    - Super Admin: Can create Super Admin, Admin (and any level below if needed)
    - Admin: Can create In-charge
    - In-charge: Can create Team leader and Staff
    - Team leader: Can create Staff
    - Staff: None
    """
    if operator_role == Role.SUPER_ADMIN:
        return [Role.SUPER_ADMIN, Role.ADMIN, Role.IN_CHARGE, Role.TEAM_LEADER, Role.STAFF]
    elif operator_role == Role.ADMIN:
        return [Role.IN_CHARGE]
    elif operator_role == Role.IN_CHARGE:
        return [Role.TEAM_LEADER, Role.STAFF]
    elif operator_role == Role.TEAM_LEADER:
        return [Role.STAFF]
    return []


def validate_can_create_user(operator_role: Role, target_role: Role) -> None:
    allowed = get_allowed_roles_to_create(operator_role)
    if target_role not in allowed:
        raise HierarchyPermissionError(
            f"Role '{operator_role.value}' is not allowed to create a user with role '{target_role.value}'. "
            f"Allowed roles to create: {[r.value for r in allowed]}"
        )


def validate_can_edit_user(operator: User, target: User) -> None:
    # Cannot edit super admin unless you are a super admin
    if target.role == Role.SUPER_ADMIN and operator.role != Role.SUPER_ADMIN:
        raise HierarchyPermissionError("Only Super Admins can edit Super Admin accounts.")

    if operator.role == Role.SUPER_ADMIN:
        return

    # User can edit their own profile basic info
    if operator.id == target.id:
        return

    # Admin: "Can't edit or delete the in-charge"
    if operator.role == Role.ADMIN:
        if target.role == Role.IN_CHARGE:
            raise HierarchyPermissionError("Admin is restricted from editing In-charge accounts.")
        if target.role in [Role.TEAM_LEADER, Role.STAFF]:
            return
        raise HierarchyPermissionError("Admin cannot edit this user account.")

    # In-charge: "Can’t edit or delete the team leader’s tasks and leaders"
    if operator.role == Role.IN_CHARGE:
        if target.role == Role.TEAM_LEADER:
            raise HierarchyPermissionError("In-charge is restricted from editing Team Leader accounts.")
        if target.role == Role.STAFF:
            return
        raise HierarchyPermissionError("In-charge cannot edit this user account.")

    # Team leader: "Can’t update or delete staff’s tasks and staff"
    if operator.role == Role.TEAM_LEADER:
        if target.role == Role.STAFF:
            raise HierarchyPermissionError("Team Leader is restricted from updating Staff accounts.")
        raise HierarchyPermissionError("Team Leader cannot edit other user accounts.")

    # Staff: restricted
    if operator.role == Role.STAFF:
        raise HierarchyPermissionError("Staff cannot edit other users.")


def validate_can_delete_user(operator: User, target: User) -> None:
    if operator.id == target.id:
        raise HierarchyPermissionError("You cannot delete your own account.")

    if operator.role == Role.SUPER_ADMIN:
        return

    # Admin: "Can't edit or delete the in-charge"
    if operator.role == Role.ADMIN:
        if target.role == Role.IN_CHARGE:
            raise HierarchyPermissionError("Admin is restricted from deleting In-charge accounts.")
        if target.role in [Role.TEAM_LEADER, Role.STAFF]:
            return
        raise HierarchyPermissionError("Admin cannot delete this user account.")

    # In-charge: "Can’t edit or delete the team leader’s tasks and leaders"
    if operator.role == Role.IN_CHARGE:
        if target.role == Role.TEAM_LEADER:
            raise HierarchyPermissionError("In-charge is restricted from deleting Team Leader accounts.")
        if target.role == Role.STAFF:
            return
        raise HierarchyPermissionError("In-charge cannot delete this user account.")

    # Team leader: "Can’t update or delete staff’s tasks and staff"
    if operator.role == Role.TEAM_LEADER:
        if target.role == Role.STAFF:
            raise HierarchyPermissionError("Team Leader is restricted from deleting Staff accounts.")
        raise HierarchyPermissionError("Team Leader cannot delete user accounts.")

    # Staff: restricted
    if operator.role == Role.STAFF:
        raise HierarchyPermissionError("Staff cannot delete user accounts.")


def validate_can_assign_task(operator: User, assignee: User) -> None:
    """
    Validates task assignment rules:
    - Super Admin: Can assign tasks to anyone at any level
    - Admin: Create tasks and assign up to staff level (In-charge, Team leader, Staff, Self)
    - In-charge: Create tasks and assign up to staff level (Team leader, Staff, Self)
    - Team leader: Create staff and assign tasks to them, Create own tasks (Staff, Self)
    - Staff: Create their own task (Self only)
    """
    if operator.role == Role.SUPER_ADMIN:
        return

    # Self-assignment is always permitted for all roles
    if operator.id == assignee.id:
        return

    if operator.role == Role.ADMIN:
        # Up to staff level (In-charge, Team Leader, Staff)
        if assignee.role in [Role.IN_CHARGE, Role.TEAM_LEADER, Role.STAFF]:
            return
        raise HierarchyPermissionError("Admin can only assign tasks up to Staff level (In-charge, Team Leader, Staff).")

    if operator.role == Role.IN_CHARGE:
        # Up to staff level (Team Leader, Staff in department)
        if assignee.role in [Role.TEAM_LEADER, Role.STAFF]:
            op_dept = (operator.department or "").strip().lower()
            as_dept = (assignee.department or "").strip().lower()
            if op_dept and as_dept and op_dept != as_dept and assignee.reports_to_id != operator.id:
                raise HierarchyPermissionError(f"In-charge can only assign tasks to subordinates under their department ('{operator.department}').")
            return
        raise HierarchyPermissionError("In-charge can only assign tasks to Team Leader, Staff, or self.")

    if operator.role == Role.TEAM_LEADER:
        # Staff in department and self only
        if assignee.role == Role.STAFF:
            op_dept = (operator.department or "").strip().lower()
            as_dept = (assignee.department or "").strip().lower()
            if op_dept and as_dept and op_dept != as_dept and assignee.reports_to_id != operator.id:
                raise HierarchyPermissionError(f"Team Leader can only assign tasks to Staff under their department ('{operator.department}').")
            return
        raise HierarchyPermissionError("Team Leader can only assign tasks to Staff or self.")

    if operator.role == Role.STAFF:
        raise HierarchyPermissionError("Staff members can only create and assign tasks to themselves.")


def validate_can_edit_or_delete_task(
    operator: User,
    task: Task,
    assignee_role: Optional[Role] = None,
    creator_role: Optional[Role] = None,
    action: str = "edit",
) -> None:
    """
    Task Modification / Deletion Rules:
    Allow edit and delete options only for whoever created the task (or Super Admin).
    """
    if operator.role == Role.SUPER_ADMIN:
        return

    # Check if the operator is the user who created the task
    if task.created_by_id != operator.id:
        raise HierarchyPermissionError(
            f"You cannot {action} this task. Edit and delete permissions are granted only to the user who created the task."
        )


def validate_status_transition(
    operator: User,
    task: Task,
    new_status: TaskStatus,
) -> None:
    """
    Validates task status change rules:
    - Super Admin can close or change to any status.
    - ALL ROLES (Admin, In-charge, Team leader, Staff):
      RESTRICTION: "Update task status to close when it needs higher-level approval"
      -> If task.requires_approval is True and new_status == COMPLETED:
         Only the designated approver (or Super Admin) can transition to COMPLETED.
    """
    if new_status == task.status:
        return

    # Attempting to close/complete the task
    if new_status == TaskStatus.COMPLETED:
        if task.requires_approval:
            # Must be the designated approver or a Super Admin
            is_designated_approver = (task.approver_id == operator.id)
            is_super_admin = (operator.role == Role.SUPER_ADMIN)

            if not (is_designated_approver or is_super_admin):
                raise HierarchyPermissionError(
                    "This task requires higher-level approval to be closed. "
                    "Only the designated approver or a Super Admin can approve and close this task. "
                    "Please submit the task for approval (status: PENDING_APPROVAL) instead."
                )

    # If transitioning to PENDING_APPROVAL
    if new_status == TaskStatus.PENDING_APPROVAL:
        if not task.requires_approval:
            raise HierarchyPermissionError("This task does not require higher-level approval.")
        # Assignee or creator or manager can submit for approval
        if operator.id not in [task.assigned_to_id, task.created_by_id] and operator.role != Role.SUPER_ADMIN:
            raise HierarchyPermissionError("Only the assignee, creator, or Super Admin can submit this task for approval.")


def is_eligible_approver(assignee_role: Role, potential_approver_role: Role) -> bool:
    """
    Checks if potential_approver_role is higher in the hierarchy than assignee_role.
    Level 1 (Super Admin) < Level 2 (Admin) < Level 3 (In-charge) < Level 4 (Team Leader) < Level 5 (Staff)
    """
    return potential_approver_role.level < assignee_role.level


def validate_approver_scope(assignee: User, approver: User) -> None:
    """
    Validates that approver conforms to branch and department hierarchy scoping:
    - Super Admin: Oversees all branches & departments
    - Admin: Must belong to assignee's branch (if configured)
    - In-Charge / Team Leader: Must belong to assignee's department (if configured)
    """
    if approver.role == Role.SUPER_ADMIN:
        return

    assignee_branch = (assignee.branch or "").strip()
    assignee_dept = (assignee.department or "").strip()
    if not assignee_branch and assignee.manager:
        assignee_branch = (assignee.manager.branch or "").strip()
    if not assignee_dept and assignee.manager:
        assignee_dept = (assignee.manager.department or "").strip()

    approver_branch = (approver.branch or "").strip()
    approver_dept = (approver.department or "").strip()

    if approver.role == Role.ADMIN:
        if assignee_branch and approver_branch and assignee_branch.lower() != approver_branch.lower():
            raise HierarchyPermissionError(
                f"Selected Admin '{approver.full_name}' belongs to branch '{approver_branch}', "
                f"which does not match the assignee's branch '{assignee_branch}'."
            )
    elif approver.role == Role.IN_CHARGE:
        # In-Charge can approve for Team Leader or Staff in their branch and department, or reporting line
        is_direct_mgr = (approver.id == assignee.reports_to_id)
        is_indirect_mgr = bool(assignee.manager and assignee.manager.reports_to_id == approver.id)
        if is_direct_mgr or is_indirect_mgr:
            return

        if assignee_dept and approver_dept and assignee_dept.lower() != approver_dept.lower():
            raise HierarchyPermissionError(
                f"Selected In-Charge '{approver.full_name}' belongs to department '{approver_dept}', "
                f"which does not match the assignee's department '{assignee_dept}'."
            )
        if assignee_branch and approver_branch and assignee_branch.lower() != approver_branch.lower():
            raise HierarchyPermissionError(
                f"Selected In-Charge '{approver.full_name}' belongs to branch '{approver_branch}', "
                f"which does not match the assignee's branch '{assignee_branch}'."
            )
    elif approver.role == Role.TEAM_LEADER:
        is_direct_mgr = (approver.id == assignee.reports_to_id)
        if is_direct_mgr:
            return
        if assignee_dept and approver_dept and assignee_dept.lower() != approver_dept.lower():
            raise HierarchyPermissionError(
                f"Selected Team Leader '{approver.full_name}' belongs to department '{approver_dept}', "
                f"which does not match the assignee's department '{assignee_dept}'."
            )
        if assignee_branch and approver_branch and assignee_branch.lower() != approver_branch.lower():
            raise HierarchyPermissionError(
                f"Selected Team Leader '{approver.full_name}' belongs to branch '{approver_branch}', "
                f"which does not match the assignee's branch '{assignee_branch}'."
            )

