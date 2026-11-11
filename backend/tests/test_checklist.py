import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_checklist_personal_quick_tasks(async_client: AsyncClient):
    await seed_data()

    # 1. Login as Staff 1
    staff_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "staff1@example.com", "password": "Staff@123"},
    )
    assert staff_login.status_code == 200
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}

    # 2. Login as Admin
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "Admin@123"},
    )
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 3. Staff 1 creates quick checklist items
    create_item1 = await async_client.post(
        "/api/v1/checklist/",
        headers=staff_headers,
        json={"title": "Refill paper in printer 2"},
    )
    assert create_item1.status_code == 201
    item1 = create_item1.json()
    assert item1["title"] == "Refill paper in printer 2"
    assert item1["is_completed"] is False
    item1_id = item1["id"]

    create_item2 = await async_client.post(
        "/api/v1/checklist/",
        headers=staff_headers,
        json={"title": "Check morning courier delivery"},
    )
    assert create_item2.status_code == 201
    item2_id = create_item2.json()["id"]

    # 4. Admin creates their own checklist item
    admin_item = await async_client.post(
        "/api/v1/checklist/",
        headers=admin_headers,
        json={"title": "Review department budget quarterly"},
    )
    assert admin_item.status_code == 201
    admin_item_id = admin_item.json()["id"]

    # 5. Verify Privacy ("all their own"):
    # Staff 1 lists their checklist -> must have item1 and item2, but NOT admin_item
    staff_list = await async_client.get("/api/v1/checklist/", headers=staff_headers)
    assert staff_list.status_code == 200
    staff_ids = [it["id"] for it in staff_list.json()]
    assert item1_id in staff_ids
    assert item2_id in staff_ids
    assert admin_item_id not in staff_ids

    # Admin lists their checklist -> must have admin_item, but NOT staff's items
    admin_list = await async_client.get("/api/v1/checklist/", headers=admin_headers)
    assert admin_list.status_code == 200
    admin_ids = [it["id"] for it in admin_list.json()]
    assert admin_item_id in admin_ids
    assert item1_id not in admin_ids

    # 6. Staff 1 toggles checkbox on item 1 (mark completed)
    toggle_res = await async_client.patch(
        f"/api/v1/checklist/{item1_id}/toggle",
        headers=staff_headers,
        json={"is_completed": True},
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_completed"] is True

    # 7. Staff 1 edits item 2
    edit_res = await async_client.put(
        f"/api/v1/checklist/{item2_id}",
        headers=staff_headers,
        json={"title": "Check morning courier delivery (Urgent: legal docs)"},
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["title"] == "Check morning courier delivery (Urgent: legal docs)"

    # 8. Admin attempts to edit or delete Staff 1's checklist item -> 404 (not found in admin's items)
    forbidden_edit = await async_client.put(
        f"/api/v1/checklist/{item1_id}",
        headers=admin_headers,
        json={"title": "Admin hacked staff item"},
    )
    assert forbidden_edit.status_code == 404

    forbidden_del = await async_client.delete(
        f"/api/v1/checklist/{item1_id}",
        headers=admin_headers,
    )
    assert forbidden_del.status_code == 404

    # 9. Staff 1 deletes item 2
    del_res = await async_client.delete(
        f"/api/v1/checklist/{item2_id}",
        headers=staff_headers,
    )
    assert del_res.status_code == 204

    # 10. Staff 1 clears completed items (clears item 1)
    clear_res = await async_client.delete(
        "/api/v1/checklist/clear-completed",
        headers=staff_headers,
    )
    assert clear_res.status_code == 200
    assert clear_res.json()["cleared_count"] == 1

    # Verify Staff 1's list is now empty
    empty_list = await async_client.get("/api/v1/checklist/", headers=staff_headers)
    assert empty_list.status_code == 200
    assert len(empty_list.json()) == 0

    # 11. Test selecting a user for a checklist item
    # Fetch selectable users from /api/v1/checklist/users
    users_res = await async_client.get("/api/v1/checklist/users", headers=staff_headers)
    assert users_res.status_code == 200
    user_list = users_res.json()
    assert len(user_list) > 0

    # Find admin's user id
    admin_info = await async_client.get("/api/v1/auth/me", headers=admin_headers)
    assert admin_info.status_code == 200
    admin_user_id = admin_info.json()["id"]

    # Staff 1 creates a checklist item with Admin selected as target_user
    tagged_item_res = await async_client.post(
        "/api/v1/checklist/",
        headers=staff_headers,
        json={
            "title": "Discuss supply chain issue with Admin",
            "target_user_id": admin_user_id,
        },
    )
    assert tagged_item_res.status_code == 201
    tagged_item = tagged_item_res.json()
    assert tagged_item["target_user_id"] == admin_user_id
    assert tagged_item["target_user"] is not None
    assert tagged_item["target_user"]["id"] == admin_user_id

    # Verify that selecting a user DOES NOT add the item to Admin's checklist
    # (Remains purely in Staff 1's checklist - "just a select option")
    admin_checklist_res = await async_client.get("/api/v1/checklist/", headers=admin_headers)
    assert admin_checklist_res.status_code == 200
    admin_items = [it["id"] for it in admin_checklist_res.json()]
    assert tagged_item["id"] not in admin_items

    # Staff 1's checklist DOES have the item with target_user populated
    staff_checklist_res = await async_client.get("/api/v1/checklist/", headers=staff_headers)
    assert staff_checklist_res.status_code == 200
    my_tagged = [it for it in staff_checklist_res.json() if it["id"] == tagged_item["id"]][0]
    assert my_tagged["target_user_id"] == admin_user_id
    assert my_tagged["target_user"]["full_name"] == admin_info.json()["full_name"]

    # Update item to clear selected user
    update_res = await async_client.put(
        f"/api/v1/checklist/{tagged_item['id']}",
        headers=staff_headers,
        json={"target_user_id": None},
    )
    assert update_res.status_code == 200
    assert update_res.json()["target_user_id"] is None


