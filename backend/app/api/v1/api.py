from fastapi import APIRouter

from app.api.v1.endpoints import (
    approvals,
    auth,
    backup,
    branches,
    checklist,
    departments,
    hierarchy,
    inventory,
    purchase_requests,
    stats,
    tasks,
    users,
    wholesale,
    realtime,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users & Hierarchy"])
api_router.include_router(branches.router, prefix="/branches", tags=["Branch Management"])
api_router.include_router(departments.router, prefix="/departments", tags=["Department Management"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["Approvals"])
api_router.include_router(hierarchy.router, prefix="/hierarchy", tags=["Hierarchy"])
api_router.include_router(stats.router, prefix="/stats", tags=["Dashboard Statistics"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(
    purchase_requests.router, prefix="/purchase-requests", tags=["Purchase Requests"]
)
api_router.include_router(
    wholesale.router, prefix="/wholesale", tags=["Wholesale Management"]
)
api_router.include_router(
    checklist.router, prefix="/checklist", tags=["Checklist & Quick Tasks"]
)
api_router.include_router(
    backup.router, prefix="/backup", tags=["Database Backup & Restore"]
)
api_router.include_router(
    realtime.router, prefix="/realtime", tags=["Realtime Synchronization"]
)
