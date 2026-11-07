import os
from pathlib import Path
from typing import Any, List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.scheduler import scheduler
from app.models.user import Role, User
from app.services.backup_service import BackupService

router = APIRouter()


class BackupItem(BaseModel):
    filename: str
    size_bytes: int
    formatted_size: str
    created_at: str
    is_automated: bool


class BackupStatusResponse(BaseModel):
    schedule: str
    schedule_hour: int
    schedule_minute: int
    backup_directory: str
    total_backups: int
    scheduler_running: bool
    database_name: str
    latest_backup: Any = None


class RestoreResponse(BaseModel):
    success: bool
    message: str
    restored_file: str
    file_size: str
    duration_seconds: float
    safety_backup: Any = None
    restored_at: str


@router.get("/status", response_model=BackupStatusResponse)
async def get_backup_status(
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
) -> Any:
    """
    Returns automated daily backup schedule status, local backup directory,
    and latest backup information. Restrict to Super Admin only.
    """
    backups = BackupService.list_backups()
    latest = backups[0] if backups else None

    return {
        "schedule": f"Every day at {settings.BACKUP_SCHEDULE_HOUR:02d}:{settings.BACKUP_SCHEDULE_MINUTE:02d} (10:00 PM)",
        "schedule_hour": settings.BACKUP_SCHEDULE_HOUR,
        "schedule_minute": settings.BACKUP_SCHEDULE_MINUTE,
        "backup_directory": str(settings.ABSOLUTE_BACKUP_DIR),
        "total_backups": len(backups),
        "scheduler_running": scheduler.running,
        "database_name": settings.POSTGRES_DB,
        "latest_backup": latest,
    }


@router.get("/list", response_model=List[BackupItem])
async def list_backups(
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
) -> Any:
    """
    List all local database backups. Restrict to Super Admin only.
    """
    return BackupService.list_backups()


@router.post("/create", response_model=Any)
async def trigger_manual_backup(
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
) -> Any:
    """
    Trigger an immediate full database backup to the local system. Restrict to Super Admin only.
    """
    return await BackupService.create_backup(tag="manual")


@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
) -> FileResponse:
    """
    Download a local database backup file to the user's machine. Restrict to Super Admin only.
    """
    target = BackupService.get_backup_path(filename)
    return FileResponse(
        path=str(target),
        filename=target.name,
        media_type="application/sql",
    )


@router.post("/restore/upload", response_model=RestoreResponse)
async def restore_from_uploaded_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Restores the database by uploading a backup (.sql) data file from the user's system.
    Restricted strictly to Super Admin only.
    """
    # Rollback current read transaction so table locks are freed
    await session.rollback()

    if not file.filename or not file.filename.lower().endswith((".sql", ".dump", ".backup")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid PostgreSQL backup file (.sql, .dump, .backup).",
        )

    # Save to staging file in backup directory
    safe_name = os.path.basename(file.filename)
    staging_path = settings.ABSOLUTE_BACKUP_DIR / f"upload_restore_{safe_name}"

    try:
        content = await file.read()
        if len(content) < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded backup file is empty or corrupted.",
            )

        with open(staging_path, "wb") as f:
            f.write(content)

        # Execute restore
        result = await BackupService.restore_from_file(staging_path)
        return result
    finally:
        # Clean up uploaded staging file
        if staging_path.exists():
            try:
                staging_path.unlink()
            except Exception:
                pass


@router.post("/restore/existing/{filename}", response_model=RestoreResponse)
async def restore_from_existing_backup(
    filename: str,
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
    session: AsyncSession = Depends(get_db),
) -> Any:
    """
    Restores the database from an existing backup in the local backup directory.
    Restricted strictly to Super Admin only.
    """
    # Rollback current read transaction so table locks are freed
    await session.rollback()
    target = BackupService.get_backup_path(filename)
    return await BackupService.restore_from_file(target)


@router.delete("/{filename}")
async def delete_backup(
    filename: str,
    current_user: User = Depends(require_roles(Role.SUPER_ADMIN)),
) -> Any:
    """
    Deletes an old backup file from the local storage. Restrict to Super Admin only.
    """
    target = BackupService.get_backup_path(filename)
    try:
        target.unlink()
        return {"message": f"Backup '{target.name}' deleted successfully."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not delete backup file: {e}",
        )
