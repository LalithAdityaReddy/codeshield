from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.schemas.test import QuestionCreate, QuestionResponse
from app.services.test_service import create_question, get_questions_for_test
from app.models.user import User

router = APIRouter()


@router.post("/{test_id}/questions", response_model=QuestionResponse)
async def add_question_to_test(
    test_id: str,
    data: QuestionCreate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    question = await create_question(test_id, data, db)
    return {
        "id": str(question.id),
        "test_id": str(question.test_id),
        "title": question.title,
        "description": question.description,
        "difficulty": question.difficulty,
        "order_index": question.order_index,
        "constraints": question.constraints,
        "examples": question.examples
    }


@router.get("/{test_id}/questions", response_model=List[QuestionResponse])
async def get_test_questions(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    questions = await get_questions_for_test(test_id, db)
    return [
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
        for q in questions
    ]