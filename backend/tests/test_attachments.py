import io
import pytest
from httpx import AsyncClient
from app.db.seed_demo_data import seed_data


@pytest.mark.asyncio
async def test_task_and_subtask_attachments(async_client: AsyncClient):
    await seed_data()

    # Login as Super Admin
    sa_login = await async_client.post(
        "/api/v1/auth/login",
        data={"username": "superadmin@example.com", "password": "SuperAdmin@123"},
    )
    assert sa_login.status_code == 200
    headers = {"Authorization": f"Bearer {sa_login.json()['access_token']}"}

    # 1. Create a task
    create_task_res = await async_client.post(
        "/api/v1/tasks/",
        headers=headers,
        json={
            "title": "Attachment Verification Task",
            "description": "Task created for verifying file attachment options",
            "priority": "HIGH",
            "assigned_to_id": sa_login.json()["user"]["id"],
            "requires_approval": False,
        },
    )
    assert create_task_res.status_code == 201
    task = create_task_res.json()
    task_id = task["id"]

    # 2. Upload file attachment to task
    file_content = b"Sample attachment text content for verification"
    files = [
        ("files", ("test_doc.txt", io.BytesIO(file_content), "text/plain"))
    ]
    upload_res = await async_client.post(
        f"/api/v1/tasks/{task_id}/attachments",
        headers=headers,
        files=files,
    )
    assert upload_res.status_code == 201
    uploaded_attachments = upload_res.json()
    assert len(uploaded_attachments) == 1
    att = uploaded_attachments[0]
    assert att["filename"] == "test_doc.txt"
    assert att["file_size"] == len(file_content)
    assert att["task_id"] == task_id
    assert att["subtask_id"] is None
    att_id = att["id"]

    # 3. List attachments on task
    list_res = await async_client.get(
        f"/api/v1/tasks/{task_id}/attachments",
        headers=headers,
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Download / preview attachment
    download_res = await async_client.get(
        f"/api/v1/tasks/attachments/{att_id}/download?download=true",
        headers=headers,
    )
    assert download_res.status_code == 200
    assert download_res.content == file_content

    # 5. Create a subtask under task
    create_sub_res = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks",
        headers=headers,
        json={
            "title": "Subtask with Attachment",
            "description": "Subtask for testing subtask file attachments",
        },
    )
    assert create_sub_res.status_code == 201
    subtask = create_sub_res.json()
    subtask_id = subtask["id"]

    # 6. Upload file attachment to subtask
    sub_file_content = b"Subtask specific checklist or blueprint image"
    sub_files = [
        ("files", ("blueprint.png", io.BytesIO(sub_file_content), "image/png"))
    ]
    sub_upload_res = await async_client.post(
        f"/api/v1/tasks/{task_id}/subtasks/{subtask_id}/attachments",
        headers=headers,
        files=sub_files,
    )
    assert sub_upload_res.status_code == 201
    sub_att = sub_upload_res.json()[0]
    assert sub_att["filename"] == "blueprint.png"
    assert sub_att["subtask_id"] == subtask_id
    sub_att_id = sub_att["id"]

    # 7. List subtask attachments
    list_sub_res = await async_client.get(
        f"/api/v1/tasks/{task_id}/subtasks/{subtask_id}/attachments",
        headers=headers,
    )
    assert list_sub_res.status_code == 200
    assert len(list_sub_res.json()) == 1

    # 8. Check Task Detail includes task attachments and subtask attachments
    detail_res = await async_client.get(
        f"/api/v1/tasks/{task_id}",
        headers=headers,
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["attachments"]) == 1
    assert detail["attachments"][0]["id"] == att_id
    assert len(detail["subtasks"]) == 1
    assert len(detail["subtasks"][0]["attachments"]) == 1
    assert detail["subtasks"][0]["attachments"][0]["id"] == sub_att_id

    # 9. Delete subtask attachment
    del_sub_res = await async_client.delete(
        f"/api/v1/tasks/attachments/{sub_att_id}",
        headers=headers,
    )
    assert del_sub_res.status_code == 204

    # Verify deleted
    list_sub_after = await async_client.get(
        f"/api/v1/tasks/{task_id}/subtasks/{subtask_id}/attachments",
        headers=headers,
    )
    assert list_sub_after.status_code == 200
    assert len(list_sub_after.json()) == 0

    # 10. Delete task attachment
    del_task_att_res = await async_client.delete(
        f"/api/v1/tasks/attachments/{att_id}",
        headers=headers,
    )
    assert del_task_att_res.status_code == 204
