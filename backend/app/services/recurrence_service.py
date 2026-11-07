from datetime import datetime, timedelta, timezone
from typing import List, Optional, Set, Union
import calendar

from app.models.task import RecurrencePattern, Task


def parse_days_of_week(days_val: Union[str, List[int], Set[int], None]) -> Optional[List[int]]:
    """
    Parses various representations of days of the week into a sorted list of unique ints [0..6].
    0 = Monday, ..., 6 = Sunday.
    """
    if days_val is None:
        return None
    if isinstance(days_val, str):
        if not days_val.strip():
            return None
        parsed = [int(x.strip()) for x in days_val.split(",") if x.strip().isdigit()]
        clean = sorted(list(set(x for x in parsed if 0 <= x <= 6)))
        return clean if clean else None
    if isinstance(days_val, (list, set, tuple)):
        clean = sorted(list(set(int(x) for x in days_val if 0 <= int(x) <= 6)))
        return clean if clean else None
    return None


def calculate_next_run_date(
    pattern: RecurrencePattern,
    interval: int,
    base_date: Optional[datetime] = None,
    day_of_week: Optional[int] = None,
    day_of_month: Optional[int] = None,
    days_of_week: Optional[Union[str, List[int], Set[int]]] = None,
) -> Optional[datetime]:
    if not base_date:
        base_date = datetime.now(timezone.utc)

    if pattern == RecurrencePattern.NONE:
        return None

    # Parse and normalize active days of week
    active_days = parse_days_of_week(days_of_week)
    if active_days is None and day_of_week is not None and 0 <= day_of_week <= 6:
        active_days = [day_of_week]

    interval = max(interval, 1)

    if pattern == RecurrencePattern.DAILY:
        # If specific days of week are selected (e.g. Mon-Sat, avoiding Sunday)
        if active_days:
            allowed = set(active_days)
            curr = base_date + timedelta(days=1)
            for _ in range(365):
                if curr.weekday() in allowed:
                    return curr
                curr += timedelta(days=1)
            return None
        return base_date + timedelta(days=interval)

    if pattern == RecurrencePattern.WEEKLY:
        if active_days:
            allowed = set(active_days)
            curr = base_date + timedelta(days=1)
            for _ in range(365 * max(interval, 1)):
                if curr.weekday() in allowed:
                    return curr
                curr += timedelta(days=1)
            return None

        # Fallback to single legacy day_of_week or same weekday
        candidate = base_date + timedelta(weeks=interval)
        if day_of_week is not None and 0 <= day_of_week <= 6:
            current_dow = candidate.weekday()
            delta_days = (day_of_week - current_dow) % 7
            candidate = candidate + timedelta(days=delta_days)
        return candidate

    if pattern == RecurrencePattern.MONTHLY:
        # Advance by interval months
        year = base_date.year
        month = base_date.month + interval
        while month > 12:
            year += 1
            month -= 12

        target_day = day_of_month if day_of_month is not None else base_date.day
        max_days = calendar.monthrange(year, month)[1]
        clamped_day = min(target_day, max_days)

        return base_date.replace(
            year=year,
            month=month,
            day=clamped_day,
        )

    if pattern == RecurrencePattern.CUSTOM:
        if active_days:
            allowed = set(active_days)
            curr = base_date + timedelta(days=interval)
            for _ in range(365):
                if curr.weekday() in allowed:
                    return curr
                curr += timedelta(days=1)
            return None
        return base_date + timedelta(days=interval)

    return None


def should_spawn_recurrence(task: Task, next_date: Optional[datetime]) -> bool:
    if not task.is_recurring:
        return False
    if next_date is None:
        return False
    if task.recurrence_end_date and next_date > task.recurrence_end_date:
        return False
    return True
