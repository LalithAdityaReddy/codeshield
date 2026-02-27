from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question, TestCase
from app.models.submission import Submission
from app.execution_engine.sandbox import run_code_in_sandbox


async def run_submission(
    submission: Submission,
    db: AsyncSession
) -> dict:
    # Get question and test cases
    result = await db.execute(
        select(TestCase)
        .where(TestCase.question_id == submission.question_id)
        .order_by(TestCase.is_hidden)
    )
    test_cases = result.scalars().all()

    if not test_cases:
        return {
            "status": "wrong_answer",
            "test_cases_passed": 0,
            "test_cases_total": 0,
            "runtime_ms": 0,
            "results": []
        }

    passed = 0
    total = len(test_cases)
    results = []
    max_runtime = 0

    for tc in test_cases:
        execution = await run_code_in_sandbox(
            code=submission.code,
            language=submission.language,
            input_data=tc.input
        )

        if not execution["success"]:
            if "Time Limit" in execution["error"]:
                status = "time_limit_exceeded"
            else:
                status = "runtime_error"

            results.append({
                "input": tc.input,
                "expected": tc.expected_output,
                "got": "",
                "passed": False,
                "error": execution["error"],
                "is_hidden": tc.is_hidden
            })
            continue

        actual_output = execution["output"].strip()
        expected_output = tc.expected_output.strip()
        test_passed = actual_output == expected_output

        if test_passed:
            passed += 1

        max_runtime = max(max_runtime, execution["runtime_ms"])

        results.append({
            "input": tc.input if not tc.is_hidden else "hidden",
            "expected": expected_output if not tc.is_hidden else "hidden",
            "got": actual_output if not tc.is_hidden else "hidden",
            "passed": test_passed,
            "error": "",
            "is_hidden": tc.is_hidden
        })

    # Determine final status
    if passed == total:
        final_status = "accepted"
    else:
        final_status = "wrong_answer"

    return {
        "status": final_status,
        "test_cases_passed": passed,
        "test_cases_total": total,
        "runtime_ms": max_runtime,
        "results": results
    }