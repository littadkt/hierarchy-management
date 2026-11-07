# Hierarchical Task Management System - Backend API

Production-ready backend built with **FastAPI**, **PostgreSQL**, **Async SQLAlchemy 2.0**, and **Pydantic v2**. Implements organizational hierarchy, role-based provisions and restrictions, approval workflows, and automated task recurrence.

---

## 1. Hierarchy & Roles Overview

The system models a strict 5-tier organizational hierarchy:
1. **Super Admin** (Level 1)
2. **Admin** (Level 2)
3. **In-Charge** (Level 3)
4. **Team Leader** (Level 4)
5. **Staff** (Level 5)

### Provisions & Restrictions Matrix

| Role | Provisions | Restrictions |
| :--- | :--- | :--- |
| **Super Admin** | • Create admins (and any lower role)<br>• View all admins, in-charge, team leaders, and staff with task details<br>• Create, update, edit, and delete tasks at all levels (including recurring)<br>• Assign tasks to anyone at any level<br>• Create own tasks | • None |
| **Admin** | • Create in-charge<br>• Create tasks and assign up to staff level (In-charge, Team Leader, Staff, Self)<br>• Update and delete team leader tasks<br>• Create own tasks | • **Cannot** edit or delete in-charge or in-charge's tasks<br>• **Cannot** update task status to close when it needs higher-level approval |
| **In-Charge** | • Create team leaders and staff<br>• Create tasks and assign up to staff level (Team Leader, Staff, Self)<br>• Update and delete staff tasks<br>• Create own tasks | • **Cannot** edit or delete team leaders or team leader's tasks<br>• **Cannot** update task status to close when it needs higher-level approval |
| **Team Leader** | • Create staff and assign tasks to them<br>• Create own tasks | • **Cannot** update or delete staff or staff's tasks<br>• **Cannot** update task status to close when it needs higher-level approval |
| **Staff** | • Update task status (Todo, In Progress, Submit for Approval)<br>• Create own tasks | • All other user/task management options are restricted<br>• **Cannot** update task status to close when it needs higher-level approval |

---

## 2. Key Features

### Higher-Level Approval Workflow
- When creating a task, creator can toggle `requires_approval: bool`.
- If checked, the creator must designate an `approver_id`. The endpoint `/api/v1/users/eligible-approvers?for_user_id={assignee_id}` populates this dropdown by ensuring the approver's role rank is strictly higher than the assignee's.
- **Close Restriction Enforcement**: If a task requires approval, non-approvers (including assignee) are barred from marking the task as `COMPLETED`. Attempting to do so returns `HTTP 403 Forbidden`.
- Instead, the assignee submits the task for approval (`POST /api/v1/approvals/{task_id}/submit` or status `PENDING_APPROVAL`).
- Only the designated approver or Super Admin can approve (`COMPLETED`) or reject (`IN_PROGRESS` with review notes) via `POST /api/v1/approvals/{task_id}/decision`.

### Recurrence Engine
- Tasks can be standard or recurring (`is_recurring: bool`).
- Patterns supported: `DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM` with configurable intervals, day of week, day of month, and end dates.
- Upon completion or scheduled interval via `APScheduler`, next instance is automatically spawned and linked via `parent_task_id`.

### Hierarchy Overview with Task Details
- `GET /api/v1/hierarchy/overview`: Super Admin can view all admins, in-charge, team leaders, and staff with task details and status counts.
- `GET /api/v1/hierarchy/tree`: Nested organizational tree.

---

## 3. Seed Accounts for Testing

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `superadmin@example.com` | `SuperAdmin@123` |
| **Admin** | `admin@example.com` | `Admin@123` |
| **In-Charge** | `incharge@example.com` | `InCharge@123` |
| **Team Leader** | `teamleader@example.com` | `TeamLeader@123` |
| **Staff 1** | `staff1@example.com` | `Staff@123` |
| **Staff 2** | `staff2@example.com` | `Staff@123` |

---

## 4. Running the Backend

### Start Server:
```powershell
# From the backend directory
.\venv\Scripts\python.exe run.py
```
Server runs on: `http://localhost:8000`

### Interactive API Documentation:
- Swagger UI: `http://localhost:8000/api/v1/docs`
- ReDoc: `http://localhost:8000/api/v1/redoc`
- OpenAPI JSON: `http://localhost:8000/api/v1/openapi.json`

### Run Automated Test Suite:
```powershell
.\venv\Scripts\pytest.exe -v
```

