import logging
from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import Branch
from app.models.user import User
from app.schemas.branch import BranchCreate, BranchUpdate

logger = logging.getLogger(__name__)


class BranchService:
    @staticmethod
    async def list_branches(
        session: AsyncSession,
        active_only: bool = False,
    ) -> List[Branch]:
        stmt = select(Branch)
        if active_only:
            stmt = stmt.where(Branch.is_active.is_(True))
        stmt = stmt.order_by(Branch.name.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(session: AsyncSession, branch_id: uuid.UUID) -> Optional[Branch]:
        stmt = select(Branch).where(Branch.id == branch_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_name(session: AsyncSession, name: str) -> Optional[Branch]:
        stmt = select(Branch).where(func.lower(Branch.name) == name.strip().lower())
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_branch(
        session: AsyncSession,
        branch_in: BranchCreate,
    ) -> Branch:
        clean_name = branch_in.name.strip()
        existing = await BranchService.get_by_name(session, clean_name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Branch with name '{clean_name}' already exists.",
            )

        if branch_in.code and branch_in.code.strip():
            clean_code = branch_in.code.strip().upper()
            code_stmt = select(Branch).where(func.upper(Branch.code) == clean_code)
            code_res = await session.execute(code_stmt)
            if code_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Branch with code '{clean_code}' already exists.",
                )
        else:
            clean_code = None

        branch = Branch(
            name=clean_name,
            code=clean_code,
            city=branch_in.city.strip() if branch_in.city and branch_in.city.strip() else None,
            address=branch_in.address.strip() if branch_in.address and branch_in.address.strip() else None,
            is_active=branch_in.is_active,
        )
        session.add(branch)
        await session.commit()
        await session.refresh(branch)
        logger.info(f"Created branch '{branch.name}' (ID: {branch.id})")
        return branch

    @staticmethod
    async def update_branch(
        session: AsyncSession,
        branch_id: uuid.UUID,
        branch_in: BranchUpdate,
    ) -> Branch:
        branch = await BranchService.get_by_id(session, branch_id)
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found",
            )

        old_name = branch.name

        if branch_in.name is not None:
            clean_name = branch_in.name.strip()
            if clean_name.lower() != old_name.lower():
                existing = await BranchService.get_by_name(session, clean_name)
                if existing and existing.id != branch.id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Branch with name '{clean_name}' already exists.",
                    )
            branch.name = clean_name

        if branch_in.code is not None:
            clean_code = branch_in.code.strip().upper() if branch_in.code.strip() else None
            if clean_code:
                code_stmt = select(Branch).where(func.upper(Branch.code) == clean_code, Branch.id != branch.id)
                code_res = await session.execute(code_stmt)
                if code_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Branch with code '{clean_code}' already exists.",
                    )
            branch.code = clean_code

        if branch_in.city is not None:
            branch.city = branch_in.city.strip() if branch_in.city.strip() else None

        if branch_in.address is not None:
            branch.address = branch_in.address.strip() if branch_in.address.strip() else None

        if branch_in.is_active is not None:
            branch.is_active = branch_in.is_active

        # If branch name changed, update any existing users who reference old_name
        if branch_in.name is not None and branch.name != old_name:
            user_update_stmt = (
                update(User)
                .where(User.branch == old_name)
                .values(branch=branch.name)
            )
            await session.execute(user_update_stmt)
            logger.info(f"Updated user branch references from '{old_name}' to '{branch.name}'")

        await session.commit()
        await session.refresh(branch)
        logger.info(f"Updated branch '{branch.name}' (ID: {branch.id})")
        return branch

    @staticmethod
    async def delete_branch(
        session: AsyncSession,
        branch_id: uuid.UUID,
    ) -> None:
        branch = await BranchService.get_by_id(session, branch_id)
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found",
            )

        # Check if users are assigned to this branch
        user_stmt = select(func.count(User.id)).where(User.branch == branch.name)
        user_res = await session.execute(user_stmt)
        user_count = user_res.scalar_one()

        if user_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete branch '{branch.name}' because {user_count} user(s) are currently assigned to it. Please reassign them first or set the branch to inactive.",
            )

        await session.delete(branch)
        await session.commit()
        logger.info(f"Deleted branch '{branch.name}' (ID: {branch.id})")
