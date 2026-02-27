from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.submission import SubmissionCreate, SubmissionResponse
from app.services.submission_service import create_submission
from app.models.user import User

router = APIRouter()


@router.post("/{session_id}/submit", response_model=SubmissionResponse)
async def submit_code(
    session_id: str,
    data: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await create_submission(session_id, data, current_user, db)