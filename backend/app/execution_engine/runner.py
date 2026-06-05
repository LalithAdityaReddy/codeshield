import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question, TestCase
from app.models.submission import Submission
from app.execution_engine.sandbox import run_code_in_sandbox


def resolve_driver_code(question: Question, language: str, user_code: str) -> str:
    """
    Resolve the full executable code to run, given the question config and user code.

    Priority:
    1. If driver_code is a JSON dict: use per-language driver, inject {USER_CODE} or append.
    2. If driver_code is plain text (legacy): append it to user code.
    3. If no driver_code: run user code as-is (full CP-style program).

    Never raises — always returns runnable code.
    """
    if not question or not getattr(question, "driver_code", None):
        # Pure CP-style: user writes the full program
        return user_code

    raw_driver = question.driver_code.strip()
    if not raw_driver:
        return user_code

    # Try JSON dict format first: {"python3": "...", "cpp": "..."}
    try:
        driver_map = json.loads(raw_driver)
        if isinstance(driver_map, dict):
            lang_driver = driver_map.get(language, "")
            if not lang_driver:
                # No driver for this language — run as CP-style
                return user_code
            if "{USER_CODE}" in lang_driver:
                return lang_driver.replace("{USER_CODE}", user_code)
            else:
                return f"{user_code}\n\n{lang_driver}"
    except (json.JSONDecodeError, ValueError):
        pass

    # Legacy plain-text driver (not JSON): append after user code
    if "{USER_CODE}" in raw_driver:
        return raw_driver.replace("{USER_CODE}", user_code)
    return f"{user_code}\n\n{raw_driver}"


async def run_submission(
    submission: Submission,
    db: AsyncSession
) -> dict:
    """
    CP-style runner: user code is executed as a full program.
    Test case input is piped via stdin — matches Codeforces / competitive programming model.
    Supports optional per-language driver code for LeetCode-style function wrapping.
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
    failure_status = "wrong_answer"

    # Resolve the full code once (driver is per-question, not per-test-case)
    full_code = resolve_driver_code(question, submission.language, submission.code)

    for tc in test_cases:
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
    Run user code against a custom stdin input (no test cases, not scored).
    Used for the exam 'Run' button with custom input — always runs code as-is.
    """
    execution = await run_code_in_sandbox(
        code=code,
        language=language,
        input_data=custom_input
    )
    return execution