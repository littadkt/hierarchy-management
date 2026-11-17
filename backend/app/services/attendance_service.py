from datetime import datetime, timezone
import io
import ipaddress
import logging
import socket
from typing import Any, List, Optional, Tuple, cast
import uuid
from fastapi import HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.broadcaster import broadcaster
from app.core.config import settings
from app.models.attendance import Attendance, AttendanceStatus
from app.models.branch import Branch
from app.models.user import Role, User
from app.schemas.attendance import (
    AttendanceOut,
    AttendanceReportResponse,
    AttendanceReportSummary,
    AttendanceTodayStatus,
)
from app.schemas.schedule import BufferStatusOut

logger = logging.getLogger(__name__)


def get_host_lan_ips() -> List[str]:
    """Retrieve host machine's active non-loopback network IPv4 addresses and global IPv6 prefixes."""
    host_ips: List[str] = []
    try:
        hostname = socket.gethostname()
        for item in socket.getaddrinfo(hostname, None):
            ip_candidate = item[4][0]
            try:
                ip_obj = ipaddress.ip_address(ip_candidate)
                if ip_obj.is_loopback:
                    continue
                if isinstance(ip_obj, ipaddress.IPv4Address) and not ip_candidate.startswith("127."):
                    if ip_candidate not in host_ips:
                        host_ips.append(ip_candidate)
                elif isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.is_global and not ip_obj.is_loopback:
                    net_desc = f"{ipaddress.ip_network(f'{ip_candidate}/64', strict=False)}"
                    if net_desc not in host_ips:
                        host_ips.append(net_desc)
            except ValueError:
                continue
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        routed = s.getsockname()[0]
        s.close()
        if routed and routed not in host_ips and not routed.startswith("127."):
            host_ips.append(routed)
    except Exception:
        pass
    return host_ips


def get_host_ipv6_prefixes() -> List[Any]:
    """Retrieve host machine's active global IPv6 delegated /64 subnets."""
    prefixes: List[Any] = []
    try:
        hostname = socket.gethostname()
        for item in socket.getaddrinfo(hostname, None):
            ip_str = item[4][0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.is_global and not ip_obj.is_loopback:
                    net_64 = ipaddress.ip_network(f"{ip_str}/64", strict=False)
                    if net_64 not in prefixes:
                        prefixes.append(net_64)
            except ValueError:
                continue
    except Exception:
        pass
    return prefixes


def parse_clean_ip(ip_str: Optional[str]) -> Optional[Any]:
    """Parse and clean an IP address, handling ports, brackets, and IPv4-mapped IPv6."""
    if not ip_str:
        return None
    clean = str(ip_str).strip()
    if clean.startswith("["):
        end_b = clean.find("]")
        if end_b != -1:
            clean = clean[1:end_b].strip()
    elif clean.count(":") == 1 and "." in clean:
        clean = clean.split(":")[0].strip()

    if clean.lower().startswith("::ffff:") and "." in clean:
        clean = clean[7:].strip()

    try:
        parsed = ipaddress.ip_address(clean)
        if isinstance(parsed, ipaddress.IPv6Address) and parsed.ipv4_mapped:
            parsed = parsed.ipv4_mapped
        return parsed
    except (ValueError, TypeError):
        return None


def is_ip_in_network(client_ip: Optional[str], allowed_str: Optional[str]) -> bool:
    """
    Check if client_ip matches any authorized office network IP or CIDR block in allowed_str.
    allowed_str can be comma-, semicolon-, or newline-delimited.
    Correctly handles IPv4, IPv6, ports, brackets, and IPv4-mapped IPv6 (::ffff:x.x.x.x).

    Security Rules:
    1. Loopback addresses (127.0.0.1, ::1, localhost) and unspecified (0.0.0.0) NEVER qualify
       as an authorized office network. Network verification FAILS CLOSED.
    2. Missing, empty, or malformed visitor IP strings NEVER receive automatic on-network approval.
    3. Loopback entries inadvertently placed in allowed_str are filtered out and ignored.
    4. Supports exact IPv4/IPv6 addresses and CIDR subnets (e.g. 192.168.100.0/24, 103.70.197.110/32, 2403:a080:836:e5e3::/64).
    5. Recognizes client devices accessing from the same office Wi-Fi network:
       - For IPv6: Device and host share the office router's delegated /64 IPv6 prefix.
       - For IPv4: Client visitor IP matches the host router's active public WAN IP.
    """
    if not client_ip or not allowed_str:
        return False

    c_ip = parse_clean_ip(client_ip)
    if not c_ip:
        return False

    # Security: Localhost loopback addresses (127.0.0.1, ::1) or unspecified addresses
    # must NEVER be approved as office attendance networks!
    if c_ip.is_loopback or c_ip.is_unspecified:
        return False

    entries = [
        e.strip()
        for e in allowed_str.replace(";", ",").replace("\n", ",").split(",")
        if e.strip()
    ]

    # 1. Direct match check against configured allowed IPs / CIDR subnets (IPv4 or IPv6)
    for entry in entries:
        clean_entry = entry.strip()
        if not clean_entry:
            continue

        # Ignore wildcard asterisks or loopback addresses in allowlist
        if clean_entry in ("*", "localhost", "127.0.0.1", "::1", "127.0.0.0/8"):
            continue

        if clean_entry.lower().startswith("::ffff:") and "." in clean_entry:
            clean_entry = clean_entry[7:].strip()

        try:
            net = ipaddress.ip_network(clean_entry, strict=False)
            if net.is_loopback or net.is_unspecified:
                continue

            if c_ip.version == net.version and c_ip in net:
                return True
        except (ValueError, TypeError):
            continue

    # 2. Host Network Subnet Match (IPv6 /64 delegated prefix or IPv4 WAN IP)
    # When employees connect from the office Wi-Fi router to the Cloudflare Tunnel public domain:
    # A) In IPv6 (no NAT): All devices on the office Wi-Fi router share the same /64 delegated prefix.
    # B) In IPv4 (NAT): All devices on the office Wi-Fi router share the same public WAN IP.
    try:
        # IPv6: Verify if visitor's IPv6 address belongs to the host machine's active global /64 prefix
        if isinstance(c_ip, ipaddress.IPv6Address) and c_ip.is_global:
            for host_prefix in get_host_ipv6_prefixes():
                if c_ip in host_prefix:
                    return True

        # IPv4: Verify if visitor's IPv4 matches host server's public WAN IP
        from app.core.ip_utils import get_server_public_ip
        server_wan_ip = get_server_public_ip()
        if server_wan_ip:
            parsed_wan = parse_clean_ip(server_wan_ip)
            if parsed_wan and not parsed_wan.is_loopback and not parsed_wan.is_private and c_ip == parsed_wan:
                return True
    except Exception as ex:
        logger.debug(f"Failed host network check: {ex}")

    return False


def log_attendance_event(
    event_type: str,
    user: User,
    ip_address: Optional[str],
    details: dict,
) -> None:
    """Print high-visibility console log and logger.info for attendance events."""
    host_lan_ips = get_host_lan_ips()
    try:
        from app.core.ip_utils import get_server_public_ip
        host_wan_ip = get_server_public_ip()
    except Exception:
        host_wan_ip = None

    now_str = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")
    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    wan_display = f" | Server Public WAN IP: {host_wan_ip}" if host_wan_ip else ""
    banner = [
        "=" * 80,
        f"📍 [{event_type}] {now_str}",
        f"   User: '{user.full_name}' ({user.email}) | Role: {role_str}",
        f"   Branch: {user.branch or 'General'} | Department: {user.department or 'General'}",
        f"   Client IP: {ip_address or 'Unknown'} | Server Host LAN IP(s): {host_lan_ips}{wan_display}",
    ]
    for k, v in details.items():
        banner.append(f"   {k}: {v}")
    banner.append("=" * 80)
    banner_str = "\n".join(banner)
    print(banner_str, flush=True)
    logger.info(banner_str)


class AttendanceService:
    @staticmethod
    def get_today_date_str() -> str:
        return datetime.now().astimezone().strftime("%Y-%m-%d")

    @staticmethod
    async def get_user_buffer_status(
        session: AsyncSession,
        user: User,
        date_str: Optional[str] = None,
    ) -> BufferStatusOut:
        today = date_str or AttendanceService.get_today_date_str()
        current_month_prefix = today[:7]  # YYYY-MM

        # Load user with schedule if not loaded
        u_stmt = select(User).options(selectinload(User.schedule)).where(User.id == user.id)
        u_loaded = (await session.execute(u_stmt)).scalar_one_or_none() or user

        scheduled_check_in = u_loaded.check_in_time or (
            u_loaded.schedule.check_in_time if u_loaded.schedule else None
        )
        scheduled_check_out = u_loaded.check_out_time or (
            u_loaded.schedule.check_out_time if u_loaded.schedule else None
        )
        buffer_minutes = u_loaded.schedule.buffer_minutes if u_loaded.schedule else 10
        monthly_limit = u_loaded.schedule.monthly_buffer_limit if u_loaded.schedule else 3
        schedule_name = u_loaded.schedule.name if u_loaded.schedule else None

        # Count days where grace buffer was used in this calendar month
        count_stmt = (
            select(func.count(Attendance.id))
            .where(
                Attendance.user_id == user.id,
                Attendance.date.startswith(current_month_prefix),
                Attendance.is_buffer_used == True,
            )
        )
        used_count = (await session.execute(count_stmt)).scalar_one() or 0
        remaining = max(0, monthly_limit - used_count)

        try:
            month_d = datetime.strptime(today, "%Y-%m-%d")
            month_name = month_d.strftime("%B %Y")
        except Exception:
            month_name = current_month_prefix

        return BufferStatusOut(
            buffer_days_used=used_count,
            monthly_limit=monthly_limit,
            buffer_minutes=buffer_minutes,
            remaining_days=remaining,
            scheduled_check_in=scheduled_check_in,
            scheduled_check_out=scheduled_check_out,
            schedule_name=schedule_name,
            month_name=month_name,
        )

    @staticmethod
    async def get_today_status(
        session: AsyncSession, user_id: uuid.UUID
    ) -> AttendanceTodayStatus:
        today = AttendanceService.get_today_date_str()
        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user))
            .where(Attendance.user_id == user_id, Attendance.date == today)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()

        u_stmt = select(User).options(selectinload(User.schedule)).where(User.id == user_id)
        u_loaded = (await session.execute(u_stmt)).scalar_one_or_none()

        buffer_status = None
        scheduled_in = None
        scheduled_out = None
        if u_loaded:
            buffer_status = await AttendanceService.get_user_buffer_status(session, u_loaded, today)
            scheduled_in = buffer_status.scheduled_check_in
            scheduled_out = buffer_status.scheduled_check_out

        if not record:
            return AttendanceTodayStatus(
                is_checked_in=False,
                is_checked_out=False,
                record=None,
                worked_seconds=0,
                buffer_status=buffer_status,
                scheduled_check_in=scheduled_in,
                scheduled_check_out=scheduled_out,
            )

        now = datetime.now(timezone.utc)
        if record.check_out_time:
            worked = int((record.check_out_time - record.check_in_time).total_seconds())
        else:
            worked = max(0, int((now - record.check_in_time).total_seconds()))

        return AttendanceTodayStatus(
            is_checked_in=True,
            is_checked_out=record.check_out_time is not None,
            record=AttendanceOut.model_validate(record),
            worked_seconds=worked,
            buffer_status=buffer_status,
            scheduled_check_in=scheduled_in,
            scheduled_check_out=scheduled_out,
        )

    @staticmethod
    async def check_in(
        session: AsyncSession,
        user: User,
        note: Optional[str] = None,
        ip_address: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        accuracy: Optional[float] = None,
        wifi_ssid: Optional[str] = None,
    ) -> Attendance:
        today = AttendanceService.get_today_date_str()
        now_utc = datetime.now(timezone.utc)
        now_local = datetime.now().astimezone()

        # Check office Wi-Fi / network restriction (Branch level or global fallback from .env)
        effective_allowed_ips = settings.ALLOWED_WIFI_IPS
        effective_ssid = settings.ALLOWED_WIFI_SSID

        branch = None
        if user.branch:
            b_stmt = select(Branch).where(func.lower(Branch.name) == user.branch.strip().lower())
            branch = (await session.execute(b_stmt)).scalar_one_or_none()
            if branch:
                if branch.allowed_wifi_ips and branch.allowed_wifi_ips.strip():
                    effective_allowed_ips = branch.allowed_wifi_ips.strip()
                if branch.wifi_ssid and branch.wifi_ssid.strip():
                    effective_ssid = branch.wifi_ssid.strip()

        requires_approval = False
        approval_status = "APPROVED"

        # Check if Wi-Fi or IP restrictions are configured
        if effective_allowed_ips or effective_ssid:
            is_matched = False
            if effective_allowed_ips and is_ip_in_network(ip_address, effective_allowed_ips):
                is_matched = True
            if effective_ssid and wifi_ssid and effective_ssid.strip().lower() == wifi_ssid.strip().lower():
                is_matched = True

            if not is_matched:
                requires_approval = True
                approval_status = "PENDING"

        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user), selectinload(Attendance.approved_by))
            .where(Attendance.user_id == user.id, Attendance.date == today)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()

        if record:
            if record.check_out_time is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"You are already checked in today at {record.check_in_time.strftime('%I:%M %p')}.",
                )
            # Re-opening / Resuming attendance session
            record.check_out_time = None
            record.requires_approval = requires_approval
            record.approval_status = approval_status
            if requires_approval:
                gps_desc = f"GPS: ({latitude:.5f}, {longitude:.5f})" if latitude and longitude else "GPS unavailable"
                resumed_note = f"Resumed off-network check-in (IP: {ip_address or 'Unknown'}, {gps_desc}). Awaiting Admin Approval."
                combined_note = (
                    f"{record.check_in_note} | {resumed_note}"
                    if record.check_in_note
                    else resumed_note
                )
                record.check_in_note = combined_note[-250:] if len(combined_note) > 250 else combined_note
            elif note:
                combined_note = (
                    f"{record.check_in_note} | Resumed: {note.strip()}"
                    if record.check_in_note
                    else note.strip()
                )
                record.check_in_note = combined_note[-250:] if len(combined_note) > 250 else combined_note
            if latitude is not None:
                record.latitude = latitude
            if longitude is not None:
                record.longitude = longitude
            if accuracy is not None:
                record.accuracy = accuracy
            if wifi_ssid is not None:
                record.wifi_ssid = wifi_ssid
            if ip_address is not None:
                record.ip_address = ip_address
            record.updated_at = now_utc
            await session.commit()
            await session.refresh(record)
        else:
            # First check-in of the day: evaluate schedule and grace buffer
            u_stmt = select(User).options(selectinload(User.schedule)).where(User.id == user.id)
            u_loaded = (await session.execute(u_stmt)).scalar_one_or_none() or user

            sched_in = u_loaded.check_in_time or (
                u_loaded.schedule.check_in_time if u_loaded.schedule else None
            )
            sched_out = u_loaded.check_out_time or (
                u_loaded.schedule.check_out_time if u_loaded.schedule else None
            )
            buffer_mins = u_loaded.schedule.buffer_minutes if u_loaded.schedule else 10
            monthly_limit = u_loaded.schedule.monthly_buffer_limit if u_loaded.schedule else 3

            is_buffer_used = False
            is_late = False
            late_minutes = 0
            initial_status = AttendanceStatus.CHECKED_IN
            check_note_parts = []
            if note and note.strip():
                check_note_parts.append(note.strip())

            if sched_in:
                try:
                    parts = sched_in.split(":")
                    sched_total_mins = int(parts[0]) * 60 + int(parts[1])
                    actual_total_mins = now_local.hour * 60 + now_local.minute
                    diff = actual_total_mins - sched_total_mins

                    if diff <= 0:
                        # Exactly on time or early
                        is_buffer_used = False
                        is_late = False
                        late_minutes = 0
                    elif 0 < diff <= buffer_mins:
                        # Within 10-minute grace buffer
                        current_month_prefix = today[:7]
                        buf_count_stmt = (
                            select(func.count(Attendance.id))
                            .where(
                                Attendance.user_id == user.id,
                                Attendance.date.startswith(current_month_prefix),
                                Attendance.date != today,
                                Attendance.is_buffer_used == True,
                            )
                        )
                        used_so_far = (await session.execute(buf_count_stmt)).scalar_one() or 0

                        if used_so_far < monthly_limit:
                            is_buffer_used = True
                            is_late = False
                            late_minutes = diff
                            check_note_parts.append(
                                f"Grace buffer used (Day {used_so_far + 1}/{monthly_limit} this month, +{diff}m)"
                            )
                        else:
                            # 3-day buffer limit reached! Mark as half day leave
                            is_buffer_used = False
                            is_late = True
                            late_minutes = diff
                            initial_status = AttendanceStatus.HALF_DAY
                            check_note_parts.append(
                                f"Late check-in (+{diff}m past {sched_in}) - Exceeded {monthly_limit}-day monthly buffer. Marked as Half Day Leave"
                            )
                    else:
                        # Past the 10-minute buffer window! Mark as half day leave
                        is_buffer_used = False
                        is_late = True
                        late_minutes = diff
                        initial_status = AttendanceStatus.HALF_DAY
                        check_note_parts.append(
                            f"Late check-in (+{diff}m past {sched_in}, buffer exceeded). Marked as Half Day Leave"
                        )
                except Exception as ex:
                    # In case of parse error, proceed safely
                    pass

            if requires_approval:
                gps_desc = f"GPS: ({latitude:.5f}, {longitude:.5f})" if latitude and longitude else "GPS unavailable"
                check_note_parts.append(f"Off-network check-in (IP: {ip_address or 'Unknown'}, {gps_desc}). Awaiting Admin Approval.")

            final_note = " | ".join(check_note_parts) if check_note_parts else None
            if final_note and len(final_note) > 250:
                final_note = final_note[:250]

            record = Attendance(
                user_id=user.id,
                date=today,
                check_in_time=now_utc,
                check_out_time=None,
                total_hours=0.0,
                status=initial_status,
                schedule_check_in=sched_in,
                schedule_check_out=sched_out,
                is_buffer_used=is_buffer_used,
                is_late=is_late,
                late_minutes=late_minutes,
                check_in_note=final_note,
                ip_address=ip_address,
                approval_status=approval_status,
                requires_approval=requires_approval,
                latitude=latitude,
                longitude=longitude,
                accuracy=accuracy,
                wifi_ssid=wifi_ssid,
            )
            session.add(record)

            # Keep login tracking fields updated for user
            user.last_login_at = now_utc
            if user.today_first_login_date != today:
                user.today_first_login_date = today
                user.today_first_login_at = now_utc

            await session.commit()
            await session.refresh(record)

        # If approval required, dispatch notifications to Super Admins, Admins, In-Charges and Team Leaders
        if record.requires_approval and record.approval_status == "PENDING":
            try:
                from app.services.notification_service import NotificationService
                user_branch_clean = user.branch.strip().lower() if user.branch and user.branch.strip() else None
                user_dept_clean = user.department.strip().lower() if user.department and user.department.strip() else None

                notif_conditions = [
                    User.role == Role.SUPER_ADMIN,
                    and_(
                        User.role == Role.ADMIN,
                        or_(
                            func.lower(func.trim(User.branch)) == user_branch_clean,
                            User.branch.is_(None),
                        ) if user_branch_clean else True,
                    ),
                ]

                # In-Charge notifications (same branch and/or department, or direct report)
                in_charge_conds = []
                if user_branch_clean:
                    in_charge_conds.append(func.lower(func.trim(User.branch)) == user_branch_clean)
                if user_dept_clean:
                    in_charge_conds.append(func.lower(func.trim(User.department)) == user_dept_clean)
                if user.reports_to_id:
                    in_charge_conds.append(User.id == user.reports_to_id)
                if in_charge_conds:
                    notif_conditions.append(and_(User.role == Role.IN_CHARGE, or_(*in_charge_conds)))

                # Team Leader notifications (direct subordinate or same department)
                tl_conds = []
                if user.reports_to_id:
                    tl_conds.append(User.id == user.reports_to_id)
                if user_dept_clean:
                    tl_conds.append(func.lower(func.trim(User.department)) == user_dept_clean)
                if tl_conds:
                    notif_conditions.append(and_(User.role == Role.TEAM_LEADER, or_(*tl_conds)))

                admin_stmt = select(User).where(
                    or_(*notif_conditions),
                    User.is_active == True,
                    User.id != user.id,
                )
                admins = (await session.execute(admin_stmt)).scalars().all()
                gps_info = f"GPS: Lat {latitude:.5f}, Lng {longitude:.5f}" if latitude and longitude else "GPS not provided"
                notif_title = "Check-in Approval Requested"
                notif_msg = f"{user.full_name} ({user.branch or 'General'}) checked in outside office Wi-Fi (IP: {ip_address or 'Unknown'}). {gps_info}. Approval required."

                for adm in admins:
                    try:
                        await NotificationService.create(
                            session=session,
                            user_id=adm.id,
                            title=notif_title,
                            message=notif_msg,
                            notification_type="CHECKIN_APPROVAL_REQUEST",
                            link="/approvals?tab=checkins",
                        )
                    except Exception as ex:
                        logger.error(f"Failed to deliver check-in notification to admin {adm.id}: {ex}")

                await broadcaster.broadcast(
                    "CHECKIN_APPROVAL_REQUESTED",
                    {
                        "attendance_id": str(record.id),
                        "user_id": str(user.id),
                        "user_name": user.full_name,
                        "date": record.date,
                        "latitude": latitude,
                        "longitude": longitude,
                        "ip_address": ip_address,
                        "branch": user.branch,
                    },
                )
            except Exception as ex:
                logger.error(f"Failed to broadcast check-in approval request: {ex}")

        # High-visibility console log showing detected IP and verification
        gps_summary = (
            f"Lat {latitude:.5f}, Lng {longitude:.5f} (Acc: {accuracy or 0:.1f}m)"
            if latitude and longitude
            else "Not Provided / Unavailable"
        )
        verification_text = (
            "ON-NETWORK (APPROVED - No Approval Required)"
            if not record.requires_approval
            else "OFF-NETWORK (PENDING - Supervisor Approval Required)"
        )
        log_attendance_event(
            event_type="ATTENDANCE CHECK-IN",
            user=user,
            ip_address=ip_address,
            details={
                "Allowed Wi-Fi IPs": effective_allowed_ips or "None",
                "Allowed SSID": f"{effective_ssid or 'None'} (Client SSID: {wifi_ssid or 'None'})",
                "Network Match": f"{not record.requires_approval} -> {verification_text}",
                "GPS Location": gps_summary,
                "Shift / Buffer Status": f"Status: {record.status.value} | Late: {record.is_late} | Buffer Used: {record.is_buffer_used}",
                "Approval Status": record.approval_status,
                "Check-In Note": record.check_in_note or "None",
            },
        )

        # Broadcast real-time event
        await broadcaster.broadcast(
            "ATTENDANCE_UPDATED",
            {
                "action": "CHECK_IN",
                "user_id": str(user.id),
                "user_name": user.full_name,
                "date": record.date,
                "status": record.status.value,
                "check_in_time": record.check_in_time.isoformat(),
                "is_late": record.is_late,
                "is_buffer_used": record.is_buffer_used,
                "approval_status": record.approval_status,
                "requires_approval": record.requires_approval,
            },
        )
        return record

    @staticmethod
    async def check_out(
        session: AsyncSession,
        user: User,
        note: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Attendance:
        today = AttendanceService.get_today_date_str()
        now_utc = datetime.now(timezone.utc)

        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user))
            .where(Attendance.user_id == user.id, Attendance.date == today)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()

        if not record or record.check_out_time is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active check-in session found for today. Please check in first.",
            )

        record.check_out_time = now_utc
        duration_seconds = max(0.0, (now_utc - record.check_in_time).total_seconds())
        total_hours = round(duration_seconds / 3600.0, 2)
        record.total_hours = total_hours

        # If it was already marked HALF_DAY due to late check-in, preserve HALF_DAY!
        if record.status == AttendanceStatus.HALF_DAY or record.is_late:
            record.status = AttendanceStatus.HALF_DAY
        else:
            # Mark half-day if less than 4 hours worked, otherwise present
            if total_hours < 4.0:
                record.status = AttendanceStatus.HALF_DAY
            else:
                record.status = AttendanceStatus.PRESENT

        if note:
            record.check_out_note = (
                f"{record.check_out_note} | {note.strip()}"
                if record.check_out_note
                else note.strip()
            )
        record.updated_at = now_utc

        await session.commit()
        await session.refresh(record)

        # High-visibility console log showing detected IP and check-out
        log_attendance_event(
            event_type="ATTENDANCE CHECK-OUT",
            user=user,
            ip_address=ip_address,
            details={
                "Worked Hours": f"{record.total_hours:.2f} hrs",
                "Final Shift Status": record.status.value,
                "Check-In Time": record.check_in_time.strftime("%Y-%m-%d %H:%M:%S UTC") if record.check_in_time else "None",
                "Check-Out Time": record.check_out_time.strftime("%Y-%m-%d %H:%M:%S UTC") if record.check_out_time else "None",
                "Check-In Note": record.check_in_note or "None",
                "Check-Out Note": record.check_out_note or "None",
            },
        )

        out_dt = record.check_out_time or now_utc
        # Broadcast real-time event
        await broadcaster.broadcast(
            "ATTENDANCE_UPDATED",
            {
                "action": "CHECK_OUT",
                "user_id": str(user.id),
                "user_name": user.full_name,
                "date": record.date,
                "check_out_time": out_dt.isoformat(),
                "total_hours": record.total_hours,
                "status": record.status.value,
            },
        )
        return record

    @staticmethod
    def _apply_role_filters(query, current_user: User):
        """Scope query according to organizational hierarchy roles"""
        if current_user.role == Role.SUPER_ADMIN:
            return query
        elif current_user.role == Role.ADMIN:
            if current_user.branch:
                return query.where(
                    or_(
                        User.branch == current_user.branch,
                        User.id == current_user.id,
                    )
                )
            return query
        elif current_user.role == Role.IN_CHARGE:
            return query.where(
                or_(
                    User.id == current_user.id,
                    and_(
                        User.branch == current_user.branch,
                        User.department == current_user.department,
                    ),
                    User.reports_to_id == current_user.id,
                )
            )
        elif current_user.role == Role.TEAM_LEADER:
            return query.where(
                or_(
                    User.id == current_user.id,
                    User.reports_to_id == current_user.id,
                )
            )
        else:  # STAFF
            return query.where(Attendance.user_id == current_user.id)

    @staticmethod
    async def list_attendance_report(
        session: AsyncSession,
        current_user: User,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        branch_id: Optional[uuid.UUID] = None,
        department: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> AttendanceReportResponse:
        base_query = (
            select(Attendance)
            .join(User, Attendance.user_id == User.id)
            .options(selectinload(Attendance.user))
        )
        base_query = AttendanceService._apply_role_filters(base_query, current_user)

        # Filters
        if start_date:
            base_query = base_query.where(Attendance.date >= start_date)
        if end_date:
            base_query = base_query.where(Attendance.date <= end_date)
        if user_id:
            base_query = base_query.where(Attendance.user_id == user_id)
        if status_filter:
            base_query = base_query.where(Attendance.status == status_filter)
        if department:
            base_query = base_query.where(User.department.ilike(f"%{department.strip()}%"))
        if branch_id:
            b_stmt = select(Branch.name).where(Branch.id == branch_id)
            b_name = (await session.execute(b_stmt)).scalar_one_or_none()
            if b_name:
                base_query = base_query.where(User.branch.ilike(b_name.strip()))

        # Calculate KPI summary from full matching dataset
        subq = base_query.subquery()
        summary_stmt = select(
            func.count(subq.c.id).label("total_records"),
            func.coalesce(func.sum(subq.c.total_hours), 0.0).label("total_hours"),
            func.count(subq.c.id).filter(subq.c.check_out_time.is_(None)).label("currently_checked_in"),
            func.count(subq.c.id).filter(subq.c.status == AttendanceStatus.PRESENT).label("present_count"),
            func.count(subq.c.id).filter(subq.c.status == AttendanceStatus.HALF_DAY).label("half_day_count"),
        ).select_from(subq)

        sum_res = (await session.execute(summary_stmt)).one()
        tot_records = sum_res.total_records or 0
        tot_hours = round(float(sum_res.total_hours or 0.0), 2)
        avg_hours = round(tot_hours / tot_records, 2) if tot_records > 0 else 0.0

        summary = AttendanceReportSummary(
            total_records=tot_records,
            total_hours=tot_hours,
            average_hours_per_day=avg_hours,
            currently_checked_in=sum_res.currently_checked_in or 0,
            present_count=sum_res.present_count or 0,
            half_day_count=sum_res.half_day_count or 0,
        )

        # Order & Paginate
        paginated_stmt = (
            base_query.order_by(desc(Attendance.date), desc(Attendance.check_in_time))
            .offset(skip)
            .limit(limit)
        )
        records = (await session.execute(paginated_stmt)).scalars().all()

        return AttendanceReportResponse(
            items=[AttendanceOut.model_validate(r) for r in records],
            total=tot_records,
            skip=skip,
            limit=limit,
            summary=summary,
        )

    @staticmethod
    async def export_excel_report(
        session: AsyncSession,
        current_user: User,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        branch_id: Optional[uuid.UUID] = None,
        department: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        status_filter: Optional[str] = None,
    ) -> bytes:
        base_query = (
            select(Attendance)
            .join(User, Attendance.user_id == User.id)
            .options(selectinload(Attendance.user))
        )
        base_query = AttendanceService._apply_role_filters(base_query, current_user)

        if start_date:
            base_query = base_query.where(Attendance.date >= start_date)
        if end_date:
            base_query = base_query.where(Attendance.date <= end_date)
        if user_id:
            base_query = base_query.where(Attendance.user_id == user_id)
        if status_filter:
            base_query = base_query.where(Attendance.status == status_filter)
        if department:
            base_query = base_query.where(User.department.ilike(f"%{department.strip()}%"))
        if branch_id:
            b_stmt = select(Branch.name).where(Branch.id == branch_id)
            b_name = (await session.execute(b_stmt)).scalar_one_or_none()
            if b_name:
                base_query = base_query.where(User.branch.ilike(b_name.strip()))

        stmt = base_query.order_by(desc(Attendance.date), desc(Attendance.check_in_time)).limit(5000)
        records = (await session.execute(stmt)).scalars().all()

        wb = Workbook()
        ws: Worksheet = cast(Worksheet, wb.active) if wb.active is not None else wb.create_sheet("Attendance Report")
        ws.title = "Attendance Report"

        headers = [
            "Date",
            "Employee Name",
            "Email",
            "Role",
            "Branch",
            "Department",
            "Scheduled Shift",
            "Check-In Time",
            "Check-Out Time",
            "Grace Buffer Used",
            "Hours Worked",
            "Status",
            "Notes",
        ]
        ws.append(headers)

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        center_align = Alignment(horizontal="center", vertical="center")
        left_align = Alignment(horizontal="left", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0"),
        )

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        total_hours_sum = 0.0

        for r_idx, att in enumerate(records, start=2):
            u = att.user
            in_str = att.check_in_time.strftime("%I:%M %p") if att.check_in_time else "—"
            out_str = att.check_out_time.strftime("%I:%M %p") if att.check_out_time else "Currently Active"
            sched_shift = (
                f"{att.schedule_check_in} - {att.schedule_check_out}"
                if att.schedule_check_in and att.schedule_check_out
                else (att.schedule_check_in or "—")
            )
            buffer_used_str = (
                "Yes (Grace Allowed)"
                if att.is_buffer_used
                else ("Late Check-in" if att.is_late else "No (On Time)")
            )
            notes = " | ".join(filter(None, [att.check_in_note, att.check_out_note])) or "—"
            total_hours_sum += att.total_hours

            row_data = [
                att.date,
                u.full_name if u else "—",
                u.email if u else "—",
                u.role.value if u and u.role else "—",
                u.branch if u and u.branch else "—",
                u.department if u and u.department else "—",
                sched_shift,
                in_str,
                out_str,
                buffer_used_str,
                att.total_hours,
                att.status.value,
                notes,
            ]
            ws.append(row_data)

            for c_idx in range(1, len(row_data) + 1):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.border = thin_border
                cell.alignment = left_align

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            first_cell = col[0]
            col_letter = get_column_letter(first_cell.column) if hasattr(first_cell, "column") and isinstance(first_cell.column, int) else "A"
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        out_io = io.BytesIO()
        wb.save(out_io)
        out_io.seek(0)
        return out_io.getvalue()

    @staticmethod
    async def list_pending_checkin_approvals(
        session: AsyncSession,
        current_user: User,
        branch: Optional[str] = None,
    ) -> List[Attendance]:
        """
        List attendance records requiring supervisor review (off-network check-ins).
        Super Admin sees all, Admin sees records for employees in their branch,
        In-Charge sees records for their branch/department, Team Leader sees records for their department/subordinates.
        Level 5 Staff users cannot review check-ins.
        """
        if current_user.role == Role.STAFF:
            return []

        user_alias = aliased(User)
        stmt = (
            select(Attendance)
            .join(user_alias, Attendance.user_id == user_alias.id)
            .options(selectinload(Attendance.user), selectinload(Attendance.approved_by))
            .where(
                Attendance.requires_approval == True,
                Attendance.approval_status == "PENDING",
            )
            .order_by(desc(Attendance.check_in_time))
        )

        if current_user.role != Role.SUPER_ADMIN:
            if current_user.role == Role.ADMIN:
                if current_user.branch and current_user.branch.strip():
                    admin_branch_clean = current_user.branch.strip().lower()
                    stmt = stmt.where(
                        or_(
                            func.lower(func.trim(user_alias.branch)) == admin_branch_clean,
                            user_alias.branch.is_(None),
                        )
                    )
            elif current_user.role == Role.IN_CHARGE:
                conds = []
                if current_user.branch and current_user.branch.strip():
                    conds.append(func.lower(func.trim(user_alias.branch)) == current_user.branch.strip().lower())
                if current_user.department and current_user.department.strip():
                    conds.append(func.lower(func.trim(user_alias.department)) == current_user.department.strip().lower())
                conds.append(user_alias.reports_to_id == current_user.id)
                if conds:
                    stmt = stmt.where(or_(*conds))
            elif current_user.role == Role.TEAM_LEADER:
                conds = [user_alias.reports_to_id == current_user.id]
                if current_user.department and current_user.department.strip():
                    conds.append(func.lower(func.trim(user_alias.department)) == current_user.department.strip().lower())
                stmt = stmt.where(or_(*conds))

        # Explicit branch filter if provided
        if branch and branch.strip() and branch.strip().upper() != "ALL":
            b_clean = branch.strip().lower()
            stmt = stmt.where(func.lower(func.trim(user_alias.branch)) == b_clean)

        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def approve_check_in(
        session: AsyncSession,
        attendance_id: uuid.UUID,
        admin_user: User,
    ) -> Attendance:
        """Approve an off-network check-in request"""
        if admin_user.role == Role.STAFF:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff users cannot approve check-in requests.",
            )

        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user), selectinload(Attendance.approved_by))
            .where(Attendance.id == attendance_id)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found.",
            )

        now_utc = datetime.now(timezone.utc)
        record.approval_status = "APPROVED"
        record.requires_approval = False
        record.approved_by_id = admin_user.id
        record.approved_at = now_utc
        record.updated_at = now_utc

        await session.commit()
        await session.refresh(record)

        # Notify the user
        try:
            from app.services.notification_service import NotificationService
            await NotificationService.create(
                session=session,
                user_id=record.user_id,
                title="Check-in Approved",
                message=f"Your off-network check-in for {record.date} has been approved by {admin_user.full_name}.",
                notification_type="CHECKIN_APPROVAL_DECIDED",
                link="/attendance",
            )
        except Exception as ex:
            logger.error(f"Failed to create check-in approval notification: {ex}")

        await broadcaster.broadcast(
            "ATTENDANCE_UPDATED",
            {
                "action": "CHECKIN_APPROVED",
                "attendance_id": str(record.id),
                "user_id": str(record.user_id),
                "date": record.date,
                "approval_status": "APPROVED",
                "approved_by": admin_user.full_name,
            },
        )
        return record

    @staticmethod
    async def reject_check_in(
        session: AsyncSession,
        attendance_id: uuid.UUID,
        admin_user: User,
        reason: Optional[str] = None,
    ) -> Attendance:
        """Reject an off-network check-in request"""
        if admin_user.role == Role.STAFF:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Staff users cannot reject check-in requests.",
            )

        stmt = (
            select(Attendance)
            .options(selectinload(Attendance.user), selectinload(Attendance.approved_by))
            .where(Attendance.id == attendance_id)
        )
        record = (await session.execute(stmt)).scalar_one_or_none()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance record not found.",
            )

        now_utc = datetime.now(timezone.utc)
        clean_reason = reason.strip() if reason and reason.strip() else "Off-network location not verified"
        record.approval_status = "REJECTED"
        record.requires_approval = False
        record.rejection_reason = clean_reason
        record.approved_by_id = admin_user.id
        record.approved_at = now_utc
        record.updated_at = now_utc

        await session.commit()
        await session.refresh(record)

        # Notify the user
        try:
            from app.services.notification_service import NotificationService
            await NotificationService.create(
                session=session,
                user_id=record.user_id,
                title="Check-in Rejected",
                message=f"Your off-network check-in for {record.date} was rejected by {admin_user.full_name}. Reason: {clean_reason}",
                notification_type="CHECKIN_APPROVAL_DECIDED",
                link="/attendance",
            )
        except Exception as ex:
            logger.error(f"Failed to create check-in rejection notification: {ex}")

        await broadcaster.broadcast(
            "ATTENDANCE_UPDATED",
            {
                "action": "CHECKIN_REJECTED",
                "attendance_id": str(record.id),
                "user_id": str(record.user_id),
                "date": record.date,
                "approval_status": "REJECTED",
                "rejection_reason": clean_reason,
                "approved_by": admin_user.full_name,
            },
        )
        return record
