from pathlib import Path
from typing import List, Optional
from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Hierarchical Task Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "12345678"
    POSTGRES_DB: str = "hierarchy_db"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # JWT Authentication
    SECRET_KEY: str = "f7390bca11883501a39cd52e7acb9d5c581e289bf443f651664c399a918a1a98"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours (1 shift), configurable via .env

    # Security & Rate Limiting for Private Network
    RATE_LIMIT_LOGIN_MAX_ATTEMPTS: int = 5
    RATE_LIMIT_LOGIN_LOCKOUT_MINUTES: int = 15

    # Server Host & Port
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS: Restrict to localhost, RFC 1918 private subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x), and LAN hostnames
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    CORS_ORIGIN_REGEX: str = (
        r"^https?://("
        r"localhost|127\.0\.0\.1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|"
        r"[a-zA-Z0-9\-_]+(\.[a-zA-Z0-9\-_]+)*"
        r")"
        r"(:\d+)?$"
    )

    # Initial Super Admin Seed
    FIRST_SUPER_ADMIN_EMAIL: EmailStr = "superadmin@example.com"
    FIRST_SUPER_ADMIN_PASSWORD: str = "SuperAdmin@123"
    FIRST_SUPER_ADMIN_NAME: str = "Primary Super Admin"

    # Dedicated Office Wi-Fi / Network Restriction for Check-In
    # Comma-separated list of allowed IPs or CIDR blocks (e.g. 127.0.0.1, 192.168.1.0/24, 10.0.0.0/8)
    ALLOWED_WIFI_IPS: str = "127.0.0.1, ::1, 192.168.1.0/24, 192.168.0.0/16, 10.0.0.0/8"
    ALLOWED_WIFI_SSID: Optional[str] = None

    # Automated Database Backup Configuration (Daily at 10:00 PM)
    BACKUP_DIR: str = "backups"
    BACKUP_SCHEDULE_HOUR: int = 22
    BACKUP_SCHEDULE_MINUTE: int = 0
    POSTGRES_BIN_PATH: Optional[str] = None

    # File Attachments Configuration
    UPLOAD_DIR: str = "uploads"
    ATTACHMENTS_DIR: str = "uploads/attachments"

    @property
    def ABSOLUTE_ATTACHMENTS_DIR(self) -> Path:
        from pathlib import Path
        p = Path(self.ATTACHMENTS_DIR)
        if not p.is_absolute():
            backend_root = Path(__file__).resolve().parent.parent.parent
            p = backend_root / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def ABSOLUTE_BACKUP_DIR(self) -> Path:
        from pathlib import Path
        p = Path(self.BACKUP_DIR)
        if not p.is_absolute():
            backend_root = Path(__file__).resolve().parent.parent.parent
            p = backend_root / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    model_config = SettingsConfigDict(
        env_file=(
            Path(__file__).resolve().parent.parent.parent / ".env",
            ".env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()

