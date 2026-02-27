from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.schemas.test import TestCreate, TestResponse, TestDetailResponse
from app.services.test_service import create_test, get_all_tests, get_test_by_id
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=TestResponse)
async def create_new_test(
    data: TestCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    test = await create_test(data, current_user, db)
    return {
        "id": str(test.id),
        "title": test.title,
        "description": test.description,
        "duration_mins": test.duration_mins,
        "is_active": test.is_active,
        "created_by": str(test.created_by),
        "starts_at": test.starts_at,
        "ends_at": test.ends_at,
        "created_at": test.created_at
    }


@router.get("/", response_model=List[TestResponse])
async def get_tests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tests = await get_all_tests(db)
    return [
        {
            "id": str(t.id),
            "title": t.title,
            "description": t.description,
            "duration_mins": t.duration_mins,
            "is_active": t.is_active,
            "created_by": str(t.created_by),
            "starts_at": t.starts_at,
            "ends_at": t.ends_at,
            "created_at": t.created_at
        }
        for t in tests
    ]


@router.get("/{test_id}", response_model=TestDetailResponse)
async def get_test(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    test = await get_test_by_id(test_id, db)
    return {
        "id": str(test.id),
        "title": test.title,
        "description": test.description,
        "duration_mins": test.duration_mins,
        "is_active": test.is_active,
        "created_by": str(test.created_by),
        "questions": [
            {
                "id": str(q.id),
                "test_id": str(q.test_id),
                "title": q.title,
                "description": q.description,
                "difficulty": q.difficulty,
                "order_index": q.order_index,
                "constraints": q.constraints,
                "examples": q.examples
            }
            for q in test.questions
        ],
        "created_at": test.created_at
    }