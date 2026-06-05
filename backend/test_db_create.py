import asyncio
from dotenv import load_dotenv
load_dotenv()
from app.core.database import AsyncSessionLocal
from app.schemas.test import QuestionCreate
from app.services.test_service import create_question

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
    q_create = QuestionCreate(**payload)
    
    # We need a valid test_id! Let's get one from the db
    from sqlalchemy import select
    from app.models.test import Test
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Test.id).limit(1))
        test_id_row = res.first()
        if not test_id_row:
            print("No test found in DB")
            return
            
        test_id_str = str(test_id_row[0])
        print(f"Using test_id: {test_id_str}")
        
        try:
            q = await create_question(test_id_str, q_create, db)
            await db.commit()
            print(f"Created Question ID: {q.id}")
            print(f"Driver Code stored as type: {type(q.driver_code)}")
            
            # Now let's try pushing it through QuestionResponse because that's where I suspect the crash!
            from app.schemas.test import QuestionResponse
            model_resp = QuestionResponse.model_validate(q)
            print("QuestionResponse validation pass!")
        except Exception as e:
            print(f"DB Error: {e}")

asyncio.run(main())
