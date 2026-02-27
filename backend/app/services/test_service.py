from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from app.models.test import Test
from app.models.question import Question, TestCase
from app.models.user import User
from app.schemas.test import TestCreate, QuestionCreate
import uuid


async def create_test(
    data: TestCreate,
    current_user: User,
    db: AsyncSession
) -> Test:
    new_test = Test(
        title=data.title,
        description=data.description,
        duration_mins=data.duration_mins,
        created_by=current_user.id,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        is_active=True
    )

    db.add(new_test)
    await db.flush()
    await db.refresh(new_test)

    return new_test


async def get_all_tests(db: AsyncSession) -> list:
    result = await db.execute(
        select(Test).where(Test.is_active == True).order_by(Test.created_at.desc())
    )
    return result.scalars().all()


async def get_test_by_id(test_id: str, db: AsyncSession) -> Test:
    result = await db.execute(
        select(Test)
        .options(selectinload(Test.questions))
        .where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )

    return test


async def create_question(
    test_id: str,
    data: QuestionCreate,
    db: AsyncSession
) -> Question:
    # Verify test exists
    result = await db.execute(
        select(Test).where(Test.id == test_id)
    )
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found"
        )

    # Create question
    new_question = Question(
        test_id=test_id,
        title=data.title,
        description=data.description,
        difficulty=data.difficulty,
        order_index=data.order_index,
        constraints=data.constraints,
        examples=data.examples
    )

    db.add(new_question)
    await db.flush()
    await db.refresh(new_question)

    # Create test cases
    for tc in data.test_cases:
        new_tc = TestCase(
            question_id=new_question.id,
            input=tc.input,
            expected_output=tc.expected_output,
            is_hidden=tc.is_hidden
        )
        db.add(new_tc)

    await db.flush()

    return new_question


async def get_questions_for_test(
    test_id: str,
    db: AsyncSession
) -> list:
    result = await db.execute(
        select(Question)
        .where(Question.test_id == test_id)
        .order_by(Question.order_index)
    )
    return result.scalars().all()