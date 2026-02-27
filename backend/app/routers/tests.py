from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.schemas.test import TestCreate, TestResponse, TestDetailResponse
from app.services.test_service import create_test, get_all_tests, get_test_by_id
from app.models.user import User
from app.models.test import Test
from app.models.session import Session
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
@router.post("/{test_id}/start", response_model=dict)
async def start_test_session(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check test exists
    result = await db.execute(
        select(Test).where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()

    if not test:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )

    # Check if session already exists
    result = await db.execute(
        select(Session).where(
            Session.user_id == current_user.id,
            Session.test_id == test_id
        )
    )
    existing_session = result.scalar_one_or_none()

    if existing_session:
        return {
            "session_id": str(existing_session.id),
            "status": existing_session.status,
            "time_remaining": existing_session.time_remaining or test.duration_mins * 60
        }

    # Create new session
    new_session = Session(
        user_id=current_user.id,
        test_id=test_id,
        status="in_progress",
        time_remaining=test.duration_mins * 60
    )

    db.add(new_session)
    await db.flush()
    await db.refresh(new_session)

    return {
        "session_id": str(new_session.id),
        "status": new_session.status,
        "time_remaining": new_session.time_remaining
    }