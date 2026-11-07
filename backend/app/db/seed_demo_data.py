import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.init_db import init_models, init_super_admin
from app.db.session import AsyncSessionLocal
from app.models.inventory import InventoryItem
from app.models.purchase_request import (
    PurchaseRequest,
    PurchaseRequestHistory,
    PurchaseRequestStatus,
)
from app.models.task import RecurrencePattern, Task, TaskPriority, TaskStatus
from app.models.task_activity import ActivityAction, TaskActivity
from app.models.task_comment import TaskComment
from app.models.user import Role, User
from app.models.wholesale_customer import WholesaleCustomer
from app.models.wholesale_order import OrderStatus, WholesaleOrder
from app.models.wholesale_product import WholesaleProduct


async def seed_data():
    await init_models()
    async with AsyncSessionLocal() as session:
        # Check / add column is_purchase_manager and can_place_wholesale_orders in users if not present (migration aid)
        try:
            await session.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_purchase_manager BOOLEAN DEFAULT FALSE;"
                )
            )
            await session.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_place_wholesale_orders BOOLEAN DEFAULT FALSE;"
                )
            )
            await session.commit()
        except Exception:
            await session.rollback()

        # 1. Super Admin
        sa = await init_super_admin(session)

        # 2. Admin
        stmt = select(User).where(User.email == "admin@example.com")
        admin = (await session.execute(stmt)).scalar_one_or_none()
        if not admin:
            admin = User(
                email="admin@example.com",
                full_name="Alex Mercer (Admin)",
                hashed_password=get_password_hash("Admin@123"),
                role=Role.ADMIN,
                is_active=True,
                branch="Kochi Branch",
                reports_to_id=sa.id,
                created_by_id=sa.id,
            )
            session.add(admin)
            await session.commit()
            await session.refresh(admin)
        else:
            admin.branch = "Kochi Branch"
            await session.commit()

        # 3. In-Charge
        stmt = select(User).where(User.email == "incharge@example.com")
        incharge = (await session.execute(stmt)).scalar_one_or_none()
        if not incharge:
            incharge = User(
                email="incharge@example.com",
                full_name="Sarah Connor (In-Charge)",
                hashed_password=get_password_hash("InCharge@123"),
                role=Role.IN_CHARGE,
                is_active=True,
                is_purchase_manager=False,
                branch="Kochi Branch",
                department="Engineering",
                reports_to_id=admin.id,
                created_by_id=admin.id,
            )
            session.add(incharge)
            await session.commit()
            await session.refresh(incharge)
        else:
            incharge.is_purchase_manager = False
            incharge.branch = "Kochi Branch"
            incharge.department = "Engineering"
            incharge.reports_to_id = admin.id
            await session.commit()
            await session.refresh(incharge)

        # 4. Team Leader
        stmt = select(User).where(User.email == "teamleader@example.com")
        tl = (await session.execute(stmt)).scalar_one_or_none()
        if not tl:
            tl = User(
                email="teamleader@example.com",
                full_name="David Miller (Team Leader)",
                hashed_password=get_password_hash("TeamLeader@123"),
                role=Role.TEAM_LEADER,
                is_active=True,
                branch="Kochi Branch",
                department="Engineering",
                reports_to_id=incharge.id,
                created_by_id=incharge.id,
            )
            session.add(tl)
            await session.commit()
            await session.refresh(tl)
        else:
            tl.branch = "Kochi Branch"
            tl.department = "Engineering"
            tl.reports_to_id = incharge.id
            await session.commit()

        # 5. Staff 1 & Staff 2
        stmt = select(User).where(User.email == "staff1@example.com")
        staff1 = (await session.execute(stmt)).scalar_one_or_none()
        if not staff1:
            staff1 = User(
                email="staff1@example.com",
                full_name="Emma Watson (Frontend Staff)",
                hashed_password=get_password_hash("Staff@123"),
                role=Role.STAFF,
                is_active=True,
                branch="Kochi Branch",
                department="Engineering",
                reports_to_id=tl.id,
                created_by_id=tl.id,
            )
            session.add(staff1)
        else:
            staff1.branch = "Kochi Branch"
            staff1.department = "Engineering"
            staff1.reports_to_id = tl.id
            await session.commit()

        stmt = select(User).where(User.email == "staff2@example.com")
        staff2 = (await session.execute(stmt)).scalar_one_or_none()
        if not staff2:
            staff2 = User(
                email="staff2@example.com",
                full_name="Liam Neeson (Backend Staff)",
                hashed_password=get_password_hash("Staff@123"),
                role=Role.STAFF,
                is_active=True,
                branch="Kochi Main Branch",
                department="Operations",
                reports_to_id=tl.id,
                created_by_id=tl.id,
            )
            session.add(staff2)
        else:
            if not staff2.branch:
                staff2.branch = "Kochi Main Branch"
            if not staff2.department:
                staff2.department = "Operations"
            await session.commit()

        await session.commit()
        if staff1:
            await session.refresh(staff1)
        if staff2:
            await session.refresh(staff2)

        # 6. Sample Inventory Items
        sample_items = [
            {
                "code": "8901030383921",
                "name": 'Dell UltraSharp 27" 4K USB-C Monitor',
                "rate": 34999.0,
                "category": "Monitors",
                "brand": "Dell",
                "vendor": "TechSource Solutions",
                "quantity": 14,
            },
            {
                "code": "8901234567890",
                "name": 'Apple MacBook Pro 16" (M3 Pro, 36GB, 512GB)',
                "rate": 249900.0,
                "category": "Laptops",
                "brand": "Apple",
                "vendor": "iStore Enterprise",
                "quantity": 8,
            },
            {
                "code": "8909876543210",
                "name": "Logitech MX Master 3S Ergonomic Mouse",
                "rate": 8995.0,
                "category": "Peripherals",
                "brand": "Logitech",
                "vendor": "CompuTech Traders",
                "quantity": 28,
            },
            {
                "code": "8901112223334",
                "name": "Keychron K2 Wireless Mechanical Keyboard (RGB)",
                "rate": 7499.0,
                "category": "Peripherals",
                "brand": "Keychron",
                "vendor": "MechKeyboards India",
                "quantity": 19,
            },
            {
                "code": "8905556667778",
                "name": "Herman Miller Aeron Ergonomic Task Chair",
                "rate": 85000.0,
                "category": "Furniture",
                "brand": "Herman Miller",
                "vendor": "OfficeErgo Supplies",
                "quantity": 11,
            },
            {
                "code": "8909998887776",
                "name": "Anker PowerExpand 8-in-1 USB-C Hub",
                "rate": 4599.0,
                "category": "Accessories",
                "brand": "Anker",
                "vendor": "GadgetMart Wholesale",
                "quantity": 45,
            },
            {
                "code": "8904443332221",
                "name": "Cisco Catalyst 24-Port Managed Gigabit Switch",
                "rate": 42000.0,
                "category": "Networking",
                "brand": "Cisco",
                "vendor": "NetworkPrime Ltd",
                "quantity": 5,
            },
            {
                "code": "8907778889990",
                "name": "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
                "rate": 29990.0,
                "category": "Audio",
                "brand": "Sony",
                "vendor": "Sony Pro Audio",
                "quantity": 16,
            },
        ]

        seeded_inventory = {}
        for it in sample_items:
            stmt = select(InventoryItem).where(InventoryItem.code == it["code"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                inv = InventoryItem(**it)
                session.add(inv)
                await session.flush()
                seeded_inventory[it["code"]] = inv
            else:
                seeded_inventory[it["code"]] = existing

        await session.commit()

        # 7. Sample Purchase Requests
        stmt = select(PurchaseRequest).limit(1)
        existing_pr = (await session.execute(stmt)).scalar_one_or_none()
        if not existing_pr and staff1 and incharge:
            # PR 1: OPEN request submitted by Staff1 for Dell Monitor
            pr1 = PurchaseRequest(
                inventory_item_id=seeded_inventory.get("8901030383921", None).id
                if seeded_inventory.get("8901030383921")
                else None,
                code="8901030383921",
                name='Dell UltraSharp 27" 4K USB-C Monitor',
                rate=34999.0,
                category="Monitors",
                brand="Dell",
                vendor="TechSource Solutions",
                quantity=2,
                requested_by_id=staff1.id,
                purchase_manager_id=incharge.id,
                status=PurchaseRequestStatus.OPEN,
                notes="Required for newly joined design team member.",
            )
            session.add(pr1)
            await session.flush()

            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr1.id,
                    changed_by_id=staff1.id,
                    old_status=None,
                    new_status=PurchaseRequestStatus.OPEN,
                    remarks="Purchase request submitted by Emma Watson (Staff).",
                )
            )

            # PR 2: ORDERED request submitted by Team Leader for Keychron Keyboard
            pr2 = PurchaseRequest(
                inventory_item_id=seeded_inventory.get("8901112223334", None).id
                if seeded_inventory.get("8901112223334")
                else None,
                code="8901112223334",
                name="Keychron K2 Wireless Mechanical Keyboard (RGB)",
                rate=7499.0,
                category="Peripherals",
                brand="Keychron",
                vendor="MechKeyboards India",
                quantity=3,
                requested_by_id=tl.id,
                purchase_manager_id=incharge.id,
                status=PurchaseRequestStatus.ORDERED,
                notes="Dev team batch replacement.",
            )
            session.add(pr2)
            await session.flush()

            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr2.id,
                    changed_by_id=tl.id,
                    old_status=None,
                    new_status=PurchaseRequestStatus.OPEN,
                    remarks="Purchase request submitted by David Miller (Team Leader).",
                )
            )
            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr2.id,
                    changed_by_id=incharge.id,
                    old_status=PurchaseRequestStatus.OPEN,
                    new_status=PurchaseRequestStatus.ORDERED,
                    remarks="PO #40291 placed with MechKeyboards India. ETA: 3 business days.",
                )
            )

            # PR 3: NOT_IN_STOCK request for custom item
            pr3 = PurchaseRequest(
                inventory_item_id=None,
                code="9901239874561",
                name="Specialized Fiber Optic Transceiver SFP+ 10G",
                rate=12500.0,
                category="Networking",
                brand="Ubiquiti",
                vendor="Global Networks Direct",
                quantity=4,
                requested_by_id=staff2.id,
                purchase_manager_id=incharge.id,
                status=PurchaseRequestStatus.NOT_IN_STOCK,
                notes="Direct server rack connection transceiver.",
            )
            session.add(pr3)
            await session.flush()

            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr3.id,
                    changed_by_id=staff2.id,
                    old_status=None,
                    new_status=PurchaseRequestStatus.OPEN,
                    remarks="Purchase request submitted by Liam Neeson (Staff).",
                )
            )
            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr3.id,
                    changed_by_id=incharge.id,
                    old_status=PurchaseRequestStatus.OPEN,
                    new_status=PurchaseRequestStatus.NOT_IN_STOCK,
                    remarks="Vendor contacted: Currently out of stock across regional distributors. Backorder estimated next month.",
                )
            )

            # PR 4: RECEIVED (Completed) request for Logitech Mouse
            pr4 = PurchaseRequest(
                inventory_item_id=seeded_inventory.get("8909876543210", None).id
                if seeded_inventory.get("8909876543210")
                else None,
                code="8909876543210",
                name="Logitech MX Master 3S Ergonomic Mouse",
                rate=8995.0,
                category="Peripherals",
                brand="Logitech",
                vendor="CompuTech Traders",
                quantity=5,
                requested_by_id=admin.id,
                purchase_manager_id=incharge.id,
                status=PurchaseRequestStatus.RECEIVED,
                notes="Requested for office floor 3 workstation upgrade.",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(pr4)
            await session.flush()

            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr4.id,
                    changed_by_id=admin.id,
                    old_status=None,
                    new_status=PurchaseRequestStatus.OPEN,
                    remarks="Purchase request submitted by Alex Mercer (Admin).",
                )
            )
            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr4.id,
                    changed_by_id=incharge.id,
                    old_status=PurchaseRequestStatus.OPEN,
                    new_status=PurchaseRequestStatus.ORDERED,
                    remarks="Order confirmed with vendor.",
                )
            )
            session.add(
                PurchaseRequestHistory(
                    purchase_request_id=pr4.id,
                    changed_by_id=incharge.id,
                    old_status=PurchaseRequestStatus.ORDERED,
                    new_status=PurchaseRequestStatus.RECEIVED,
                    remarks="Goods received and verified at inventory dock. Added to stock.",
                )
            )

            await session.commit()
            print("Demo inventory and purchase requests successfully populated!")

        # --- Wholesale Customers Seeding ---
        cust_stmt = select(WholesaleCustomer)
        existing_custs = (await session.execute(cust_stmt)).scalars().all()
        if not existing_custs:
            cust1 = WholesaleCustomer(
                name="Apex Electronics Ltd",
                place="Mumbai",
                contact_number="+91 98201 12345",
                email="contact@apexelectronics.com",
                address="Plot 42, MIDC Industrial Area, Andheri East, Mumbai",
            )
            cust2 = WholesaleCustomer(
                name="Metro Tech Distributors",
                place="Bangalore",
                contact_number="+91 98450 67890",
                email="sales@metrotech.in",
                address="102 Infantry Road, Tasker Town, Bangalore",
            )
            cust3 = WholesaleCustomer(
                name="Global Retail Enterprises",
                place="Delhi",
                contact_number="+91 98110 54321",
                email="procurement@globalretail.com",
                address="77 Nehru Place Commercial Complex, New Delhi",
            )
            cust4 = WholesaleCustomer(
                name="Prime Hardware Hub",
                place="Hyderabad",
                contact_number="+91 98490 11223",
                email="orders@primehub.co.in",
                address="Unit 5, HITEC City, Madhapur, Hyderabad",
            )
            session.add_all([cust1, cust2, cust3, cust4])
            await session.commit()
            print("Wholesale customers seeded.")

        # --- Wholesale Products Seeding ---
        wp_stmt = select(WholesaleProduct)
        existing_wps = (await session.execute(wp_stmt)).scalars().all()
        if not existing_wps:
            wp1 = WholesaleProduct(
                code="8902001001001",
                name="Dell UltraSharp 27\" 4K Monitor (Bulk Pack)",
                rate=31500.0,
                category="Monitors",
                brand="Dell",
                vendor="Dell Enterprise Distribution",
                quantity=50,
            )
            wp2 = WholesaleProduct(
                code="8902002002002",
                name="Apple MacBook Pro 16\" M3 (Corporate Pack)",
                rate=228000.0,
                category="Laptops",
                brand="Apple",
                vendor="Apple Corporate Channel",
                quantity=30,
            )
            wp3 = WholesaleProduct(
                code="8902003003003",
                name="Logitech MX Master 3S (Wholesale Pack of 10)",
                rate=7200.0,
                category="Peripherals",
                brand="Logitech",
                vendor="Ingram Micro India",
                quantity=100,
            )
            wp4 = WholesaleProduct(
                code="8902004004004",
                name="Keychron K2 Mechanical Keyboard (Bulk)",
                rate=6200.0,
                category="Peripherals",
                brand="Keychron",
                vendor="Meckeys India",
                quantity=80,
            )
            wp5 = WholesaleProduct(
                code="8902005005005",
                name="Anker 8-in-1 USB-C Multiport Dock",
                rate=3900.0,
                category="Accessories",
                brand="Anker",
                vendor="Anker Direct India",
                quantity=150,
            )
            session.add_all([wp1, wp2, wp3, wp4, wp5])
            await session.commit()
            print("Wholesale products seeded.")

        # --- Super Admin Order Permission Grant ---
        # Grant order placement permission to staff1 (Emma) for test flow
        if staff1:
            staff1.can_place_wholesale_orders = True
            await session.commit()

        # --- Sample Wholesale Orders ---
        wo_stmt = select(WholesaleOrder)
        existing_wos = (await session.execute(wo_stmt)).scalars().all()
        if not existing_wos:
            # Fetch cust1 and wp1
            c1 = (await session.execute(select(WholesaleCustomer).where(WholesaleCustomer.name == "Apex Electronics Ltd"))).scalar_one_or_none()
            c2 = (await session.execute(select(WholesaleCustomer).where(WholesaleCustomer.name == "Metro Tech Distributors"))).scalar_one_or_none()
            p1 = (await session.execute(select(WholesaleProduct).where(WholesaleProduct.code == "8902001001001"))).scalar_one_or_none()
            p3 = (await session.execute(select(WholesaleProduct).where(WholesaleProduct.code == "8902003003003"))).scalar_one_or_none()

            if c1 and p1:
                wo1 = WholesaleOrder(
                    order_number="WO-20261019-APEX01",
                    customer_id=c1.id,
                    customer_name=c1.name,
                    place=c1.place,
                    contact_number=c1.contact_number,
                    product_id=p1.id,
                    product_code=p1.code,
                    product_name=p1.name,
                    unit_rate=p1.rate,
                    quantity=5,
                    total_amount=p1.rate * 5,
                    status=OrderStatus.CONFIRMED,
                    notes="Urgent corporate delivery for software branch.",
                    placed_by_id=staff1.id if staff1 else sa.id,
                )
                session.add(wo1)

            if c2 and p3:
                wo2 = WholesaleOrder(
                    order_number="WO-20261019-METRO02",
                    customer_id=c2.id,
                    customer_name=c2.name,
                    place=c2.place,
                    contact_number=c2.contact_number,
                    product_id=p3.id,
                    product_code=p3.code,
                    product_name=p3.name,
                    unit_rate=p3.rate,
                    quantity=12,
                    total_amount=p3.rate * 12,
                    status=OrderStatus.PENDING,
                    notes="Standard monthly restocking.",
                    placed_by_id=sa.id,
                )
                session.add(wo2)

            await session.commit()
            print("Sample wholesale orders seeded.")


if __name__ == "__main__":
    asyncio.run(seed_data())
