import pytest
from httpx import AsyncClient
from app.models.user import Role


@pytest.mark.asyncio
async def test_backup_permissions_non_super_admin(async_client: AsyncClient):
    """Verify non-super admin roles (Admin, Staff, etc.) are forbidden from backup/restore"""
    # 1. Login as Super Admin to create a normal Admin user
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    admin_payload = {
        "email": "backup_forbidden_admin@example.com",
        "full_name": "Forbidden Admin",
        "password": "Password123!",
        "role": "ADMIN",
    }
    create_res = await async_client.post("/api/v1/users/", json=admin_payload, headers=sa_headers)
    assert create_res.status_code in [201, 400]

    # 2. Login as the Admin user
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "backup_forbidden_admin@example.com", "password": "Password123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin forbidden from list
    res = await async_client.get("/api/v1/backup/list", headers=admin_headers)
    assert res.status_code == 403

    # Admin forbidden from create
    res = await async_client.post("/api/v1/backup/create", headers=admin_headers)
    assert res.status_code == 403

    # Admin forbidden from status
    res = await async_client.get("/api/v1/backup/status", headers=admin_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_backup_status_and_lifecycle(async_client: AsyncClient):
    """Verify Super Admin can check status, create a backup, list backups, and download"""
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Check backup status
    status_res = await async_client.get("/api/v1/backup/status", headers=sa_headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "22:00" in status_data["schedule"] or "10:00 PM" in status_data["schedule"]
    assert status_data["schedule_hour"] == 22
    assert status_data["schedule_minute"] == 0

    # 3. Create a manual backup
    create_res = await async_client.post("/api/v1/backup/create", headers=sa_headers)
    assert create_res.status_code == 200
    create_data = create_res.json()
    assert create_data["filename"].endswith(".sql")
    assert create_data["size_bytes"] > 0
    created_filename = create_data["filename"]

    # 4. List backups
    list_res = await async_client.get("/api/v1/backup/list", headers=sa_headers)
    assert list_res.status_code == 200
    backups = list_res.json()
    assert any(b["filename"] == created_filename for b in backups)

    # 5. Download backup
    dl_res = await async_client.get(f"/api/v1/backup/download/{created_filename}", headers=sa_headers)
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 0
    assert b"PostgreSQL database dump" in dl_res.content or b"CREATE TABLE" in dl_res.content

    # Verify backup includes departments and users department column
    content_str = dl_res.content.decode("utf-8", errors="ignore")
    assert "public.departments" in content_str
    assert "COPY public.departments" in content_str
    assert "department" in content_str
    assert "COPY public.users" in content_str

    # 6. Delete test backup
    del_res = await async_client.delete(f"/api/v1/backup/{created_filename}", headers=sa_headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_backup_restore_upload_super_admin(async_client: AsyncClient):
    """Verify Super Admin can restore database by uploading a SQL file"""
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Create a snapshot backup to use for restore
    create_res = await async_client.post("/api/v1/backup/create", headers=sa_headers)
    assert create_res.status_code == 200
    created_filename = create_res.json()["filename"]

    # 3. Download the snapshot content
    dl_res = await async_client.get(f"/api/v1/backup/download/{created_filename}", headers=sa_headers)
    assert dl_res.status_code == 200
    dump_bytes = dl_res.content

    # 4. Upload and restore from this backup file
    files = {"file": ("restore_test.sql", dump_bytes, "application/sql")}
    restore_res = await async_client.post(
        "/api/v1/backup/restore/upload",
        files=files,
        headers=sa_headers,
    )
    assert restore_res.status_code == 200
    restore_data = restore_res.json()
    assert restore_data["success"] is True
    assert "restore_test.sql" in restore_data["restored_file"]

    # Clean up test snapshot
    await async_client.delete(f"/api/v1/backup/{created_filename}", headers=sa_headers)


@pytest.mark.asyncio
async def test_backup_restore_existing_super_admin(async_client: AsyncClient):
    """Verify Super Admin can restore database directly from an existing backup in local storage"""
    # 1. Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    # 2. Create a snapshot backup
    create_res = await async_client.post("/api/v1/backup/create", headers=sa_headers)
    assert create_res.status_code == 200
    created_filename = create_res.json()["filename"]

    # 3. Restore directly from existing filename
    restore_res = await async_client.post(
        f"/api/v1/backup/restore/existing/{created_filename}",
        headers=sa_headers,
    )
    assert restore_res.status_code == 200
    restore_data = restore_res.json()
    assert restore_data["success"] is True
    assert restore_data["restored_file"] == created_filename

    # Clean up test snapshot
    await async_client.delete(f"/api/v1/backup/{created_filename}", headers=sa_headers)
