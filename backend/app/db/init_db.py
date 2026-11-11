import logging
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import engine
from app.models.branch import Branch
from app.models.department import Department
from app.models.user import Role, User

logger = logging.getLogger(__name__)


async def init_models() -> None:
    """Create database tables if they do not exist and ensure columns exist"""
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warrantystatus') THEN
                    CREATE TYPE warrantystatus AS ENUM ('RECEIVED', 'SEND_TO_COMPANY', 'WARRANTY_COMPLETED', 'REJECTED', 'DELIVERED');
                END IF;
            END$$;
            """)
        )
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_purchase_manager BOOLEAN DEFAULT FALSE NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS can_place_wholesale_orders BOOLEAN DEFAULT FALSE NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;")
        )
        await conn.execute(
            text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_days_of_week VARCHAR(50);")
        )
        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS task_attachments (
                id UUID PRIMARY KEY,
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                subtask_id UUID REFERENCES subtasks(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                stored_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INTEGER NOT NULL,
                content_type VARCHAR(100),
                uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """)
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_task_attachments_task_id ON task_attachments (task_id);")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_task_attachments_subtask_id ON task_attachments (subtask_id);")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_task_attachments_uploaded_by_id ON task_attachments (uploaded_by_id);")
        )
        await conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS attendance_records (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date VARCHAR(10) NOT NULL,
                check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
                check_out_time TIMESTAMP WITH TIME ZONE,
                total_hours FLOAT NOT NULL DEFAULT 0.0,
                status VARCHAR(50) NOT NULL DEFAULT 'CHECKED_IN',
                check_in_note VARCHAR(255),
                check_out_note VARCHAR(255),
                ip_address VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """)
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_attendance_records_user_id ON attendance_records (user_id);")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_attendance_records_date ON attendance_records (date);")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_attendance_records_status ON attendance_records (status);")
        )
        await conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_user_date ON attendance_records (user_id, date);")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS today_first_login_at TIMESTAMP WITH TIME ZONE;")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS today_first_login_date VARCHAR(10);")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_on_leave BOOLEAN DEFAULT FALSE NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS leave_date VARCHAR(10);")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS leave_reason VARCHAR(255);")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_users_is_on_leave ON users (is_on_leave);")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '{}';")
        )
        await conn.execute(
            text("ALTER TABLE purchase_requests ALTER COLUMN category DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE purchase_requests ALTER COLUMN brand DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE purchase_requests ALTER COLUMN name DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE purchase_requests ALTER COLUMN vendor DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE purchase_requests ALTER COLUMN rate DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE inventory_items ALTER COLUMN name DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE inventory_items ALTER COLUMN rate DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE inventory_items ALTER COLUMN rate SET DEFAULT 0.0;")
        )
        await conn.execute(
            text("ALTER TABLE inventory_items ALTER COLUMN category DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE inventory_items ALTER COLUMN brand DROP NOT NULL;")
        )
        await conn.execute(
            text("ALTER TABLE inventory_items ALTER COLUMN vendor DROP NOT NULL;")
        )
        # Separate inventory per branch
        await conn.execute(
            text("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE CASCADE;")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_inventory_items_branch_id ON inventory_items (branch_id);")
        )
        await conn.execute(
            text("DROP INDEX IF EXISTS ix_inventory_items_code;")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_inventory_items_code ON inventory_items (code);")
        )
        await conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_branch_code ON inventory_items (branch_id, code) WHERE branch_id IS NOT NULL;")
        )
        await conn.execute(
            text("""
            UPDATE inventory_items 
            SET branch_id = (SELECT id FROM branches ORDER BY created_at ASC LIMIT 1)
            WHERE branch_id IS NULL AND EXISTS (SELECT 1 FROM branches);
            """)
        )
        # Drag-and-drop ordering columns
        await conn.execute(
            text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0 NOT NULL;")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_tasks_order_index ON tasks (order_index);")
        )
        await conn.execute(
            text("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0 NOT NULL;")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_subtasks_order_index ON subtasks (order_index);")
        )
        await conn.execute(
            text("ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0 NOT NULL;")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_checklist_items_order_index ON checklist_items (order_index);")
        )
        await conn.execute(
            text("ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES users(id) ON DELETE SET NULL;")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_checklist_items_target_user_id ON checklist_items (target_user_id);")
        )
    logger.info("Database tables verified/created successfully.")


async def init_super_admin(session: AsyncSession) -> User:
    """Seed the default Super Admin user if not present"""
    stmt = (
        select(User)
        .where(User.email == settings.FIRST_SUPER_ADMIN_EMAIL)
        .order_by(User.created_at.asc())
    )
    result = await session.execute(stmt)
    user = result.scalars().first()

    if not user:
        user = User(
            email=settings.FIRST_SUPER_ADMIN_EMAIL,
            full_name=settings.FIRST_SUPER_ADMIN_NAME,
            hashed_password=get_password_hash(settings.FIRST_SUPER_ADMIN_PASSWORD),
            role=Role.SUPER_ADMIN,
            is_active=True,
            reports_to_id=None,
            created_by_id=None,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info(f"Super Admin seeded successfully: {settings.FIRST_SUPER_ADMIN_EMAIL}")
    else:
        logger.info(f"Super Admin already exists: {settings.FIRST_SUPER_ADMIN_EMAIL}")

    return user


async def init_branches(session: AsyncSession) -> None:
    """Seed initial branches if none exist, and import any distinct branches already assigned to users"""
    default_branches = [
        {"name": "Kochi Branch", "code": "KOC", "city": "Kochi", "address": "Infopark, Kakkanad, Kochi"},
        {"name": "Calicut Branch", "code": "CLT", "city": "Calicut", "address": "Cyberpark, Calicut"},
        {"name": "Trivandrum Branch", "code": "TRV", "city": "Trivandrum", "address": "Technopark, Trivandrum"},
        {"name": "Bangalore Branch", "code": "BLR", "city": "Bangalore", "address": "Electronic City, Bangalore"},
    ]
    for b_data in default_branches:
        existing = await session.execute(select(Branch).where(Branch.name == b_data["name"]))
        if not existing.scalar_one_or_none():
            branch = Branch(
                name=b_data["name"],
                code=b_data["code"],
                city=b_data["city"],
                address=b_data["address"],
                is_active=True,
            )
            session.add(branch)

    # Also capture any distinct branch strings already assigned to users
    user_branches_stmt = select(User.branch).where(User.branch.isnot(None)).distinct()
    user_branches_res = await session.execute(user_branches_stmt)
    user_branch_names = [row[0] for row in user_branches_res.all() if row[0]]
    for b_name in user_branch_names:
        clean_name = b_name.strip()
        if not clean_name:
            continue
        existing = await session.execute(select(Branch).where(Branch.name == clean_name))
        if not existing.scalar_one_or_none():
            branch = Branch(name=clean_name, is_active=True)
            session.add(branch)

    await session.commit()
    logger.info("Branch locations verified/seeded successfully.")


async def init_departments(session: AsyncSession) -> None:
    """Seed initial departments if none exist, and import any distinct departments already assigned to users"""
    default_departments = [
        {"name": "Operations", "code": "OPS", "description": "Operations & Purchase Management"},
        {"name": "Engineering", "code": "ENG", "description": "Software & Technical Engineering"},
        {"name": "Sales", "code": "SALES", "description": "Sales & Client Relations"},
        {"name": "Accounts", "code": "ACC", "description": "Finance & Accounts Administration"},
        {"name": "Logistics", "code": "LOG", "description": "Supply Chain & Wholesale Logistics"},
        {"name": "Marketing", "code": "MKT", "description": "Marketing & Public Relations"},
    ]
    for d_data in default_departments:
        existing = await session.execute(select(Department).where(Department.name == d_data["name"]))
        if not existing.scalar_one_or_none():
            dept = Department(
                name=d_data["name"],
                code=d_data["code"],
                description=d_data["description"],
                is_active=True,
            )
            session.add(dept)

    # Also capture any distinct department strings already assigned to users
    user_dept_stmt = select(User.department).where(User.department.isnot(None)).distinct()
    user_dept_res = await session.execute(user_dept_stmt)
    user_dept_names = [row[0] for row in user_dept_res.all() if row[0]]
    for d_name in user_dept_names:
        clean_name = d_name.strip()
        if not clean_name:
            continue
        existing = await session.execute(select(Department).where(Department.name == clean_name))
        if not existing.scalar_one_or_none():
            dept = Department(name=clean_name, is_active=True)
            session.add(dept)

    await session.commit()
    logger.info("Departments verified/seeded successfully.")


async def init_demo_users(session: AsyncSession) -> None:
    """Seed standard tier demo accounts if not present"""
    demo_users = [
        {
            "email": "admin@example.com",
            "full_name": "Alex Mercer (Admin)",
            "password": "Admin@123",
            "role": Role.ADMIN,
            "branch": "Kochi Branch",
            "department": None,
            "is_purchase_manager": False,
        },
        {
            "email": "incharge@example.com",
            "full_name": "Sarah Connor (In-Charge)",
            "password": "InCharge@123",
            "role": Role.IN_CHARGE,
            "branch": "Kochi Branch",
            "department": "Engineering",
            "is_purchase_manager": False,
        },
        {
            "email": "teamleader@example.com",
            "full_name": "David Miller (Team Leader)",
            "password": "TeamLeader@123",
            "role": Role.TEAM_LEADER,
            "branch": "Kochi Branch",
            "department": "Engineering",
            "is_purchase_manager": False,
        },
        {
            "email": "staff1@example.com",
            "full_name": "John Doe (Staff 1)",
            "password": "Staff@123",
            "role": Role.STAFF,
            "branch": "Kochi Branch",
            "department": "Engineering",
            "is_purchase_manager": False,
        },
        {
            "email": "staff2@example.com",
            "full_name": "Jane Smith (Staff 2)",
            "password": "Staff@123",
            "role": Role.STAFF,
            "branch": "Calicut Branch",
            "department": "Marketing",
            "is_purchase_manager": False,
        },
    ]

    for u_data in demo_users:
        existing = await session.execute(
            select(User).where(User.email == u_data["email"]).order_by(User.created_at.asc())
        )
        user = existing.scalars().first()
        if not user:
            user = User(
                email=u_data["email"],
                full_name=u_data["full_name"],
                hashed_password=get_password_hash(u_data["password"]),
                role=u_data["role"],
                branch=u_data["branch"],
                department=u_data["department"],
                is_purchase_manager=u_data["is_purchase_manager"],
                is_active=True,
            )
            session.add(user)
        else:
            user.branch = u_data["branch"]
            user.department = u_data["department"]
            user.is_purchase_manager = u_data["is_purchase_manager"]

    await session.commit()

    # Wire demo hierarchy reporting lines: staff1 -> teamleader -> incharge -> admin
    admin_u = (await session.execute(select(User).where(User.email == "admin@example.com").order_by(User.created_at.asc()))).scalars().first()
    incharge_u = (await session.execute(select(User).where(User.email == "incharge@example.com").order_by(User.created_at.asc()))).scalars().first()
    tl_u = (await session.execute(select(User).where(User.email == "teamleader@example.com").order_by(User.created_at.asc()))).scalars().first()
    staff1_u = (await session.execute(select(User).where(User.email == "staff1@example.com").order_by(User.created_at.asc()))).scalars().first()

    if admin_u and incharge_u:
        incharge_u.reports_to_id = admin_u.id
    if incharge_u and tl_u:
        tl_u.reports_to_id = incharge_u.id
    if tl_u and staff1_u:
        staff1_u.reports_to_id = tl_u.id

    await session.commit()
    logger.info("Demo hierarchy accounts verified/seeded successfully.")


async def init_warranty_defaults(session: AsyncSession) -> None:
    """Seed initial lookup data for warranty service types, brands, models, and staff if empty"""
    from app.models.warranty import (
        WarrantyBrand,
        WarrantyModel,
        WarrantyServiceType,
        WarrantyStaff,
    )

    # 1. Service Types
    existing_types = (await session.execute(select(WarrantyServiceType))).scalars().first()
    if not existing_types:
        sample_types = [
            ("Warranty Repair", "Standard repair under manufacturer warranty"),
            ("Screen Replacement", "Display and touch panel replacement"),
            ("Hardware Diagnostic", "Full diagnostics and failure analysis"),
            ("Battery Replacement", "Battery test, recalibration or swap"),
            ("Software Flash / OS", "OS reinstall, firmware flash, recovery"),
            ("Motherboard Service", "Chip-level circuit repair and component replacement"),
            ("General Inspection", "Checkup and preventative servicing"),
        ]
        for name, desc in sample_types:
            session.add(WarrantyServiceType(name=name, description=desc))

    # 2. Brands & Models
    existing_brands = (await session.execute(select(WarrantyBrand))).scalars().first()
    if not existing_brands:
        brand_models = {
            "Apple": ["iPhone 15", "iPhone 14", "MacBook Pro M3", "iPad Air 5"],
            "Samsung": ["Galaxy S24 Ultra", "Galaxy S23", "Galaxy Tab S9", "Galaxy A54"],
            "Dell": ["XPS 15", "Latitude 5420", "Inspiron 16", "Alienware m16"],
            "HP": ["Pavilion 15", "Spectre x360", "EliteBook 840", "Omen 16"],
            "Lenovo": ["ThinkPad T14", "IdeaPad Slim 5", "Legion Pro 5"],
            "Asus": ["ROG Zephyrus G14", "ZenBook 14 OLED", "TUF Gaming A15"],
            "Sony": ["Bravia 55 4K", "PlayStation 5", "WH-1000XM5"],
        }
        for b_name, models in brand_models.items():
            brand = WarrantyBrand(name=b_name)
            session.add(brand)
            await session.flush()
            for m_name in models:
                session.add(WarrantyModel(name=m_name, brand_id=brand.id))

    # 3. Staff
    existing_staff = (await session.execute(select(WarrantyStaff))).scalars().first()
    if not existing_staff:
        sample_staff = [
            {
                "name": "Alex Tech (Senior Tech)",
                "phone": "+91 98765 43210",
                "email": "alex.tech@example.com",
            },
            {
                "name": "Rohan Sharma (Service Engineer)",
                "phone": "+91 98765 12345",
                "email": "rohan.s@example.com",
            },
            {
                "name": "Priya Nair (Warranty Specialist)",
                "phone": "+91 98765 67890",
                "email": "priya.n@example.com",
            },
        ]
        for s in sample_staff:
            session.add(WarrantyStaff(**s))

    await session.commit()
    logger.info("Warranty defaults verified/seeded successfully.")

