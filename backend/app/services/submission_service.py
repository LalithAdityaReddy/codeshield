from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.submission import Submission
from app.models.session import Session
from app.models.question import Question
from app.models.user import User
from app.schemas.submission import SubmissionCreate
from app.execution_engine.runner import run_submission


async def create_submission(
    session_id: str,
    data: SubmissionCreate,
    current_user: User,
    db: AsyncSession
) -> dict:
    # Verify session exists and belongs to user
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    if session.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not active"
        )

    # Verify question exists
    result = await db.execute(
        select(Question).where(Question.id == data.question_id)
    )
    question = result.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )

    # Create submission record
    submission = Submission(
        session_id=session_id,
        question_id=data.question_id,
        user_id=current_user.id,
        code=data.code,
        language=data.language,
        status="pending"
    )

    db.add(submission)
    await db.flush()
    await db.refresh(submission)

    # Run code against test cases
    execution_result = await run_submission(submission, db)

    # Update submission with results
    submission.status = execution_result["status"]
    submission.test_cases_passed = execution_result["test_cases_passed"]
    submission.test_cases_total = execution_result["test_cases_total"]
    submission.runtime_ms = execution_result["runtime_ms"]

    await db.flush()

# Run detection only on accepted submissions
    if submission.status == "accepted":
        from app.services.analytics_service import run_plagiarism_check
        from app.services.ranking_service import compute_rankings
        await run_plagiarism_check(str(submission.id), db)
    # Get test_id from session
        session_result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
        sess = session_result.scalar_one_or_none()
        if sess:
            await compute_rankings(str(sess.test_id), db)

    return {
        "id": str(submission.id),
        "question_id": str(submission.question_id),
        "user_id": str(submission.user_id),
        "language": submission.language,
        "status": submission.status,
        "runtime_ms": submission.runtime_ms,
        "memory_kb": submission.memory_kb,
        "test_cases_passed": submission.test_cases_passed,
        "test_cases_total": submission.test_cases_total,
        "submitted_at": submission.submitted_at,
        "results": execution_result["results"]
    }