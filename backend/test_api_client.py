import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.dependencies import get_current_admin
from app.models.user import User

def override_get_current_admin():
    return User(id="c615112d-6dc2-4d7d-b680-93315382638b", email="admin@test.com", role="admin")

app.dependency_overrides[get_current_admin] = override_get_current_admin

async def main():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "title": "A",
            "description": "B",
            "difficulty": "Medium",
            "order_index": 1,
            "function_signature": {"python3": "def a(): pass"},
            "driver_code": {"python3": ""},
            "examples": [{"input": "a", "output": "b", "explanation": ""}],
            "test_cases": [{"input": "1", "expected_output": "1", "is_hidden": False}],
            "active_lang_tab": "java"
        }
        res = await ac.post("/api/questions/c76a0947-5cb6-4001-a7f6-48abc8d36ae3/questions", json=payload)
        print("STATUS:", res.status_code)
        import pprint
        pprint.pprint(res.json())

asyncio.run(main())
