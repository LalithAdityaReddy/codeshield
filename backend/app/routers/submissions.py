from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.submission import SubmissionCreate, SubmissionResponse
from app.services.submission_service import create_submission
from app.models.user import User
from app.models.question import Question
from pydantic import BaseModel

router = APIRouter()


class RunRequest(BaseModel):
    code: str
    language: str
    input: str = ""


class RunSamplesRequest(BaseModel):
    code: str
    language: str
    question_id: str


@router.post("/run")
async def run_code(
    data: RunRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Run code against a custom stdin input (no test cases, not scored).
    Used for the exam 'Run' button.
    """
    from app.execution_engine.runner import run_custom_input
    result = await run_custom_input(
        code=data.code,
        language=data.language,
        custom_input=data.input
    )
    return {
        "success": result["success"],
        "output": result.get("output", ""),
        "error": result.get("error", ""),
        "runtime_ms": result.get("runtime_ms", 0),
    }


@router.post("/run-samples")
async def run_sample_testcases(
    data: RunSamplesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Run code against the visible (non-hidden) test cases for a question.
    No DB write, no ranking update — used for the 'Run' button in exam.
    """
    from app.execution_engine.sandbox import run_code_in_sandbox
    from app.models.question import TestCase
    from sqlalchemy import select

    # Fetch only visible test cases
    tc_result = await db.execute(
        select(TestCase)
        .where(
            TestCase.question_id == data.question_id,
            TestCase.is_hidden == False
        )
        .order_by(TestCase.created_at)
    )
    test_cases = tc_result.scalars().all()

    results = []
    passed = 0
    total = len(test_cases)

    q_result = await db.execute(
        select(Question).where(Question.id == data.question_id)
    )
    question = q_result.scalar_one_or_none()

    for tc in test_cases:
        full_code = data.code
        if question and getattr(question, "driver_code", None):
            if "{USER_CODE}" in question.driver_code:
                full_code = question.driver_code.replace("{USER_CODE}", data.code)
            else:
                full_code = f"{data.code}\n\n{question.driver_code}"

        execution = await run_code_in_sandbox(
            code=full_code,
            language=data.language,
            input_data=tc.input
        )
        if not execution["success"]:
            err = execution["error"]
            status = "time_limit_exceeded" if "Time Limit" in err else "runtime_error"
            results.append({
                "input": tc.input,
                "expected": tc.expected_output,
                "got": "",
                "passed": False,
                "error": err,
                "status": status,
            })
        else:
            actual = execution["output"].strip()
            expected = tc.expected_output.strip()
            ok = actual == expected
            if ok:
                passed += 1
            results.append({
                "input": tc.input,
                "expected": expected,
                "got": actual,
                "passed": ok,
                "error": "",
                "status": "accepted" if ok else "wrong_answer",
            })

    return {
        "passed": passed,
        "total": total,
        "results": results,
    }


@router.post("/{session_id}/submit", response_model=SubmissionResponse)
async def submit_code(
    session_id: str,
    data: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await create_submission(session_id, data, current_user, db)