import asyncio
import json
from dotenv import load_dotenv
load_dotenv()
from app.core.database import AsyncSessionLocal
from app.schemas.test import QuestionCreate

async def main():
    payload = {
        "title": "Test Title",
        "description": "Test Desc",
        "difficulty": "Medium",
        "order_index": 1,
        "function_signature": {"python3": "def test():\n    pass"},
        "driver_code": {"python3": "# {USER_CODE}"},
        "examples": [{"input": "1", "output": "1"}],
        "test_cases": [{"input": "1", "expected_output": "1", "is_hidden": False}]
    }
    try:
        q = QuestionCreate(**payload)
        print("Pydantic Validation PASS")
    except Exception as e:
        print("Pydantic Validation FAIL:")
        print(e)

asyncio.run(main())
