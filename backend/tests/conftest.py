import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.deps import get_db
from app.core.config import settings
from app.db.base import Base
from app.db.init_db import init_branches, init_demo_users, init_departments, init_super_admin
from app.main import app

test_engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    poolclass=NullPool,
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from app.db import session as db_session_module
db_session_module.engine = test_engine
db_session_module.AsyncSessionLocal = TestSessionLocal
app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        await init_super_admin(session)
        await init_branches(session)
        await init_departments(session)
        await init_demo_users(session)
        from app.models.user import User, Role
        from app.core.security import get_password_hash
        from sqlalchemy import select

        existing = await session.execute(
            select(User).where(User.email == "superadmin@example.com")
        )
        if not existing.scalar_one_or_none():
            sa = User(
                email="superadmin@example.com",
                full_name="Primary Super Admin",
                hashed_password=get_password_hash("SuperAdmin@123"),
                role=Role.SUPER_ADMIN,
                is_active=True,
                reports_to_id=None,
                created_by_id=None,
            )
            session.add(sa)
            await session.commit()

    yield
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

