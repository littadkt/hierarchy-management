import logging
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentUpdate

logger = logging.getLogger(__name__)


class DepartmentService:
    @staticmethod
    async def list_departments(
        session: AsyncSession,
        active_only: bool = False,
    ) -> List[Department]:
        stmt = select(Department)
        if active_only:
            stmt = stmt.where(Department.is_active.is_(True))
        stmt = stmt.order_by(Department.name.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(session: AsyncSession, department_id: uuid.UUID) -> Optional[Department]:
        stmt = select(Department).where(Department.id == department_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_name(session: AsyncSession, name: str) -> Optional[Department]:
        stmt = select(Department).where(func.lower(Department.name) == name.strip().lower())
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_department(
        session: AsyncSession,
        department_in: DepartmentCreate,
    ) -> Department:
        clean_name = department_in.name.strip()
        existing = await DepartmentService.get_by_name(session, clean_name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with name '{clean_name}' already exists.",
            )

        if department_in.code and department_in.code.strip():
            clean_code = department_in.code.strip().upper()
            code_stmt = select(Department).where(func.upper(Department.code) == clean_code)
            code_res = await session.execute(code_stmt)
            if code_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Department with code '{clean_code}' already exists.",
                )
        else:
            clean_code = None

        department = Department(
            name=clean_name,
            code=clean_code,
            description=department_in.description.strip() if department_in.description and department_in.description.strip() else None,
            is_active=department_in.is_active,
        )
        session.add(department)
        await session.commit()
        await session.refresh(department)
        logger.info(f"Created department '{department.name}' (ID: {department.id})")
        return department

    @staticmethod
    async def update_department(
        session: AsyncSession,
        department_id: uuid.UUID,
        department_in: DepartmentUpdate,
    ) -> Department:
        department = await DepartmentService.get_by_id(session, department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )

        old_name = department.name

        if department_in.name is not None:
            clean_name = department_in.name.strip()
            if clean_name.lower() != old_name.lower():
                existing = await DepartmentService.get_by_name(session, clean_name)
                if existing and existing.id != department.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Department with name '{clean_name}' already exists.",
                    )
            department.name = clean_name

        if department_in.code is not None:
            clean_code = department_in.code.strip().upper() if department_in.code.strip() else None
            if clean_code:
                code_stmt = select(Department).where(func.upper(Department.code) == clean_code, Department.id != department.id)
                code_res = await session.execute(code_stmt)
                if code_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Department with code '{clean_code}' already exists.",
                    )
            department.code = clean_code

        if department_in.description is not None:
            department.description = department_in.description.strip() if department_in.description.strip() else None

        if department_in.is_active is not None:
            department.is_active = department_in.is_active

        # If department name changed, update any existing users who reference old_name
        if department_in.name is not None and department.name != old_name:
            user_update_stmt = (
                update(User)
                .where(User.department == old_name)
                .values(department=department.name)
            )
            await session.execute(user_update_stmt)
            logger.info(f"Updated user department references from '{old_name}' to '{department.name}'")

        await session.commit()
        await session.refresh(department)
        logger.info(f"Updated department '{department.name}' (ID: {department.id})")
        return department

    @staticmethod
    async def delete_department(
        session: AsyncSession,
        department_id: uuid.UUID,
    ) -> None:
        department = await DepartmentService.get_by_id(session, department_id)
        if not department:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found",
            )

        # Check if users are assigned to this department
        user_stmt = select(func.count(User.id)).where(User.department == department.name)
        user_res = await session.execute(user_stmt)
        user_count = user_res.scalar_one()

        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete department '{department.name}' because {user_count} user(s) are currently assigned to it. Please reassign them first or set the department to inactive.",
            )

        await session.delete(department)
        await session.commit()
        logger.info(f"Deleted department '{department.name}' (ID: {department.id})")

