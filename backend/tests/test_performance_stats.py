import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_task_performance_statistics_with_subtasks(async_client: AsyncClient):
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

    # 1. Create a task with 3 subtasks
    task_res = await async_client.post(
        "/api/v1/tasks",
        headers=headers,
        json={
            "title": "Performance Test Primary Task",
            "priority": "HIGH",
            "assigned_to_id": my_id,
        },
    )
    assert task_res.status_code == 201, task_res.text
    task_id = task_res.json()["id"]

    # Add 3 subtasks
    s1 = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
        json={"title": "Subtask 1 - Research"},
    )
    assert s1.status_code == 201
    s1_id = s1.json()["id"]

    s2 = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
        json={"title": "Subtask 2 - Draft"},
    )
    assert s2.status_code == 201
    s2_id = s2.json()["id"]

    s3 = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
        json={"title": "Subtask 3 - Finalize"},
    )
    assert s3.status_code == 201
    s3_id = s3.json()["id"]

    # Toggle 2 of the subtasks to completed
    toggle1 = await async_client.patch(
        f"/api/v1/tasks/{task_id}/subtasks/{s1_id}/toggle",
        headers=headers,
        json={"is_completed": True},
    )
    assert toggle1.status_code == 200
    assert toggle1.json()["is_completed"] is True

    toggle2 = await async_client.patch(
        f"/api/v1/tasks/{task_id}/subtasks/{s2_id}/toggle",
        headers=headers,
        json={"is_completed": True},
    )
    assert toggle2.status_code == 200
    assert toggle2.json()["is_completed"] is True

    # 2. Call GET /api/v1/stats/performance
    perf_res = await async_client.get("/api/v1/stats/performance", headers=headers)
    assert perf_res.status_code == 200, perf_res.text
    data = perf_res.json()

    assert "task_metrics" in data
    assert "subtask_metrics" in data
    assert "overall_performance_score" in data
    assert "team_performance" in data

    # Verify subtask metrics reflect the created subtasks
    subtasks = data["subtask_metrics"]
    assert subtasks["total_subtasks"] >= 3
    assert subtasks["completed_subtasks"] >= 2
    assert subtasks["subtask_completion_rate"] > 0
    assert subtasks["avg_subtasks_per_task"] > 0

    # 3. Call GET /api/v1/stats/dashboard and verify task_performance is included
    dash_res = await async_client.get("/api/v1/stats/dashboard", headers=headers)
    assert dash_res.status_code == 200, dash_res.text
    dash_data = dash_res.json()
    assert "task_performance" in dash_data
    assert dash_data["task_performance"] is not None
    assert dash_data["task_performance"]["subtask_metrics"]["total_subtasks"] >= 3

    # 4. Filter performance by user_id
    user_perf_res = await async_client.get(
        f"/api/v1/stats/performance?user_id={my_id}", headers=headers
    )
    assert user_perf_res.status_code == 200
    user_data = user_perf_res.json()
    assert user_data["task_metrics"]["total_tasks"] >= 1
    assert user_data["subtask_metrics"]["total_subtasks"] >= 3
    assert user_data["subtask_metrics"]["completed_subtasks"] >= 2
