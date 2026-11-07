from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import threading

class LoginRateLimiter:
    """
    In-memory rate limiter with sliding window to prevent brute-force attacks
    against authentication endpoints on local/private networks.
    """

    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 300,      # 5 minutes
        lockout_seconds: int = 900,     # 15 minutes lockout
    ):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        self._lock = threading.Lock()
        # Key: identifier (e.g., "ip:192.168.1.5" or "email:admin@example.com")
        # Value: list of UTC timestamps of failed attempts
        self._failures: Dict[str, List[float]] = {}
        # Key: identifier, Value: lockout expiry timestamp (UTC float)
        self._lockouts: Dict[str, float] = {}

    def _now(self) -> float:
        return datetime.now(timezone.utc).timestamp()

    def _clean_old_attempts(self, timestamps: List[float], now: float) -> List[float]:
        threshold = now - self.window_seconds
        return [ts for ts in timestamps if ts > threshold]

    def is_locked(self, ip: Optional[str] = None, email: Optional[str] = None) -> Tuple[bool, int]:
        """
        Check if the IP or email is currently locked out.
        Returns: (is_locked, remaining_lockout_seconds)
        """
        now = self._now()
        keys = []
        if ip:
            keys.append(f"ip:{ip.strip()}")
        if email:
            keys.append(f"email:{email.strip().lower()}")

        with self._lock:
            for key in keys:
                lockout_until = self._lockouts.get(key)
                if lockout_until and lockout_until > now:
                    remaining = int(lockout_until - now)
                    return True, max(remaining, 1)
                elif lockout_until and lockout_until <= now:
                    # Lockout expired, clean it
                    self._lockouts.pop(key, None)
                    self._failures.pop(key, None)

        return False, 0

    def record_failure(self, ip: Optional[str] = None, email: Optional[str] = None) -> Tuple[int, int]:
        """
        Record a failed login attempt.
        Returns: (remaining_attempts_before_lockout, lockout_seconds_if_locked)
        """
        now = self._now()
        keys = []
        if ip:
            keys.append(f"ip:{ip.strip()}")
        if email:
            keys.append(f"email:{email.strip().lower()}")

        with self._lock:
            max_remaining = self.max_attempts
            locked = False

            for key in keys:
                attempts = self._clean_old_attempts(self._failures.get(key, []), now)
                attempts.append(now)
                self._failures[key] = attempts

                if len(attempts) >= self.max_attempts:
                    self._lockouts[key] = now + self.lockout_seconds
                    locked = True
                else:
                    remaining = self.max_attempts - len(attempts)
                    if remaining < max_remaining:
                        max_remaining = remaining

            if locked:
                return 0, self.lockout_seconds

            return max_remaining, 0

    def record_success(self, ip: Optional[str] = None, email: Optional[str] = None) -> None:
        """Clear failed attempts upon valid credentials"""
        keys = []
        if ip:
            keys.append(f"ip:{ip.strip()}")
        if email:
            keys.append(f"email:{email.strip().lower()}")

        with self._lock:
            for key in keys:
                self._failures.pop(key, None)
                self._lockouts.pop(key, None)

    def reset(self) -> None:
        """Reset all rate limiting state (for testing/admin purposes)"""
        with self._lock:
            self._failures.clear()
            self._lockouts.clear()


# Global login rate limiter instance (5 attempts per 5 mins -> 15 mins lockout)
login_rate_limiter = LoginRateLimiter(
    max_attempts=5,
    window_seconds=300,
    lockout_seconds=900,
)

