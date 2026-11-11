from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.broadcaster import broadcaster
from app.models.user import User
from app.models.warranty import (
    WarrantyBrand,
    WarrantyJob,
    WarrantyModel,
    WarrantyServiceType,
    WarrantyStaff,
    WarrantyStatus,
)
from app.schemas.warranty import (
    WarrantyBrandCreate,
    WarrantyBrandUpdate,
    WarrantyJobCreate,
    WarrantyJobUpdate,
    WarrantyModelCreate,
    WarrantyModelUpdate,
    WarrantySerialHistory,
    WarrantyServiceTypeCreate,
    WarrantyServiceTypeUpdate,
    WarrantyStaffCreate,
    WarrantyStaffUpdate,
)


class WarrantyService:
    # =========================================================================
    # SERVICE TYPES CRUD
    # =========================================================================
    @staticmethod
    async def list_service_types(
        session: AsyncSession, active_only: bool = False
    ) -> List[WarrantyServiceType]:
        stmt = select(WarrantyServiceType).order_by(WarrantyServiceType.name.asc())
        if active_only:
            stmt = stmt.where(WarrantyServiceType.is_active == True)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_service_type(
        session: AsyncSession, data: WarrantyServiceTypeCreate
    ) -> WarrantyServiceType:
        name = data.name.strip()
        existing = await session.execute(
            select(WarrantyServiceType).where(
                func.lower(WarrantyServiceType.name) == name.lower()
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Service type '{name}' already exists.",
            )
        item = WarrantyServiceType(
            name=name,
            description=data.description.strip() if data.description else None,
            is_active=data.is_active,
        )
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def update_service_type(
        session: AsyncSession, item_id: uuid.UUID, data: WarrantyServiceTypeUpdate
    ) -> WarrantyServiceType:
        item = await session.get(WarrantyServiceType, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service type not found.",
            )
        if data.name is not None:
            name = data.name.strip()
            existing = await session.execute(
                select(WarrantyServiceType).where(
                    func.lower(WarrantyServiceType.name) == name.lower(),
                    WarrantyServiceType.id != item_id,
                )
            )
            if existing.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Service type '{name}' already exists.",
                )
            item.name = name
        if data.description is not None:
            item.description = data.description.strip() if data.description else None
        if data.is_active is not None:
            item.is_active = data.is_active

        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def delete_service_type(
        session: AsyncSession, item_id: uuid.UUID
    ) -> None:
        item = await session.get(WarrantyServiceType, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Service type not found.",
            )
        await session.delete(item)
        await session.commit()

    # =========================================================================
    # STAFF CRUD
    # =========================================================================
    @staticmethod
    async def list_staff(
        session: AsyncSession, active_only: bool = False
    ) -> List[WarrantyStaff]:
        stmt = select(WarrantyStaff).order_by(WarrantyStaff.name.asc())
        if active_only:
            stmt = stmt.where(WarrantyStaff.is_active == True)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_staff(
        session: AsyncSession, data: WarrantyStaffCreate
    ) -> WarrantyStaff:
        name = data.name.strip()
        item = WarrantyStaff(
            name=name,
            phone=data.phone.strip() if data.phone else None,
            email=data.email.strip() if data.email else None,
            is_active=data.is_active,
        )
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def update_staff(
        session: AsyncSession, item_id: uuid.UUID, data: WarrantyStaffUpdate
    ) -> WarrantyStaff:
        item = await session.get(WarrantyStaff, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found.",
            )
        if data.name is not None:
            item.name = data.name.strip()
        if data.phone is not None:
            item.phone = data.phone.strip() if data.phone else None
        if data.email is not None:
            item.email = data.email.strip() if data.email else None
        if data.is_active is not None:
            item.is_active = data.is_active

        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def delete_staff(session: AsyncSession, item_id: uuid.UUID) -> None:
        item = await session.get(WarrantyStaff, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found.",
            )
        await session.delete(item)
        await session.commit()

    # =========================================================================
    # BRANDS CRUD
    # =========================================================================
    @staticmethod
    async def list_brands(
        session: AsyncSession, active_only: bool = False
    ) -> List[WarrantyBrand]:
        stmt = select(WarrantyBrand).order_by(WarrantyBrand.name.asc())
        if active_only:
            stmt = stmt.where(WarrantyBrand.is_active == True)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_brand(
        session: AsyncSession, data: WarrantyBrandCreate
    ) -> WarrantyBrand:
        name = data.name.strip()
        existing = await session.execute(
            select(WarrantyBrand).where(
                func.lower(WarrantyBrand.name) == name.lower()
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Brand '{name}' already exists.",
            )
        item = WarrantyBrand(name=name, is_active=data.is_active)
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def update_brand(
        session: AsyncSession, item_id: uuid.UUID, data: WarrantyBrandUpdate
    ) -> WarrantyBrand:
        item = await session.get(WarrantyBrand, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brand not found.",
            )
        if data.name is not None:
            name = data.name.strip()
            existing = await session.execute(
                select(WarrantyBrand).where(
                    func.lower(WarrantyBrand.name) == name.lower(),
                    WarrantyBrand.id != item_id,
                )
            )
            if existing.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Brand '{name}' already exists.",
                )
            item.name = name
        if data.is_active is not None:
            item.is_active = data.is_active

        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def delete_brand(session: AsyncSession, item_id: uuid.UUID) -> None:
        item = await session.get(WarrantyBrand, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Brand not found.",
            )
        await session.delete(item)
        await session.commit()

    # =========================================================================
    # MODELS CRUD
    # =========================================================================
    @staticmethod
    async def list_models(
        session: AsyncSession,
        brand_id: Optional[uuid.UUID] = None,
        active_only: bool = False,
    ) -> List[WarrantyModel]:
        stmt = (
            select(WarrantyModel)
            .options(selectinload(WarrantyModel.brand))
            .order_by(WarrantyModel.name.asc())
        )
        if brand_id:
            stmt = stmt.where(WarrantyModel.brand_id == brand_id)
        if active_only:
            stmt = stmt.where(WarrantyModel.is_active == True)
        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_model(
        session: AsyncSession, data: WarrantyModelCreate
    ) -> WarrantyModel:
        name = data.name.strip()
        item = WarrantyModel(
            name=name,
            brand_id=data.brand_id,
            is_active=data.is_active,
        )
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def update_model(
        session: AsyncSession, item_id: uuid.UUID, data: WarrantyModelUpdate
    ) -> WarrantyModel:
        item = await session.get(WarrantyModel, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model not found.",
            )
        if data.name is not None:
            item.name = data.name.strip()
        if "brand_id" in data.model_fields_set:
            item.brand_id = data.brand_id
        if data.is_active is not None:
            item.is_active = data.is_active

        await session.commit()
        await session.refresh(item)
        return item

    @staticmethod
    async def delete_model(session: AsyncSession, item_id: uuid.UUID) -> None:
        item = await session.get(WarrantyModel, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model not found.",
            )
        await session.delete(item)
        await session.commit()

    # =========================================================================
    # WARRANTY JOBS & SERIAL HISTORY
    # =========================================================================
    @staticmethod
    async def generate_job_number(session: AsyncSession) -> str:
        """Generates sequential job number like WRN-YYYYMMDD-0001"""
        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")
        prefix = f"WRN-{date_str}-"

        stmt = (
            select(WarrantyJob.job_number)
            .where(WarrantyJob.job_number.like(f"{prefix}%"))
            .order_by(desc(WarrantyJob.job_number))
            .limit(1)
        )
        res = await session.execute(stmt)
        latest = res.scalar_one_or_none()

        if latest:
            try:
                seq_part = latest.split("-")[-1]
                next_seq = int(seq_part) + 1
            except (ValueError, IndexError):
                next_seq = 1
        else:
            next_seq = 1

        return f"{prefix}{next_seq:04d}"

    @staticmethod
    async def get_serial_history(
        session: AsyncSession, serial_number: str, exclude_job_id: Optional[uuid.UUID] = None
    ) -> WarrantySerialHistory:
        """
        Finds all service history for a product serial number across all customers.
        """
        s_clean = serial_number.strip().lower()
        if not s_clean:
            return WarrantySerialHistory(serial_number=serial_number, total_services=0, jobs=[])

        stmt = (
            select(WarrantyJob)
            .options(
                selectinload(WarrantyJob.service_type),
                selectinload(WarrantyJob.staff),
                selectinload(WarrantyJob.brand),
                selectinload(WarrantyJob.model_rel),
                selectinload(WarrantyJob.created_by),
            )
            .where(func.lower(func.trim(WarrantyJob.serial_number)) == s_clean)
            .order_by(desc(WarrantyJob.created_at))
        )
        if exclude_job_id:
            stmt = stmt.where(WarrantyJob.id != exclude_job_id)

        res = await session.execute(stmt)
        jobs = list(res.scalars().all())

        return WarrantySerialHistory(
            serial_number=serial_number.strip(),
            total_services=len(jobs),
            jobs=jobs,
        )

    @staticmethod
    async def create_job(
        session: AsyncSession, current_user: User, data: WarrantyJobCreate
    ) -> WarrantyJob:
        job_number = await WarrantyService.generate_job_number(session)

        # Resolve names from IDs if not provided
        service_type_name = data.service_type_name
        if data.service_type_id and not service_type_name:
            st = await session.get(WarrantyServiceType, data.service_type_id)
            if st:
                service_type_name = st.name

        staff_name = data.staff_name
        if data.staff_id and not staff_name:
            stf = await session.get(WarrantyStaff, data.staff_id)
            if stf:
                staff_name = stf.name

        brand_name = data.brand_name
        if data.brand_id and not brand_name:
            br = await session.get(WarrantyBrand, data.brand_id)
            if br:
                brand_name = br.name

        model_name = data.model_name
        if data.model_id and not model_name:
            md = await session.get(WarrantyModel, data.model_id)
            if md:
                model_name = md.name

        job = WarrantyJob(
            job_number=job_number,
            customer_name=data.customer_name.strip(),
            customer_phone=data.customer_phone.strip() if data.customer_phone else None,
            customer_email=data.customer_email.strip() if data.customer_email else None,
            customer_address=data.customer_address.strip() if data.customer_address else None,
            service_type_id=data.service_type_id,
            service_type_name=service_type_name,
            staff_id=data.staff_id,
            staff_name=staff_name,
            product_name=data.product_name.strip(),
            serial_number=data.serial_number.strip(),
            brand_id=data.brand_id,
            brand_name=brand_name,
            model_id=data.model_id,
            model_name=model_name,
            work_description=data.work_description.strip(),
            status=data.status or WarrantyStatus.RECEIVED,
            notes=data.notes.strip() if data.notes else None,
            created_by_id=current_user.id,
            received_date=datetime.now(timezone.utc),
        )
        session.add(job)
        await session.commit()

        # Reload with relationships
        return await WarrantyService.get_job(session, job.id)

    @staticmethod
    async def get_job(session: AsyncSession, job_id: uuid.UUID) -> WarrantyJob:
        stmt = (
            select(WarrantyJob)
            .options(
                selectinload(WarrantyJob.service_type),
                selectinload(WarrantyJob.staff),
                selectinload(WarrantyJob.brand),
                selectinload(WarrantyJob.model_rel),
                selectinload(WarrantyJob.created_by),
            )
            .where(WarrantyJob.id == job_id)
        )
        res = await session.execute(stmt)
        job = res.scalar_one_or_none()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Warranty job not found.",
            )
        return job

    @staticmethod
    async def update_job(
        session: AsyncSession,
        current_user: User,
        job_id: uuid.UUID,
        data: WarrantyJobUpdate,
    ) -> WarrantyJob:
        job = await WarrantyService.get_job(session, job_id)

        if data.customer_name is not None:
            job.customer_name = data.customer_name.strip()
        if data.customer_phone is not None:
            job.customer_phone = data.customer_phone.strip() if data.customer_phone else None
        if data.customer_email is not None:
            job.customer_email = data.customer_email.strip() if data.customer_email else None
        if data.customer_address is not None:
            job.customer_address = data.customer_address.strip() if data.customer_address else None

        if "service_type_id" in data.model_fields_set:
            job.service_type_id = data.service_type_id
            if data.service_type_id:
                st = await session.get(WarrantyServiceType, data.service_type_id)
                job.service_type_name = st.name if st else data.service_type_name
            else:
                job.service_type_name = data.service_type_name

        if "staff_id" in data.model_fields_set:
            job.staff_id = data.staff_id
            if data.staff_id:
                stf = await session.get(WarrantyStaff, data.staff_id)
                job.staff_name = stf.name if stf else data.staff_name
            else:
                job.staff_name = data.staff_name

        if data.product_name is not None:
            job.product_name = data.product_name.strip()
        if data.serial_number is not None:
            job.serial_number = data.serial_number.strip()

        if "brand_id" in data.model_fields_set:
            job.brand_id = data.brand_id
            if data.brand_id:
                br = await session.get(WarrantyBrand, data.brand_id)
                job.brand_name = br.name if br else data.brand_name
            else:
                job.brand_name = data.brand_name

        if "model_id" in data.model_fields_set:
            job.model_id = data.model_id
            if data.model_id:
                md = await session.get(WarrantyModel, data.model_id)
                job.model_name = md.name if md else data.model_name
            else:
                job.model_name = data.model_name

        if data.work_description is not None:
            job.work_description = data.work_description.strip()

        if data.status is not None:
            job.status = data.status
            if data.status == WarrantyStatus.WARRANTY_COMPLETED and not job.completed_date:
                job.completed_date = datetime.now(timezone.utc)
            elif data.status == WarrantyStatus.DELIVERED:
                if not job.completed_date:
                    job.completed_date = datetime.now(timezone.utc)
                if not job.delivered_date:
                    job.delivered_date = datetime.now(timezone.utc)

        if data.notes is not None:
            job.notes = data.notes.strip() if data.notes else None
        if data.completed_date is not None:
            job.completed_date = data.completed_date
        if data.delivered_date is not None:
            job.delivered_date = data.delivered_date

        await session.commit()
        return await WarrantyService.get_job(session, job_id)

    @staticmethod
    async def update_job_status(
        session: AsyncSession,
        current_user: User,
        job_id: uuid.UUID,
        new_status: WarrantyStatus,
        notes: Optional[str] = None,
    ) -> WarrantyJob:
        job = await WarrantyService.get_job(session, job_id)
        job.status = new_status
        if notes:
            existing_notes = job.notes or ""
            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
            job.notes = f"{existing_notes}\n[{timestamp}] Status changed to {new_status.value}: {notes}".strip()

        if new_status == WarrantyStatus.WARRANTY_COMPLETED and not job.completed_date:
            job.completed_date = datetime.now(timezone.utc)
        elif new_status == WarrantyStatus.DELIVERED:
            if not job.completed_date:
                job.completed_date = datetime.now(timezone.utc)
            if not job.delivered_date:
                job.delivered_date = datetime.now(timezone.utc)

        await session.commit()
        return await WarrantyService.get_job(session, job_id)

    @staticmethod
    async def delete_job(
        session: AsyncSession, current_user: User, job_id: uuid.UUID
    ) -> None:
        job = await WarrantyService.get_job(session, job_id)
        await session.delete(job)
        await session.commit()

    @staticmethod
    async def list_jobs(
        session: AsyncSession,
        search: Optional[str] = None,
        status_filter: Optional[WarrantyStatus] = None,
        brand_id: Optional[uuid.UUID] = None,
        staff_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[WarrantyJob], int, Dict[str, int]]:
        stmt = (
            select(WarrantyJob)
            .options(
                selectinload(WarrantyJob.service_type),
                selectinload(WarrantyJob.staff),
                selectinload(WarrantyJob.brand),
                selectinload(WarrantyJob.model_rel),
                selectinload(WarrantyJob.created_by),
            )
            .order_by(desc(WarrantyJob.created_at))
        )

        if status_filter:
            stmt = stmt.where(WarrantyJob.status == status_filter)
        if brand_id:
            stmt = stmt.where(WarrantyJob.brand_id == brand_id)
        if staff_id:
            stmt = stmt.where(WarrantyJob.staff_id == staff_id)

        if search:
            q = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(WarrantyJob.job_number).like(q),
                    func.lower(WarrantyJob.customer_name).like(q),
                    func.lower(WarrantyJob.customer_phone).like(q),
                    func.lower(WarrantyJob.serial_number).like(q),
                    func.lower(WarrantyJob.product_name).like(q),
                    func.lower(WarrantyJob.brand_name).like(q),
                    func.lower(WarrantyJob.model_name).like(q),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar() or 0

        # Paginate
        stmt = stmt.offset(skip).limit(limit)
        res = await session.execute(stmt)
        items = list(res.scalars().all())

        # Status counts breakdown
        counts_stmt = select(WarrantyJob.status, func.count(WarrantyJob.id)).group_by(
            WarrantyJob.status
        )
        counts_res = await session.execute(counts_stmt)
        status_counts = {
            WarrantyStatus.RECEIVED.value: 0,
            WarrantyStatus.SEND_TO_COMPANY.value: 0,
            WarrantyStatus.WARRANTY_COMPLETED.value: 0,
            WarrantyStatus.REJECTED.value: 0,
            WarrantyStatus.DELIVERED.value: 0,
        }
        for st_val, cnt in counts_res.all():
            st_key = st_val.value if hasattr(st_val, "value") else str(st_val)
            status_counts[st_key] = cnt

        return items, total, status_counts
