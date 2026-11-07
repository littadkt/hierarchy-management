import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.task import RecurrencePattern, Task, TaskPriority, TaskStatus
from app.models.task_activity import ActivityAction, TaskActivity
from app.services.recurrence_service import calculate_next_run_date, should_spawn_recurrence

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_and_spawn_recurring_tasks():
    """Background job checking for scheduled recurring tasks that are due for generation"""
    async with AsyncSessionLocal() as session:
        try:
            from app.services.task_service import TaskService
            spawned = await TaskService.spawn_due_recurring_tasks(session)
            if spawned:
                logger.info(f"Spawned {len(spawned)} due recurring task(s) on schedule.")
        except Exception as e:
            logger.error(f"Error checking recurring tasks: {e}")
            await session.rollback()


async def run_daily_backup_job():
    """Background job executed daily at 10:00 PM (22:00) to backup full database"""
    logger.info("Executing automated daily database backup (10:00 PM)...")
    try:
        from app.services.backup_service import BackupService
        result = await BackupService.create_backup(tag="daily")
        logger.info(
            f"Daily 10:00 PM database backup completed successfully: {result['filename']} ({result['formatted_size']})"
        )
    except Exception as e:
        logger.error(f"Scheduled daily database backup encountered an error: {e}")


def start_scheduler():
    """Start background scheduler for recurring tasks and daily 10:00 PM backups"""
    if not scheduler.running:
        # Recurring task runner (every minute)
        scheduler.add_job(
            check_and_spawn_recurring_tasks,
            "interval",
            minutes=1,
            id="recurring_task_runner",
            replace_existing=True,
        )

        # Full database backup every day at 10:00 PM (22:00)
        scheduler.add_job(
            run_daily_backup_job,
            CronTrigger(hour=settings.BACKUP_SCHEDULE_HOUR, minute=settings.BACKUP_SCHEDULE_MINUTE),
            id="daily_database_backup",
            replace_existing=True,
        )

        scheduler.start()
        logger.info(
            f"Scheduler started with recurring tasks worker and daily database backup at "
            f"{settings.BACKUP_SCHEDULE_HOUR:02d}:{settings.BACKUP_SCHEDULE_MINUTE:02d}."
        )


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Recurrence scheduler stopped.")

