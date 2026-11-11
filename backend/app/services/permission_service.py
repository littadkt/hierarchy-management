import logging
from typing import Any, Dict, List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.broadcaster import broadcaster
from app.core.permissions import HierarchyPermissionError
from app.models.user import Role, User

logger = logging.getLogger(__name__)

# Complete hierarchical list of accessible windows/features matching actual application features
ACCESSIBLE_WINDOWS = [
    # 1. Core Operations
    {"id": "operations", "name": "Core Operations", "level": 0, "is_group": True},
    {"id": "tasks", "name": "Tasks Management", "parent_id": "operations", "level": 1, "sidebar_href": "/tasks"},
    {"id": "subtasks", "name": "Subtasks", "parent_id": "operations", "level": 1},
    {"id": "checklist", "name": "My Checklist", "parent_id": "operations", "level": 1, "sidebar_href": "/checklist"},
    {"id": "approvals", "name": "Approvals & Decisions", "parent_id": "operations", "level": 1, "sidebar_href": "/approvals"},

    # 2. Inventory & Services
    {"id": "inventory_services", "name": "Inventory & Services", "level": 0, "is_group": True},
    {"id": "inventory", "name": "Inventory Stock", "parent_id": "inventory_services", "level": 1, "sidebar_href": "/inventory"},
    {"id": "purchases", "name": "Purchase Desk", "parent_id": "inventory_services", "level": 1, "sidebar_href": "/purchases"},
    {"id": "warranty", "name": "Warranty Management", "parent_id": "inventory_services", "level": 1, "sidebar_href": "/warranty", "is_group": True},
    {"id": "warranty_jobs", "name": "Warranty Jobs", "parent_id": "warranty", "level": 2},
    {"id": "warranty_services", "name": "Service Types", "parent_id": "warranty", "level": 2},
    {"id": "warranty_brands", "name": "Brands & Models", "parent_id": "warranty", "level": 2},
    {"id": "warranty_staff", "name": "Warranty Staff", "parent_id": "warranty", "level": 2},
    {"id": "wholesale", "name": "Wholesale Orders", "parent_id": "inventory_services", "level": 1, "sidebar_href": "/wholesale"},

    # 3. HR & Organization
    {"id": "hr_org", "name": "HR & Organization", "level": 0, "is_group": True},
    {"id": "attendance", "name": "Attendance & Check-in", "parent_id": "hr_org", "level": 1, "sidebar_href": "/attendance"},
    {"id": "users", "name": "Team & Users", "parent_id": "hr_org", "level": 1, "sidebar_href": "/users"},
    {"id": "hierarchy", "name": "Org Hierarchy", "parent_id": "hr_org", "level": 1, "sidebar_href": "/hierarchy"},

    # 4. Administration & System
    {"id": "admin_system", "name": "Administration & System", "level": 0, "is_group": True},
    {"id": "dashboard", "name": "Dashboard & Statistics", "parent_id": "admin_system", "level": 1, "sidebar_href": "/"},
    {"id": "branches", "name": "Branches", "parent_id": "admin_system", "level": 1, "sidebar_href": "/branches"},
    {"id": "departments", "name": "Departments", "parent_id": "admin_system", "level": 1, "sidebar_href": "/departments"},
    {"id": "backup", "name": "Backup & Restore", "parent_id": "admin_system", "level": 1, "sidebar_href": "/backup"},
]


def get_default_permissions_for_role(role: Role) -> Dict[str, Dict[str, bool]]:
    """Generate default view/add/edit/delete matrix for a given role based on actual app features."""
    all_true = {"add": True, "display": True, "edit": True, "delete": True}
    all_false = {"add": False, "display": False, "edit": False, "delete": False}

    result = {}

    if role == Role.SUPER_ADMIN:
        for w in ACCESSIBLE_WINDOWS:
            result[w["id"]] = dict(all_true)
        return result

    if role == Role.ADMIN:
        for w in ACCESSIBLE_WINDOWS:
            if w["id"] == "backup":
                result[w["id"]] = dict(all_false)
            else:
                result[w["id"]] = dict(all_true)
        return result

    if role == Role.IN_CHARGE:
        for w in ACCESSIBLE_WINDOWS:
            wid = w["id"]
            if wid in ["backup"]:
                result[wid] = dict(all_false)
            elif wid in ["tasks", "subtasks", "checklist", "approvals", "warranty", "warranty_jobs", "attendance"]:
                result[wid] = {"add": True, "display": True, "edit": True, "delete": True}
            elif wid in ["inventory", "purchases", "wholesale", "users", "hierarchy", "departments", "branches", "dashboard", "operations", "inventory_services", "hr_org", "admin_system"]:
                result[wid] = {"add": False, "display": True, "edit": False, "delete": False}
            else:
                result[wid] = {"add": False, "display": True, "edit": False, "delete": False}
        return result

    if role == Role.TEAM_LEADER:
        for w in ACCESSIBLE_WINDOWS:
            wid = w["id"]
            if wid in ["backup", "branches", "departments", "wholesale"]:
                result[wid] = dict(all_false)
            elif wid in ["tasks", "subtasks", "checklist", "warranty", "warranty_jobs", "attendance"]:
                result[wid] = {"add": True, "display": True, "edit": True, "delete": False}
            elif wid in ["approvals"]:
                result[wid] = {"add": True, "display": True, "edit": False, "delete": False}
            elif wid in ["inventory", "purchases", "dashboard", "users", "hierarchy", "operations", "inventory_services", "hr_org", "admin_system"]:
                result[wid] = {"add": False, "display": True, "edit": False, "delete": False}
            else:
                result[wid] = {"add": False, "display": True, "edit": False, "delete": False}
        return result

    # STAFF
    for w in ACCESSIBLE_WINDOWS:
        wid = w["id"]
        if wid in ["backup", "branches", "departments", "wholesale", "users", "hierarchy", "approvals"]:
            result[wid] = dict(all_false)
        elif wid in ["checklist"]:
            result[wid] = {"add": True, "display": True, "edit": True, "delete": True}
        elif wid in ["tasks", "subtasks"]:
            result[wid] = {"add": False, "display": True, "edit": True, "delete": False}
        elif wid in ["warranty", "warranty_jobs"]:
            result[wid] = {"add": True, "display": True, "edit": False, "delete": False}
        elif wid in ["attendance"]:
            result[wid] = {"add": True, "display": True, "edit": False, "delete": False}
        elif wid in ["inventory", "purchases", "dashboard", "operations", "inventory_services", "hr_org", "admin_system"]:
            result[wid] = {"add": False, "display": True, "edit": False, "delete": False}
        else:
            result[wid] = {"add": False, "display": False, "edit": False, "delete": False}

    return result


class PermissionService:
    @staticmethod
    def get_windows() -> List[Dict[str, Any]]:
        return ACCESSIBLE_WINDOWS

    @staticmethod
    def get_user_permissions(user: User) -> Dict[str, Dict[str, bool]]:
        """Return full permissions matrix for user, incorporating defaults and stored overrides."""
        defaults = get_default_permissions_for_role(user.role)
        if user.role == Role.SUPER_ADMIN:
            # Super Admin always possesses full permissions
            return defaults

        stored = user.permissions or {}
        merged = {}
        for w in ACCESSIBLE_WINDOWS:
            wid = w["id"]
            d = defaults.get(wid, {"add": False, "display": False, "edit": False, "delete": False})
            if wid in stored and isinstance(stored[wid], dict):
                merged[wid] = {
                    "add": bool(stored[wid].get("add", d.get("add", False))),
                    "display": bool(stored[wid].get("display", d.get("display", False))),
                    "edit": bool(stored[wid].get("edit", d.get("edit", False))),
                    "delete": bool(stored[wid].get("delete", d.get("delete", False))),
                }
            else:
                merged[wid] = dict(d)
        return merged

    @staticmethod
    async def update_user_permissions(
        session: AsyncSession,
        operator: User,
        target_user_id: uuid.UUID,
        new_permissions: Dict[str, Any],
    ) -> Dict[str, Dict[str, bool]]:
        """Update permissions for a specific user (Super Admin & Admin only)."""
        if operator.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
            raise HierarchyPermissionError("Only Admins and Super Admins can configure accessible window permissions.")

        result = await session.execute(select(User).where(User.id == target_user_id))
        target_user = result.scalars().first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {target_user_id} not found",
            )

        # Hierarchy & Scope Validations
        if target_user.role == Role.SUPER_ADMIN and operator.role != Role.SUPER_ADMIN:
            raise HierarchyPermissionError("Admins cannot modify permissions for Super Admins.")

        if operator.role == Role.ADMIN:
            if operator.branch and target_user.branch and operator.branch != target_user.branch:
                raise HierarchyPermissionError(
                    f"Admins can only manage permissions for users in their branch ('{operator.branch}')."
                )

        sanitized: Dict[str, Dict[str, bool]] = {}
        for wid, perm in new_permissions.items():
            if isinstance(perm, dict):
                sanitized[wid] = {
                    "add": bool(perm.get("add", False)),
                    "display": bool(perm.get("display", False)),
                    "edit": bool(perm.get("edit", False)),
                    "delete": bool(perm.get("delete", False)),
                }

        target_user.permissions = sanitized
        await session.commit()
        await session.refresh(target_user)

        full_perms = PermissionService.get_user_permissions(target_user)

        # Realtime WebSocket broadcast
        await broadcaster.broadcast(
            "USER_PERMISSIONS_UPDATED",
            {
                "user_id": str(target_user.id),
                "full_name": target_user.full_name,
                "role": target_user.role.value,
                "permissions": full_perms,
            },
        )

        logger.info(
            f"Permissions updated for user {target_user.email} ({target_user.id}) by {operator.email}"
        )
        return full_perms

    @staticmethod
    async def reset_user_permissions(
        session: AsyncSession,
        operator: User,
        target_user_id: uuid.UUID,
    ) -> Dict[str, Dict[str, bool]]:
        """Reset permissions back to role defaults."""
        if operator.role not in [Role.SUPER_ADMIN, Role.ADMIN]:
            raise HierarchyPermissionError("Only Admins and Super Admins can reset permissions.")

        result = await session.execute(select(User).where(User.id == target_user_id))
        target_user = result.scalars().first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {target_user_id} not found",
            )

        if target_user.role == Role.SUPER_ADMIN and operator.role != Role.SUPER_ADMIN:
            raise HierarchyPermissionError("Admins cannot reset permissions for Super Admins.")

        target_user.permissions = {}
        await session.commit()
        await session.refresh(target_user)

        full_perms = PermissionService.get_user_permissions(target_user)
        await broadcaster.broadcast(
            "USER_PERMISSIONS_UPDATED",
            {
                "user_id": str(target_user.id),
                "full_name": target_user.full_name,
                "role": target_user.role.value,
                "permissions": full_perms,
            },
        )
        return full_perms
