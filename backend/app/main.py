import sys
from pathlib import Path

# Add backend directory to sys.path so 'import app...' works from any working directory
_backend_dir = str(Path(__file__).resolve().parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.permissions import HierarchyPermissionError
from app.core.scheduler import start_scheduler, stop_scheduler
from app.db.init_db import (
    init_branches,
    init_demo_users,
    init_departments,
    init_models,
    init_super_admin,
    init_warranty_defaults,
)
from app.db.session import AsyncSessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Initializing database models...")
    await init_models()

    logger.info("Checking initial Super Admin seed, branches, and departments...")
    async with AsyncSessionLocal() as session:
        await init_super_admin(session)
        await init_branches(session)
        await init_departments(session)
        await init_demo_users(session)
        await init_warranty_defaults(session)

    logger.info("Starting background recurrence scheduler...")
    try:
        start_scheduler()
    except Exception as e:
        logger.warning(f"Could not start background scheduler: {e}")

    logger.info("Ensuring all due and upcoming recurring tasks are initialized upon startup...")
    async with AsyncSessionLocal() as session:
        try:
            from app.services.task_service import TaskService
            await TaskService.spawn_due_recurring_tasks(session)
        except Exception as e:
            logger.warning(f"Could not spawn recurring tasks on startup: {e}")

    yield

    # Shutdown actions
    logger.info("Shutting down background scheduler...")
    stop_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Injects OWASP security headers to protect private network deployment
    against clickjacking, MIME sniffing, and side-channel cross-origin leaks.
    """
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=()"
    return response


@app.exception_handler(HierarchyPermissionError)
async def hierarchy_permission_exception_handler(request: Request, exc: HierarchyPermissionError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_type": "HierarchyPermissionError"},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    tb = traceback.format_exc()
    logger.error(f"Global unhandled exception on {request.method} {request.url}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )


# Root route redirects to Swagger UI
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get(f"{settings.API_V1_STR}/docs", include_in_schema=False)
async def api_v1_docs():
    return RedirectResponse(url="/docs")


# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


# Include V1 Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


