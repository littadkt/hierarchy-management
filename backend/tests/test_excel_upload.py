import io
import pytest
import openpyxl
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_download_excel_templates(async_client: AsyncClient):
    await seed_data()

    # Login as Super Admin
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert login_resp.status_code == 200
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # 1. Inventory template
    resp = await async_client.get("/api/v1/inventory/template", headers=headers)
    assert resp.status_code == 200
    assert "spreadsheetml" in resp.headers["content-type"]
    wb = openpyxl.load_workbook(io.BytesIO(resp.content))
    assert "Inventory Import" in wb.sheetnames
    sheet = wb["Inventory Import"]
    assert sheet.cell(row=1, column=1).value == "Barcode"

    # 2. Wholesale Products template
    resp_prod = await async_client.get("/api/v1/wholesale/products/template", headers=headers)
    assert resp_prod.status_code == 200
    wb_prod = openpyxl.load_workbook(io.BytesIO(resp_prod.content))
    assert "Products Import" in wb_prod.sheetnames
    sheet_prod = wb_prod["Products Import"]
    assert sheet_prod.cell(row=1, column=1).value == "Barcode"

    # 3. Wholesale Customers template
    resp_cust = await async_client.get("/api/v1/wholesale/customers/template", headers=headers)
    assert resp_cust.status_code == 200
    wb_cust = openpyxl.load_workbook(io.BytesIO(resp_cust.content))
    assert "Customers Import" in wb_cust.sheetnames
    sheet_cust = wb_cust["Customers Import"]
    assert sheet_cust.cell(row=1, column=1).value == "Customer Name"


@pytest.mark.asyncio
async def test_upload_inventory_excel(async_client: AsyncClient):
    # Login as Super Admin
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Create in-memory Excel workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inventory"
    ws.append(["Barcode", "Product Name", "Rate", "Category", "Brand", "Vendor", "Quantity"])
    ws.append(["XL-INV-001", "USB-C Hub Multiport", 1299.50, "Electronics", "Anker", "Global Tech", 40])
    ws.append(["XL-INV-002", "Ergonomic Mousepad", 350.00, "Accessories", "Logitech", "Global Tech", 150])
    # Add a faulty row
    ws.append(["", "Missing Barcode Item", 100.0, "Misc", "Misc", "Misc", 5])

    file_buf = io.BytesIO()
    wb.save(file_buf)
    file_buf.seek(0)

    files = {
        "file": ("inventory_test.xlsx", file_buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }

    resp = await async_client.post("/api/v1/inventory/upload-excel", headers=headers, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] == 3
    assert data["success_count"] == 2
    assert data["failed_count"] == 1
    assert len(data["errors"]) == 1

    # Verify item was inserted into inventory
    resp_get = await async_client.get("/api/v1/inventory/by-code/XL-INV-001", headers=headers)
    assert resp_get.status_code == 200
    item = resp_get.json()
    assert item["name"] == "USB-C Hub Multiport"
    assert item["quantity"] == 40

    # Upload again with updated quantity -> test upsert
    wb2 = openpyxl.Workbook()
    ws2 = wb2.active
    ws2.append(["Barcode", "Product Name", "Rate", "Category", "Brand", "Vendor", "Quantity"])
    ws2.append(["XL-INV-001", "USB-C Hub Multiport Updated", 1199.00, "Electronics", "Anker", "Global Tech", 80])
    file_buf2 = io.BytesIO()
    wb2.save(file_buf2)
    file_buf2.seek(0)
    files2 = {
        "file": ("inventory_test_updated.xlsx", file_buf2.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }
    resp_up = await async_client.post("/api/v1/inventory/upload-excel", headers=headers, files=files2)
    assert resp_up.status_code == 200
    data_up = resp_up.json()
    assert data_up["total_rows"] == 1
    assert data_up["updated_count"] == 1
    assert data_up["success_count"] == 0

    # Verify updated
    resp_get2 = await async_client.get("/api/v1/inventory/by-code/XL-INV-001", headers=headers)
    assert resp_get2.status_code == 200
    item2 = resp_get2.json()
    assert item2["name"] == "USB-C Hub Multiport Updated"
    assert item2["quantity"] == 80


@pytest.mark.asyncio
async def test_upload_wholesale_products_and_customers(async_client: AsyncClient):
    # Login as Super Admin
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # 1. Wholesale Products Excel
    wb_prod = openpyxl.Workbook()
    ws_prod = wb_prod.active
    ws_prod.append(["Barcode", "Product Name", "Rate", "Category", "Brand", "Vendor", "Quantity"])
    ws_prod.append(["WS-XL-100", "Organic Green Tea 1kg", 850.00, "Beverages", "TeaCo", "Hill Agro", 50])
    file_buf = io.BytesIO()
    wb_prod.save(file_buf)
    file_buf.seek(0)
    files_prod = {
        "file": ("ws_products.xlsx", file_buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }

    resp_prod = await async_client.post("/api/v1/wholesale/products/upload-excel", headers=headers, files=files_prod)
    assert resp_prod.status_code == 200
    prod_data = resp_prod.json()
    assert prod_data["success_count"] == 1

    # Verify wholesale product lookup
    resp_check = await async_client.get("/api/v1/wholesale/products/by-code/WS-XL-100", headers=headers)
    assert resp_check.status_code == 200
    assert resp_check.json()["name"] == "Organic Green Tea 1kg"

    # 2. Wholesale Customers Excel / CSV
    csv_content = "Customer Name,Place,Contact Number,Email,Address\nExcel Customer One,Kochi,+91 9991112222,ex1@test.com,MG Road Kochi\nExcel Customer Two,Trivandrum,+91 9993334444,ex2@test.com,Technopark\n"
    files_cust = {
        "file": ("customers.csv", csv_content.encode("utf-8"), "text/csv")
    }

    resp_cust = await async_client.post("/api/v1/wholesale/customers/upload-excel", headers=headers, files=files_cust)
    assert resp_cust.status_code == 200
    cust_data = resp_cust.json()
    assert cust_data["total_rows"] == 2
    assert cust_data["success_count"] == 2

    # Verify customer lookup
    resp_list = await async_client.get("/api/v1/wholesale/customers?search=Excel+Customer+One", headers=headers)
    assert resp_list.status_code == 200
    assert len(resp_list.json()["items"]) >= 1

