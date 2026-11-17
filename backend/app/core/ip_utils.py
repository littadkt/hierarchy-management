import ipaddress
import json
import logging
import time
import urllib.request
from typing import Optional
from fastapi import Request

logger = logging.getLogger(__name__)

# In-memory cache for host public WAN IP so external calls are rarely made
_SERVER_PUBLIC_IP_CACHE: Optional[str] = None
_SERVER_PUBLIC_IP_TIMESTAMP: float = 0.0
_CACHE_TTL_SECONDS: float = 900.0  # 15 minutes


def clean_ip_str(ip_str: Optional[str]) -> str:
    """Normalize and clean an IP address string by stripping ports, brackets, and prefixes."""
    if not ip_str:
        return "127.0.0.1"
    clean = str(ip_str).strip()
    if clean.startswith("["):
        end_b = clean.find("]")
        if end_b != -1:
            clean = clean[1:end_b].strip()
    elif clean.count(":") == 1 and "." in clean:
        clean = clean.split(":")[0].strip()

    if clean.lower().startswith("::ffff:") and "." in clean:
        clean = clean[7:].strip()

    return clean or "127.0.0.1"


def get_client_ip(request: Request, payload_ip: Optional[str] = None) -> str:
    """
    Extract the real client IP address handling reverse proxies and tunnels:
    Employee Device -> Cloudflare -> Cloudflare Tunnel (cloudflared) -> Caddy -> FastAPI.

    Priority order:
    1. payload_ip (explicit testing/remote override if provided in payload)
    2. CF-Connecting-IP (canonical visitor IP set by Cloudflare Tunnel / CDN)
    3. True-Client-IP (Cloudflare Enterprise / Akamai)
    4. X-Forwarded-For (parses proxy chain, filters out internal loopback proxies)
    5. X-Real-IP (reverse proxy header)
    6. request.client.host (direct connection socket)
    """
    if payload_ip and payload_ip.strip():
        return clean_ip_str(payload_ip.strip())

    # 1. Cloudflare header (highest priority when behind Cloudflare / Cloudflare Tunnel)
    cf_connecting = request.headers.get("cf-connecting-ip")
    if cf_connecting and cf_connecting.strip():
        return clean_ip_str(cf_connecting)

    true_client = request.headers.get("true-client-ip")
    if true_client and true_client.strip():
        return clean_ip_str(true_client)

    # 2. X-Forwarded-For header
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and forwarded.strip():
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        # If proxy appended/prepended localhost (127.0.0.1, ::1), prefer actual remote IP
        remote_candidates = [
            clean_ip_str(p)
            for p in parts
            if clean_ip_str(p) not in ("127.0.0.1", "::1", "localhost")
        ]
        if remote_candidates:
            return remote_candidates[0]
        if parts:
            return clean_ip_str(parts[0])

    # 3. X-Real-IP header
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        clean = clean_ip_str(real_ip)
        if clean not in ("127.0.0.1", "::1", "localhost"):
            return clean

    # 4. Fallback to direct socket connection host
    if request.client and request.client.host:
        return clean_ip_str(request.client.host)

    return "127.0.0.1"


def get_server_public_ip(force_refresh: bool = False) -> Optional[str]:
    """
    Retrieve server host machine's public WAN IP address with in-memory caching.
    Used when the server is physically located on the office network so employees
    connecting through the Cloudflare Tunnel domain share the host router's WAN IP.
    """
    global _SERVER_PUBLIC_IP_CACHE, _SERVER_PUBLIC_IP_TIMESTAMP
    now = time.time()
    if not force_refresh and _SERVER_PUBLIC_IP_CACHE and (now - _SERVER_PUBLIC_IP_TIMESTAMP < _CACHE_TTL_SECONDS):
        return _SERVER_PUBLIC_IP_CACHE

    urls = [
        "https://api.ipify.org?format=json",
        "https://ifconfig.me/all.json",
        "https://api.my-ip.io/v2/ip.json",
    ]
    for url in urls:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "FastAPI-Attendance-IP-Resolver"}
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                data = json.loads(resp.read().decode())
                ip = data.get("ip") or data.get("ip_addr")
                if ip:
                    clean = clean_ip_str(ip)
                    # Validate it's a valid IP
                    ipaddress.ip_address(clean)
                    _SERVER_PUBLIC_IP_CACHE = clean
                    _SERVER_PUBLIC_IP_TIMESTAMP = now
                    logger.info(f"Resolved host public WAN IP: {clean}")
                    return clean
        except Exception:
            continue

    return _SERVER_PUBLIC_IP_CACHE
