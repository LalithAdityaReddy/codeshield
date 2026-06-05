import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_current_admin
from app.models.user import User

def override_get_current_admin():
    return User(id="c615112d-6dc2-4d7d-b680-93315382638b", email="admin@test.com", is_admin=True)

app.dependency_overrides[get_current_admin] = override_get_current_admin

client = TestClient(app)

payload = {
    "title": "A",
    "description": "B",
    "difficulty": "Medium",
    "order_index": 1,
    "function_signature": {"python3": "def a(): pass"},
    "driver_code": {"python3": ""},
    "examples": [{"input": "a", "output": "b", "explanation": ""}],
    "test_cases": [{"input": "1", "expected_output": "1", "is_hidden": False}]
}

# we need a valid test ID
import sqlalchemy
from app.core.database import SessionLocal
with SessionLocal() as db:
    pass # we can't easily sync db here. we'll just query async.

