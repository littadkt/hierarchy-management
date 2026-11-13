import sys
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

pool_kwargs = (
    {"poolclass": NullPool}
    if ("pytest" in sys.modules or getattr(settings, "ENVIRONMENT", "") == "test")
    else {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20}
)

connect_args = {
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0,
    "server_settings": {
        "search_path": "public",
    },
}

engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    echo=False,
    future=True,
    connect_args=connect_args,
    **pool_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    session = AsyncSessionLocal()
    try:
        yield session
    except Exception:
        try:
            await session.rollback()
        except Exception:
            try:
                await session.invalidate()
            except Exception:
                pass
        raise
    finally:
        try:
            await session.close()
        except Exception:
            try:
                await session.invalidate()
                await session.close()
            except Exception:
                pass

