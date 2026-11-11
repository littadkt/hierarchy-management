import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_warranty_full_workflow(async_client: AsyncClient):
    await seed_data()

    # 1. Login as Super Admin
    login_res = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test Service Types CRUD
    st_res = await async_client.post(
        "/api/v1/warranty/service-types",
        headers=headers,
        json={"name": "Custom Battery Diagnostic", "description": "High voltage test"},
    )
    assert st_res.status_code == 201, st_res.text
    service_type = st_res.json()
    assert service_type["name"] == "Custom Battery Diagnostic"
    st_id = service_type["id"]

    # Edit service type
    st_edit = await async_client.put(
        f"/api/v1/warranty/service-types/{st_id}",
        headers=headers,
        json={"name": "Custom Battery & Circuit Diagnostic"},
    )
    assert st_edit.status_code == 200
    assert st_edit.json()["name"] == "Custom Battery & Circuit Diagnostic"

    # 3. Test Staff CRUD
    staff_res = await async_client.post(
        "/api/v1/warranty/staff",
        headers=headers,
        json={"name": "George Engineer", "phone": "9876543210", "email": "george@example.com"},
    )
    assert staff_res.status_code == 201
    staff_id = staff_res.json()["id"]

    # 4. Test Brand & Model CRUD
    brand_res = await async_client.post(
        "/api/v1/warranty/brands",
        headers=headers,
        json={"name": "OnePlus"},
    )
    assert brand_res.status_code == 201
    brand_id = brand_res.json()["id"]

    model_res = await async_client.post(
        "/api/v1/warranty/models",
        headers=headers,
        json={"name": "OnePlus 12", "brand_id": brand_id},
    )
    assert model_res.status_code == 201
    model_id = model_res.json()["id"]

    # 5. Register First Warranty Job
    serial_num = "SN-ONEPLUS-999888"
    job1_payload = {
        "customer_name": "Alice Wonderland",
        "customer_phone": "+91 99999 11111",
        "customer_email": "alice@example.com",
        "customer_address": "Flat 4A, Green Valley, Kochi",
        "service_type_id": st_id,
        "staff_id": staff_id,
        "product_name": "OnePlus 12 5G",
        "serial_number": serial_num,
        "brand_id": brand_id,
        "model_id": model_id,
        "work_description": "Display flickering and touch unresponsive at bottom",
        "status": "RECEIVED",
        "notes": "Intake completed with scratches on screen protector",
    }
    job1_res = await async_client.post(
        "/api/v1/warranty/jobs",
        headers=headers,
        json=job1_payload,
    )
    assert job1_res.status_code == 201, job1_res.text
    job1 = job1_res.json()
    assert job1["customer_name"] == "Alice Wonderland"
    assert job1["serial_number"] == serial_num
    assert job1["status"] == "RECEIVED"
    assert job1["job_number"].startswith("WRN-")
    job1_id = job1["id"]

    # 6. Verify Serial History for this serial number (should have 1 record)
    history1_res = await async_client.get(
        f"/api/v1/warranty/jobs/serial-history/{serial_num}",
        headers=headers,
    )
    assert history1_res.status_code == 200
    h1 = history1_res.json()
    assert h1["total_services"] == 1
    assert h1["jobs"][0]["id"] == job1_id

    # 7. Progress Job 1 through statuses: SEND_TO_COMPANY -> WARRANTY_COMPLETED -> DELIVERED
    status1 = await async_client.patch(
        f"/api/v1/warranty/jobs/{job1_id}/status",
        headers=headers,
        json={"status": "SEND_TO_COMPANY", "notes": "Dispatched via BlueDart tracking #BD123"},
    )
    assert status1.status_code == 200
    assert status1.json()["status"] == "SEND_TO_COMPANY"

    status2 = await async_client.patch(
        f"/api/v1/warranty/jobs/{job1_id}/status",
        headers=headers,
        json={"status": "WARRANTY_COMPLETED", "notes": "Mainboard repaired under warranty by OEM"},
    )
    assert status2.status_code == 200
    assert status2.json()["status"] == "WARRANTY_COMPLETED"
    assert status2.json()["completed_date"] is not None

    status3 = await async_client.patch(
        f"/api/v1/warranty/jobs/{job1_id}/status",
        headers=headers,
        json={"status": "DELIVERED", "notes": "Handed over to Alice Wonderland"},
    )
    assert status3.status_code == 200
    assert status3.json()["status"] == "DELIVERED"
    assert status3.json()["delivered_date"] is not None

    # 8. Months later, a SECOND customer brings the SAME serial number product!
    # (e.g. Bob purchased this device refurbished or second-hand)
    job2_payload = {
        "customer_name": "Bob Builder",
        "customer_phone": "+91 88888 22222",
        "customer_email": "bob@example.com",
        "product_name": "OnePlus 12 5G",
        "serial_number": serial_num,
        "brand_id": brand_id,
        "model_id": model_id,
        "work_description": "Battery draining fast, device overheating",
        "status": "RECEIVED",
    }
    job2_res = await async_client.post(
        "/api/v1/warranty/jobs",
        headers=headers,
        json=job2_payload,
    )
    assert job2_res.status_code == 201
    job2 = job2_res.json()
    job2_id = job2["id"]

    # 9. Verify Serial History now shows BOTH records:
    # First serviced for Alice (DELIVERED), and now serviced for Bob (RECEIVED)!
    history2_res = await async_client.get(
        f"/api/v1/warranty/jobs/serial-history/{serial_num}",
        headers=headers,
    )
    assert history2_res.status_code == 200
    h2 = history2_res.json()
    assert h2["total_services"] == 2
    customers = [j["customer_name"] for j in h2["jobs"]]
    assert "Bob Builder" in customers
    assert "Alice Wonderland" in customers

    # 10. Test Search & Filter on /jobs
    list_res = await async_client.get(
        "/api/v1/warranty/jobs?search=Alice",
        headers=headers,
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 1
    assert list_res.json()["items"][0]["customer_name"] == "Alice Wonderland"

    # Status counts verification
    all_jobs_res = await async_client.get("/api/v1/warranty/jobs", headers=headers)
    assert all_jobs_res.status_code == 200
    status_counts = all_jobs_res.json()["status_counts"]
    assert "RECEIVED" in status_counts
    assert "SEND_TO_COMPANY" in status_counts
    assert "WARRANTY_COMPLETED" in status_counts
    assert "REJECTED" in status_counts
    assert "DELIVERED" in status_counts
