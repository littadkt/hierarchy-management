import ipaddress
import json
import logging
import time
import urllib.request
from typing import Optional, Set
from fastapi import Request

logger = logging.getLogger(__name__)

# In-memory cache for host public WAN IP so external calls are rarely made
_SERVER_PUBLIC_IP_CACHE: Optional[str] = None
_SERVER_PUBLIC_IP_TIMESTAMP: float = 0.0
_CACHE_TTL_SECONDS: float = 900.0  # 15 minutes

# Trusted local reverse proxy addresses (Caddy and Cloudflare Tunnel loopback daemon)
TRUSTED_PROXY_IPS: Set[str] = {
    "127.0.0.1",
    "::1",
    "localhost",
}


def clean_ip_str(ip_str: Optional[str]) -> Optional[str]:
    """
    Normalize, clean, and validate an IP address string.
    Strips ports, brackets, and IPv4-mapped IPv6 prefixes (::ffff:).
    Returns a validated IP string (IPv4 or IPv6), or None if missing/invalid.
    Fails closed: NEVER defaults to localhost or a fallback IP.
    """
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
        return str(parsed)
    except (ValueError, TypeError):
        return None


def is_trusted_proxy(host: Optional[str]) -> bool:
    """Check if the direct socket peer is one of the trusted local reverse proxies."""
    if not host:
        return False
    clean = clean_ip_str(host)
    if not clean:
        return False
    if clean in TRUSTED_PROXY_IPS:
        return True
    try:
        ip = ipaddress.ip_address(clean)
        return ip.is_loopback
    except ValueError:
        return False


def get_client_ip(request: Request) -> Optional[str]:
    """
    Securely extract the visitor's real IP address handling reverse proxies:
    Employee Device -> Cloudflare Edge -> Cloudflare Tunnel (cloudflared) -> Caddy -> FastAPI.

    Security Rules:
    1. Only trust proxy headers (CF-Connecting-IP, X-Forwarded-For, etc.) when the
       immediate socket peer (request.client.host) is a verified trusted proxy (127.0.0.1, ::1).
       If an untrusted network client connects directly to FastAPI, proxy headers are ignored
       to prevent header spoofing attacks.
    2. Frontend request bodies or payload parameters are NEVER accepted for IP detection.
    3. Loopback addresses (127.0.0.1, ::1) are filtered out of the proxy chain to find
       the actual external visitor IP.
    4. If no valid remote IP is found, returns None (or socket host), failing closed.
    """
    socket_host = request.client.host if request.client else None
    cleaned_socket = clean_ip_str(socket_host)

    # If the connection does not originate from our trusted local reverse proxy,
    # strictly use the direct connection socket host. DO NOT trust forwarded headers!
    if not is_trusted_proxy(cleaned_socket):
        return cleaned_socket

    # Request is from trusted proxy (Caddy/Cloudflare Tunnel on localhost).
    # Inspect proxy headers in priority order:

    # 1. CF-Connecting-IP (authoritative visitor IP injected by Cloudflare Edge)
    cf_connecting = request.headers.get("cf-connecting-ip")
    if cf_connecting and cf_connecting.strip():
        clean_cf = clean_ip_str(cf_connecting)
        if clean_cf:
            try:
                ip_obj = ipaddress.ip_address(clean_cf)
                if not ip_obj.is_loopback:
                    return clean_cf
            except ValueError:
                pass

    # 2. True-Client-IP (Cloudflare Enterprise / Akamai)
    true_client = request.headers.get("true-client-ip")
    if true_client and true_client.strip():
        clean_tc = clean_ip_str(true_client)
        if clean_tc:
            try:
                ip_obj = ipaddress.ip_address(clean_tc)
                if not ip_obj.is_loopback:
                    return clean_tc
            except ValueError:
                pass

    # 3. X-Forwarded-For (traversed from left to right; filter out loopback proxies)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and forwarded.strip():
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        for part in parts:
            clean_part = clean_ip_str(part)
            if clean_part:
                try:
                    ip_obj = ipaddress.ip_address(clean_part)
                    if not ip_obj.is_loopback:
                        return clean_part
                except ValueError:
                    continue

    # 4. X-Real-IP
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        clean_real = clean_ip_str(real_ip)
        if clean_real:
            try:
                ip_obj = ipaddress.ip_address(clean_real)
                if not ip_obj.is_loopback:
                    return clean_real
            except ValueError:
                pass

    # If all forwarded headers were absent or only loopback, return socket host (loopback)
    # The attendance network verification module explicitly rejects loopback IPs.
    return cleaned_socket


def get_server_public_ip(force_refresh: bool = False) -> Optional[str]:
    """
    Retrieve server host machine's public WAN IP address with in-memory caching.
    Used when the server is physically located on the office network so employees
    connecting through the Cloudflare Tunnel domain share the host router's WAN IP.
    Ensures that only genuine, non-private, non-loopback IPs are cached.
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
                    if clean:
                        ip_obj = ipaddress.ip_address(clean)
                        if not ip_obj.is_loopback and not ip_obj.is_private:
                            _SERVER_PUBLIC_IP_CACHE = clean
                            _SERVER_PUBLIC_IP_TIMESTAMP = now
                            logger.info(f"Resolved host public WAN IP: {clean}")
                            return clean
        except Exception:
            continue

    return _SERVER_PUBLIC_IP_CACHE
