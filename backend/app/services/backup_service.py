import asyncio
import logging
import os
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def format_file_size(size_in_bytes: int) -> str:
    """Return human readable file size"""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.1f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.1f} TB"


class BackupService:
    @staticmethod
    def find_pg_binary(tool_name: str) -> str:
        """
        Locates PostgreSQL binaries (pg_dump, psql, pg_restore) in:
        1. settings.POSTGRES_BIN_PATH (if defined in .env)
        2. System PATH
        3. Common PostgreSQL installations on Windows (e.g. C:\\Program Files\\PostgreSQL\\*\\bin)
        """
        # 1. Custom settings bin path
        if settings.POSTGRES_BIN_PATH:
            p = Path(settings.POSTGRES_BIN_PATH) / tool_name
            if p.is_file():
                return str(p)
            p_exe = Path(settings.POSTGRES_BIN_PATH) / f"{tool_name}.exe"
            if p_exe.is_file():
                return str(p_exe)

        # 2. System PATH
        in_path = shutil.which(tool_name)
        if in_path:
            return in_path

        # 3. Windows standard installations (check version 18, 17, 16, 15, 14, 13...)
        if sys.platform == "win32":
            common_roots = [
                Path(r"C:\Program Files\PostgreSQL"),
                Path(r"C:\Program Files (x86)\PostgreSQL"),
            ]
            for root in common_roots:
                if root.is_dir():
                    try:
                        # Find all directories like '18', '17' sorted descending
                        ver_dirs = sorted([d for d in root.iterdir() if d.is_dir()], reverse=True)
                        for v in ver_dirs:
                            candidate = v / "bin" / f"{tool_name}.exe"
                            if candidate.is_file():
                                return str(candidate)
                    except Exception as e:
                        logger.warning(f"Error scanning {root} for postgres binaries: {e}")

        # Fallback to plain binary name
        return tool_name

    @staticmethod
    async def create_backup(tag: str = "manual") -> Dict[str, Any]:
        """
        Executes pg_dump to backup the full database into the local backups folder.
        Ensures all tables, branches, and departments are initialized before dumping.
        """
        # Ensure branches and departments are seeded and committed prior to dump
        try:
            from app.db.init_db import init_branches, init_departments
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                await init_branches(session)
                await init_departments(session)
        except Exception as e:
            logger.warning(f"Pre-backup verification warning: {e}")

        backup_dir = settings.ABSOLUTE_BACKUP_DIR
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"backup_{settings.POSTGRES_DB}_{tag}_{timestamp_str}.sql"
        filepath = backup_dir / filename

        pg_dump_bin = BackupService.find_pg_binary("pg_dump")
        logger.info(f"Using pg_dump binary: {pg_dump_bin} to create backup: {filepath}")

        # Configure environment with DB password
        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

        cmd = [
            pg_dump_bin,
            "-h", settings.POSTGRES_SERVER,
            "-p", str(settings.POSTGRES_PORT),
            "-U", settings.POSTGRES_USER,
            "-d", settings.POSTGRES_DB,
            "--clean",
            "--if-exists",
            "-f", str(filepath),
        ]

        # Execute async subprocess
        start_time = datetime.now()
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        duration_sec = (datetime.now() - start_time).total_seconds()

        if proc.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="replace").strip()
            logger.error(f"pg_dump failed with code {proc.returncode}: {error_msg}")
            # If empty file was created, clean it up
            if filepath.exists() and filepath.stat().st_size == 0:
                filepath.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database backup failed: {error_msg}",
            )

        if not filepath.exists() or filepath.stat().st_size == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database backup completed but target file is empty or missing.",
            )

        file_stat = filepath.stat()
        file_size = file_stat.st_size
        logger.info(
            f"Database backup '{filename}' created successfully. Size: {format_file_size(file_size)} in {duration_sec:.2f}s"
        )

        return {
            "filename": filename,
            "filepath": str(filepath),
            "size_bytes": file_size,
            "formatted_size": format_file_size(file_size),
            "created_at": datetime.fromtimestamp(file_stat.st_mtime, timezone.utc).isoformat(),
            "tag": tag,
            "duration_seconds": round(duration_sec, 2),
            "is_automated": tag in ["daily", "auto", "scheduled"],
        }

    @staticmethod
    def list_backups() -> List[Dict[str, Any]]:
        """
        Lists all existing database backup files in the local backup directory.
        """
        backup_dir = settings.ABSOLUTE_BACKUP_DIR
        if not backup_dir.exists():
            return []

        backups = []
        for file in backup_dir.iterdir():
            if file.is_file() and file.suffix.lower() in [".sql", ".dump", ".backup"]:
                try:
                    stat = file.stat()
                    is_auto = any(k in file.name.lower() for k in ["daily", "auto", "scheduled"])
                    backups.append({
                        "filename": file.name,
                        "size_bytes": stat.st_size,
                        "formatted_size": format_file_size(stat.st_size),
                        "created_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                        "is_automated": is_auto,
                    })
                except Exception as e:
                    logger.warning(f"Error reading file stats for {file.name}: {e}")

        # Sort newest first
        backups.sort(key=lambda b: b["created_at"], reverse=True)
        return backups

    @staticmethod
    def get_backup_path(filename: str) -> Path:
        """
        Validates and returns the safe absolute path for a requested backup file.
        Prevents path traversal attacks.
        """
        safe_name = os.path.basename(filename.strip())
        target = settings.ABSOLUTE_BACKUP_DIR / safe_name
        if not target.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Backup file '{safe_name}' not found.",
            )
        return target

    @staticmethod
    async def restore_from_file(file_path: Path) -> Dict[str, Any]:
        """
        Restores the full PostgreSQL database from a chosen .sql file.
        Takes an automatic safety backup prior to restoring.
        """
        if not file_path.is_file() or file_path.stat().st_size < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or empty backup file provided.",
            )

        logger.warning(f"Initiating full database restore from '{file_path.name}'...")

        # 1. Take a safety snapshot of the database prior to restore
        safety_snapshot = None
        try:
            safety_snapshot = await BackupService.create_backup(tag="safety_pre_restore")
            logger.info(f"Safety pre-restore backup created: {safety_snapshot['filename']}")
        except Exception as e:
            logger.warning(f"Could not take safety pre-restore backup: {e}")

        # 2. Release active database connection pool & terminate lingering locks
        from app.db.session import engine
        try:
            await engine.dispose()
            logger.info("Database connection pool disposed prior to restore.")
        except Exception as e:
            logger.warning(f"Error disposing connection pool: {e}")

        # Terminate any lingering connection from other workers/requests to clear exclusive locks
        import asyncpg
        try:
            conn = await asyncpg.connect(
                host=settings.POSTGRES_SERVER,
                port=settings.POSTGRES_PORT,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                database="postgres",
            )
            await conn.execute(f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = '{settings.POSTGRES_DB}'
                  AND pid <> pg_backend_pid();
            """)
            await conn.close()
            logger.info("Lingering database sessions terminated to allow exclusive table lock for restore.")
        except Exception as e:
            logger.warning(f"Could not terminate existing connections: {e}")

        # 3. Locate psql binary
        psql_bin = BackupService.find_pg_binary("psql")
        logger.info(f"Using psql binary: {psql_bin} for restore operation")

        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

        cmd = [
            psql_bin,
            "-h", settings.POSTGRES_SERVER,
            "-p", str(settings.POSTGRES_PORT),
            "-U", settings.POSTGRES_USER,
            "-d", settings.POSTGRES_DB,
            "-f", str(file_path),
        ]

        start_time = datetime.now()
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        duration_sec = (datetime.now() - start_time).total_seconds()

        stderr_str = stderr.decode("utf-8", errors="replace").strip()
        # psql prints NOTICE and clean DROP errors to stderr; fatal errors usually contain 'FATAL:' or return non-zero
        if proc.returncode != 0:
            logger.error(f"psql restore failed with code {proc.returncode}: {stderr_str}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database restore failed with code {proc.returncode}: {stderr_str}",
            )

        # 4. Re-verify database tables, super admin, branches, and departments integrity
        try:
            from app.db.init_db import init_branches, init_departments, init_models, init_super_admin
            from app.db.session import AsyncSessionLocal
            await init_models()
            async with AsyncSessionLocal() as session:
                await init_super_admin(session)
                await init_branches(session)
                await init_departments(session)
        except Exception as e:
            logger.warning(f"Post-restore verification warning: {e}")

        logger.info(f"Full database successfully restored from '{file_path.name}' in {duration_sec:.2f}s")

        return {
            "success": True,
            "message": f"Database successfully restored from {file_path.name}.",
            "restored_file": file_path.name,
            "file_size": format_file_size(file_path.stat().st_size),
            "duration_seconds": round(duration_sec, 2),
            "safety_backup": safety_snapshot["filename"] if safety_snapshot else None,
            "restored_at": datetime.now(timezone.utc).isoformat(),
        }
