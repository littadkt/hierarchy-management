import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_task_and_subtask_reorder(async_client: AsyncClient):
    await seed_data()

    # Login Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    sa_token = sa_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {sa_token}"}

    me_res = await async_client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    my_id = me_res.json()["id"]

    # 1. Create two tasks
    res1 = await async_client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "First Test Task Reorder",
            "priority": "MEDIUM",
            "assigned_to_id": my_id,
        },
    )
    assert res1.status_code == 201, res1.text
    task1_id = res1.json()["id"]

    res2 = await async_client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Second Test Task Reorder",
            "priority": "HIGH",
            "assigned_to_id": my_id,
        },
    )
    assert res2.status_code == 201, res2.text
    task2_id = res2.json()["id"]

    # 2. Reorder tasks: put task2 first, task1 second
    reorder_res = await async_client.patch(
        "/api/v1/tasks/reorder",
        headers=headers,
        json={"task_ids": [task2_id, task1_id]},
    )
    assert reorder_res.status_code == 200, reorder_res.text

    # Verify tasks list returned has task2 before task1
    list_res = await async_client.get("/api/v1/tasks", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    ids_in_list = [t["id"] for t in items if t["id"] in [task1_id, task2_id]]
    assert ids_in_list == [task2_id, task1_id]

    # 3. Create two subtasks under task1
    sub1_res = await async_client.post(
        f"/api/v1/tasks/{task1_id}/subtasks",
        headers=headers,
        json={"title": "Subtask A"},
    )
    assert sub1_res.status_code == 201, sub1_res.text
    sub1_id = sub1_res.json()["id"]

    sub2_res = await async_client.post(
        f"/api/v1/tasks/{task1_id}/subtasks",
        headers=headers,
        json={"title": "Subtask B"},
    )
    assert sub2_res.status_code == 201, sub2_res.text
    sub2_id = sub2_res.json()["id"]

    # 4. Reorder subtasks: sub2 first, sub1 second
    sub_reorder_res = await async_client.patch(
        f"/api/v1/tasks/{task1_id}/subtasks/reorder",
        headers=headers,
        json={"subtask_ids": [sub2_id, sub1_id]},
    )
    assert sub_reorder_res.status_code == 200, sub_reorder_res.text

    # Verify subtasks list under task1
    sub_list_res = await async_client.get(f"/api/v1/tasks/{task1_id}/subtasks", headers=headers)
    assert sub_list_res.status_code == 200
    sub_items = sub_list_res.json()
    sub_ids = [s["id"] for s in sub_items if s["id"] in [sub1_id, sub2_id]]
    assert sub_ids == [sub2_id, sub1_id]

    # 5. Checklist reorder
    cl1 = await async_client.post("/api/v1/checklist", headers=headers, json={"title": "Checklist Item 1"})
    assert cl1.status_code == 201
    cl1_id = cl1.json()["id"]

    cl2 = await async_client.post("/api/v1/checklist", headers=headers, json={"title": "Checklist Item 2"})
    assert cl2.status_code == 201
    cl2_id = cl2.json()["id"]

    cl_reorder = await async_client.patch(
        "/api/v1/checklist/reorder",
        headers=headers,
        json={"item_ids": [cl2_id, cl1_id]},
    )
    assert cl_reorder.status_code == 200

    cl_list = await async_client.get("/api/v1/checklist", headers=headers)
    assert cl_list.status_code == 200
    cl_items = [c["id"] for c in cl_list.json() if c["id"] in [cl1_id, cl2_id]]
    assert cl_items == [cl2_id, cl1_id]
