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


async def check_checkout_reminders():
    """Background job checking for employees nearing checkout time to remind them to check out."""
    async with AsyncSessionLocal() as session:
        try:
            from sqlalchemy import func
            from app.models.attendance import Attendance
            from app.models.notification import Notification
            from app.models.user import User
            from app.services.notification_service import NotificationService
            from app.services.attendance_service import AttendanceService

            today = AttendanceService.get_today_date_str()
            # Active attendances for today where user hasn't checked out yet
            stmt = (
                select(Attendance)
                .options(selectinload(Attendance.user).selectinload(User.schedule))
                .where(
                    Attendance.date == today,
                    Attendance.check_in_time.isnot(None),
                    Attendance.check_out_time.is_(None),
                )
            )
            records = (await session.execute(stmt)).scalars().all()
            if not records:
                return

            now_local = datetime.now().astimezone()
            actual_total_mins = now_local.hour * 60 + now_local.minute

            for att in records:
                user = att.user
                if not user:
                    continue

                sched_out = att.schedule_check_out or (
                    user.check_out_time or (user.schedule.check_out_time if user.schedule else None)
                )
                if not sched_out or ":" not in sched_out:
                    continue

                try:
                    parts = sched_out.strip().split(":")
                    sched_total_mins = int(parts[0]) * 60 + int(parts[1])
                    diff_mins = sched_total_mins - actual_total_mins

                    # Remind user when within 15 minutes before checkout or up to 30 mins after checkout
                    if -30 <= diff_mins <= 15:
                        start_of_today = datetime(
                            now_local.year, now_local.month, now_local.day, 0, 0, 0, tzinfo=now_local.tzinfo
                        )
                        existing_stmt = select(func.count(Notification.id)).where(
                            Notification.user_id == user.id,
                            Notification.type == "CHECKOUT_REMINDER",
                            Notification.created_at >= start_of_today,
                        )
                        already_sent = (await session.execute(existing_stmt)).scalar_one() or 0
                        if already_sent == 0:
                            if diff_mins > 0:
                                msg = f"Your scheduled check-out time is {sched_out} ({diff_mins} mins remaining). Please submit your daily checklist and check out!"
                            elif diff_mins == 0:
                                msg = f"It's {sched_out} — scheduled end of your shift! Please submit your daily checklist and remember to check out."
                            else:
                                msg = f"Your scheduled shift ended at {sched_out}. If you have finished your work, please check out now!"

                            await NotificationService.create(
                                session=session,
                                user_id=user.id,
                                title="Check-out Reminder",
                                message=msg,
                                notification_type="CHECKOUT_REMINDER",
                                link="/attendance",
                            )
                            logger.info(f"Sent checkout reminder to {user.full_name} for {sched_out}")
                except Exception as ex:
                    logger.warning(f"Error evaluating checkout reminder for user {user.id}: {ex}")
        except Exception as e:
            logger.error(f"Error in check_checkout_reminders job: {e}")
            await session.rollback()


def start_scheduler():
    """Start background scheduler for recurring tasks, checkout reminders, and daily 10:00 PM backups"""
    if not scheduler.running:
        # Recurring task runner (every minute)
        scheduler.add_job(
            check_and_spawn_recurring_tasks,
            "interval",
            minutes=1,
            id="recurring_task_runner",
            replace_existing=True,
        )

        # Checkout reminder runner (every minute)
        scheduler.add_job(
            check_checkout_reminders,
            "interval",
            minutes=1,
            id="checkout_reminder_runner",
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

