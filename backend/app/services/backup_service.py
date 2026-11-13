import asyncio
import logging
import os
from pathlib import Path
import shutil
import subprocess
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


def get_resolved_db_host() -> str:
    """
    On Windows and local setups, 'localhost' can resolve to IPv6 (::1) which
    PostgreSQL may reject if only configured for IPv4 loopback (127.0.0.1).
    Returns 127.0.0.1 for local connections to avoid DNS/IPv6 connection failure.
    """
    host = settings.POSTGRES_SERVER or "127.0.0.1"
    if host.lower() in ["localhost", "127.0.0.1"]:
        return "127.0.0.1"
    return host


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
                Path(os.environ.get("LOCALAPPDATA", r"C:\Users\Default\AppData\Local")) / "Programs" / "PostgreSQL",
                Path(r"C:\PostgreSQL"),
                Path(r"C:\tools\postgresql"),
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
                            candidate_direct = v / f"{tool_name}.exe"
                            if candidate_direct.is_file():
                                return str(candidate_direct)
                    except Exception as e:
                        logger.warning(f"Error scanning {root} for postgres binaries: {e}")

        # Fallback check
        resolved = shutil.which(f"{tool_name}.exe") if sys.platform == "win32" else shutil.which(tool_name)
        if resolved and Path(resolved).is_file():
            return resolved

        # If binary is not found, raise actionable HTTPException
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"PostgreSQL command-line tool '{tool_name}' was not found on this server. "
                f"Please ensure PostgreSQL is installed and configure POSTGRES_BIN_PATH in backend/.env "
                f"(e.g. POSTGRES_BIN_PATH=\"C:\\Program Files\\PostgreSQL\\18\\bin\")."
            ),
        )

    @staticmethod
    async def create_backup(tag: str = "manual") -> Dict[str, Any]:
        """
        Executes pg_dump to backup the full database into the local backups folder.
        Uses asyncio.to_thread with subprocess.run to guarantee event loop compatibility
        across Windows Proactor and Selector event loops.
        """
        backup_dir = settings.ABSOLUTE_BACKUP_DIR
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"backup_{settings.POSTGRES_DB}_{tag}_{timestamp_str}.sql"
        filepath = backup_dir / filename

        pg_dump_bin = BackupService.find_pg_binary("pg_dump")
        db_host = get_resolved_db_host()
        logger.info(f"Using pg_dump binary: {pg_dump_bin} (host: {db_host}) to create backup: {filepath}")

        # Configure environment with DB password
        env = os.environ.copy()
        env["PGPASSWORD"] = settings.POSTGRES_PASSWORD
        env["PGCLIENTENCODING"] = "UTF8"

        cmd = [
            pg_dump_bin,
            "-h", db_host,
            "-p", str(settings.POSTGRES_PORT),
            "-U", settings.POSTGRES_USER,
            "-d", settings.POSTGRES_DB,
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-acl",
            "-f", str(filepath.resolve()),
        ]

        # Execute subprocess safely via asyncio.to_thread
        start_time = datetime.now()
        try:
            proc = await asyncio.to_thread(
                subprocess.run,
                cmd,
                env=env,
                capture_output=True,
                check=False,
            )
            stdout = proc.stdout
            stderr = proc.stderr
        except Exception as e:
            logger.error(f"Failed to launch pg_dump process: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to start PostgreSQL pg_dump process: {e}",
            )

        duration_sec = (datetime.now() - start_time).total_seconds()

        if proc.returncode != 0:
            error_msg = stderr.decode("utf-8", errors="replace").strip()
            logger.error(f"pg_dump failed with code {proc.returncode}: {error_msg}")
            # If empty file was created, clean it up
            if filepath.exists() and filepath.stat().st_size == 0:
                filepath.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database backup failed (code {proc.returncode}): {error_msg}",
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
            "filepath": str(filepath.resolve()),
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
        return target.resolve()

    @staticmethod
    async def restore_from_file(file_path: Path) -> Dict[str, Any]:
        """
        Restores the full PostgreSQL database from a chosen .sql or .dump file.
        Takes an automatic safety backup prior to restoring.
        Ensures tables, Super Admin, and seeds are verified in the finally block
        so the database is never left in an uninitialized or broken state.
        """
        if not file_path.is_file() or file_path.stat().st_size < 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or empty backup file provided.",
            )

        logger.warning(f"Initiating full database restore from '{file_path.name}'...")

        # Pause APScheduler during restore so recurring tasks worker doesn't conflict
        is_scheduler_running = False
        try:
            from app.core.scheduler import scheduler
            if scheduler.running:
                scheduler.pause()
                is_scheduler_running = True
                logger.info("Background recurrence scheduler paused during restore.")
        except Exception as e:
            logger.warning(f"Could not pause scheduler: {e}")

        safety_snapshot = None
        try:
            # 1. Take a safety snapshot of the database prior to restore
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

            db_host = get_resolved_db_host()

            # Terminate lingering connection from other workers/requests to clear exclusive locks
            import asyncpg
            try:
                conn = await asyncpg.connect(
                    host=db_host,
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

            # 3. Clean 'public' schema with CASCADE so that all existing tables, foreign keys,
            # types, and sequences are wiped clean. This prevents 'relation already exists',
            # constraint dependency failures, and duplicate key errors during restore.
            try:
                clean_conn = await asyncpg.connect(
                    host=db_host,
                    port=settings.POSTGRES_PORT,
                    user=settings.POSTGRES_USER,
                    password=settings.POSTGRES_PASSWORD,
                    database=settings.POSTGRES_DB,
                )
                await clean_conn.execute("""
                    DROP SCHEMA IF EXISTS public CASCADE;
                    CREATE SCHEMA public;
                    GRANT ALL ON SCHEMA public TO CURRENT_USER;
                    GRANT ALL ON SCHEMA public TO public;
                """)
                await clean_conn.close()
                logger.info("Schema 'public' dropped with CASCADE and recreated cleanly for fresh restoration.")
            except Exception as e:
                logger.warning(f"Could not drop public schema with CASCADE: {e}")

            # 4. Determine whether input file is a custom binary PostgreSQL archive (PGDMP) or plain SQL
            is_binary_dump = False
            try:
                with open(file_path, "rb") as f:
                    header = f.read(8)
                    if header.startswith(b"PGDMP"):
                        is_binary_dump = True
            except Exception as e:
                logger.warning(f"Error checking backup file header: {e}")

            env = os.environ.copy()
            env["PGPASSWORD"] = settings.POSTGRES_PASSWORD
            env["PGCLIENTENCODING"] = "UTF8"

            if is_binary_dump:
                pg_restore_bin = BackupService.find_pg_binary("pg_restore")
                logger.info(f"Using pg_restore binary: {pg_restore_bin} for custom archive restore operation")
                cmd = [
                    pg_restore_bin,
                    "-h", db_host,
                    "-p", str(settings.POSTGRES_PORT),
                    "-U", settings.POSTGRES_USER,
                    "-d", settings.POSTGRES_DB,
                    "--no-owner",
                    "--no-acl",
                    str(file_path.resolve()),
                ]
            else:
                psql_bin = BackupService.find_pg_binary("psql")
                logger.info(f"Using psql binary: {psql_bin} with ON_ERROR_STOP=1 for SQL restore operation")
                cmd = [
                    psql_bin,
                    "-h", db_host,
                    "-p", str(settings.POSTGRES_PORT),
                    "-U", settings.POSTGRES_USER,
                    "-d", settings.POSTGRES_DB,
                    "-v", "ON_ERROR_STOP=1",
                    "-f", str(file_path.resolve()),
                ]

            start_time = datetime.now()
            try:
                proc = await asyncio.to_thread(
                    subprocess.run,
                    cmd,
                    env=env,
                    capture_output=True,
                    check=False,
                )
                stdout = proc.stdout
                stderr = proc.stderr
            except Exception as e:
                logger.error(f"Failed to launch restore subprocess: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to start restore process: {e}",
                )

            duration_sec = (datetime.now() - start_time).total_seconds()
            stderr_str = stderr.decode("utf-8", errors="replace").strip()

            # For pg_restore, exit code 1 indicates non-fatal notices/warnings (e.g. dropping non-existent tables)
            # For psql with ON_ERROR_STOP=1, non-zero exit code indicates a fatal SQL error
            is_fatal_error = (proc.returncode > 1) if is_binary_dump else (proc.returncode != 0)
            if is_fatal_error:
                error_msg = stderr_str or f"Database restore process exited with failure code {proc.returncode}."
                logger.error(f"Database restore failed with code {proc.returncode}: {error_msg}")
                
                # If safety snapshot was taken, attempt rollback to pre-restore snapshot
                if safety_snapshot and Path(safety_snapshot["filepath"]).is_file():
                    try:
                        logger.warning(f"Rolling back to safety snapshot '{safety_snapshot['filename']}'...")
                        rb_cmd = [
                            psql_bin,
                            "-h", db_host,
                            "-p", str(settings.POSTGRES_PORT),
                            "-U", settings.POSTGRES_USER,
                            "-d", settings.POSTGRES_DB,
                            "-f", safety_snapshot["filepath"],
                        ]
                        await asyncio.to_thread(subprocess.run, rb_cmd, env=env, capture_output=True, check=False)
                    except Exception as rb_err:
                        logger.error(f"Rollback to safety snapshot failed: {rb_err}")

                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database restore failed (code {proc.returncode}): {error_msg}",
                )

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

        finally:
            # 4. ALWAYS re-verify database tables, super admin, branches, departments, warranty defaults
            try:
                from app.db.init_db import (
                    init_branches,
                    init_departments,
                    init_models,
                    init_super_admin,
                    init_warranty_defaults,
                )
                from app.db.session import AsyncSessionLocal
                await init_models()
                async with AsyncSessionLocal() as session:
                    await init_super_admin(session)
                    await init_branches(session)
                    await init_departments(session)
                    await init_warranty_defaults(session)
                logger.info("Post-restore verification and schema sync completed successfully.")
            except Exception as e:
                logger.warning(f"Post-restore verification warning: {e}")

            # Clear connection pool to ensure fresh pool connections to restored tables
            from app.db.session import engine
            try:
                await engine.dispose()
            except Exception:
                pass

            # Resume scheduler
            if is_scheduler_running:
                try:
                    from app.core.scheduler import scheduler
                    scheduler.resume()
                    logger.info("Background recurrence scheduler resumed.")
                except Exception as e:
                    logger.warning(f"Could not resume scheduler: {e}")
