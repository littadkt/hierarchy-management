# Private Network Hosting Guide

This guide explains how to host the **Hierarchy Task Management System** on your local / private network (LAN or Wi-Fi) and allow other computers and mobile devices to access it securely.

---

## 1. Quick Start (1-Click Launcher)

Double-click **`start_application.bat`** in the root project folder (`d:\Littad\hierarchy_project\start_application.bat`).

The launcher will:
1. Automatically detect your host machine's private network IPv4 address (e.g. `192.168.100.84`).
2. Display the exact URLs for both local and remote users.
3. Launch the **FastAPI Backend** on `0.0.0.0:8000`.
4. Launch the **Next.js Frontend** on `0.0.0.0:3000`.

---

## 2. Accessing the Application

### From Other Computers / Phones on the Same Network
Open any modern web browser (Chrome, Edge, Firefox, Safari) and navigate to:
```
http://<HOST_IP>:3000
```
*(Example: `http://192.168.100.84:3000`)*

### From the Host Machine (Your PC)
```
http://localhost:3000
```

### Direct Backend API & Interactive Swagger Documentation
```
http://<HOST_IP>:8000/docs
```

---

## 3. How It Works Under the Hood

1. **All-Interface Binding (`0.0.0.0`)**:
   - Both Next.js (`-H 0.0.0.0 -p 3000`) and Uvicorn (`--host 0.0.0.0 --port 8000`) listen on all network interfaces.
2. **Reverse Proxy Rewrites**:
   - The frontend uses Next.js rewrites (`/api/v1/:path* -> http://127.0.0.1:8000/api/v1/:path*`).
   - Remote machines only communicate through port `3000`, completely eliminating cross-origin (CORS) preflights, IP changes, or cookie domain conflicts.
3. **Dynamic Host Fallback**:
   - In `frontend/src/lib/api.ts`, API calls dynamically resolve to the current origin host when accessed from a remote machine, ensuring client-side requests never erroneously target `localhost`.
4. **Flexible Private Subnet CORS**:
   - The backend's `CORS_ORIGIN_REGEX` automatically permits all standard RFC 1918 private subnets (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) and local hostnames.

---

## 4. Windows Firewall Configuration

Both Python and Node.js already have default firewall allow rules. If another computer cannot load the page, run this command in an **Administrator PowerShell** on the host machine to explicitly allow incoming traffic:

```powershell
New-NetFirewallRule -DisplayName "Hierarchy Frontend (Port 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Hierarchy Backend (Port 8000)" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

---

## 5. Security & Authentication Safeguards

When running on a private network:
- **Brute-Force Protection**: 5 failed login attempts will temporarily lock the account for 15 minutes.
- **OWASP Security Headers**: Injected automatically on all backend responses (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`).
- **Super Admin RBAC**: Database backup and restore endpoints are restricted strictly to `Role.SUPER_ADMIN`.

