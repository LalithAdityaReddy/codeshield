from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime, timezone, timedelta
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


@router.post("/{test_id}/start")
async def start_session(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get most recent session for this user and test
    result = await db.execute(
        select(Session).where(
            Session.test_id == test_id,
            Session.user_id == current_user.id
        ).order_by(Session.started_at.desc())
    )
    existing = result.scalars().first()

    now = datetime.now(timezone.utc)

    if existing:
        # If session is in progress — return it
        if existing.status == "in_progress":
            time_elapsed = (now - existing.started_at.replace(tzinfo=timezone.utc)).total_seconds()
            test_result = await db.execute(select(Test).where(Test.id == test_id))
            test = test_result.scalar_one_or_none()
            duration_seconds = (test.duration_mins if test else 60) * 60
            time_remaining = max(0, duration_seconds - int(time_elapsed))
            return {
                "session_id": str(existing.id),
                "status": existing.status,
                "time_remaining": time_remaining
            }

        # If completed — enforce 24hr cooldown
        if existing.status == "completed":
            completed_at = existing.submitted_at or existing.started_at
            if completed_at.tzinfo is None:
                completed_at = completed_at.replace(tzinfo=timezone.utc)
            time_since = now - completed_at
            if time_since < timedelta(hours=24):
                hours_left = 24 - int(time_since.total_seconds() / 3600)
                minutes_left = 60 - int((time_since.total_seconds() % 3600) / 60)
                raise HTTPException(
                    status_code=403,
                    detail=f"You can attempt this test again in {hours_left}h {minutes_left}m"
                )

    # Create new session
    test_result = await db.execute(select(Test).where(Test.id == test_id))
    test = test_result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    new_session = Session(
        test_id=test_id,
        user_id=current_user.id,
        status="in_progress",
        time_remaining=test.duration_mins * 60
    )
    db.add(new_session)
    await db.flush()

    return {
        "session_id": str(new_session.id),
        "status": "in_progress",
        "time_remaining": test.duration_mins * 60
    }


@router.post("/{test_id}/complete")
async def complete_session(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Session).where(
            Session.test_id == test_id,
            Session.user_id == current_user.id,
            Session.status == "in_progress"
        ).order_by(Session.started_at.desc())
    )
    session = result.scalars().first()

    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    session.status = "completed"
    session.submitted_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Session completed"}