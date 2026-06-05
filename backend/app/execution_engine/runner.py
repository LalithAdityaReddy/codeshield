from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question, TestCase
from app.models.submission import Submission
from app.execution_engine.sandbox import run_code_in_sandbox


async def run_submission(
    submission: Submission,
    db: AsyncSession
) -> dict:
    """
    CP-style runner: user code is executed as a full program.
    Test case input is piped via stdin — no driver code wrapping.
    This matches the Codeforces / competitive programming model.
    """

    # Get test cases and question
    tc_result = await db.execute(
        select(TestCase)
        .where(TestCase.question_id == submission.question_id)
        .order_by(TestCase.is_hidden)
    )
    test_cases = tc_result.scalars().all()

    q_result = await db.execute(
        select(Question).where(Question.id == submission.question_id)
    )
    question = q_result.scalar_one_or_none()

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
    # Track the most severe failure status
    failure_status = "wrong_answer"

    for tc in test_cases:
        # Append driver code if defined (e.g. for function-only submissions)
        full_code = submission.code
        if question and getattr(question, "driver_code", None):
            import json
            try:
                driver_map = json.loads(question.driver_code)
                lang_driver = driver_map.get(submission.language)
                if lang_driver:
                    if "{USER_CODE}" in lang_driver:
                        full_code = lang_driver.replace("{USER_CODE}", submission.code)
                    else:
                        full_code = f"{submission.code}\n\n{lang_driver}"
            except Exception:
                pass

        # Run user code directly — stdin is the test case input
        execution = await run_code_in_sandbox(
            code=full_code,
            language=submission.language,
            input_data=tc.input
        )

        if not execution["success"]:
            err = execution["error"]
            if "Time Limit" in err:
                tc_status = "time_limit_exceeded"
                failure_status = "time_limit_exceeded"
            else:
                tc_status = "runtime_error"
                if failure_status != "time_limit_exceeded":
                    failure_status = "runtime_error"

            results.append({
                "input": tc.input if not tc.is_hidden else "hidden",
                "expected": tc.expected_output if not tc.is_hidden else "hidden",
                "got": "",
                "passed": False,
                "error": err if not tc.is_hidden else "Error (hidden test)",
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

    final_status = "accepted" if passed == total else failure_status

    return {
        "status": final_status,
        "test_cases_passed": passed,
        "test_cases_total": total,
        "runtime_ms": max_runtime,
        "results": results
    }


async def run_custom_input(
    code: str,
    language: str,
    custom_input: str
) -> dict:
    """
    Run user code against a custom input string (for the 'Run' button in exam).
    Returns output or error — not scored.
    """
    execution = await run_code_in_sandbox(
        code=code,
        language=language,
        input_data=custom_input
    )
    return execution