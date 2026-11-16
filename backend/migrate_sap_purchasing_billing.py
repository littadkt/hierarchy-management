import asyncio
import os
import sys

# Ensure backend root is on PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
import app.models  # ensure all models are registered
from app.services.sap_service import SapService

async def main():
    print("Connecting to database and creating SAP enterprise tables if not exists...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully!")

    print("Seeding SAP default enterprise data...")
    async with AsyncSessionLocal() as session:
        await SapService.ensure_sap_core_defaults(session)
    print("SAP core defaults seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
