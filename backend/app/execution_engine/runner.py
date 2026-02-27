from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.question import Question, TestCase
from app.models.submission import Submission
from app.execution_engine.sandbox import run_code_in_sandbox
import json


def wrap_python_code(user_code: str, driver_code: str, input_data: str) -> str:
    return f"""
import json
import sys

{user_code}

# Driver
{driver_code}
"""


def wrap_javascript_code(user_code: str, driver_code: str, input_data: str) -> str:
    return f"""
{user_code}

// Driver
{driver_code}
"""


def wrap_java_code(user_code: str, driver_code: str) -> str:
    return f"""
import java.util.*;
import java.io.*;

{user_code}

class Main {{
    public static void main(String[] args) throws Exception {{
        {driver_code}
    }}
}}
"""


def wrap_cpp_code(user_code: str, driver_code: str) -> str:
    return f"""
#include <bits/stdc++.h>
using namespace std;

{user_code}

int main() {{
    {driver_code}
    return 0;
}}
"""


def build_python_driver(test_input: str) -> str:
    return f"""
try:
    sol = Solution()
    inputs = {test_input}
    if isinstance(inputs, list):
        result = sol.solve(*inputs)
    else:
        result = sol.solve(inputs)
    print(result)
except Exception as e:
    print(f"Error: {{e}}", file=sys.stderr)
    sys.exit(1)
"""


async def run_submission(
    submission: Submission,
    db: AsyncSession
) -> dict:
    # Get question
    result = await db.execute(
        select(Question).where(Question.id == submission.question_id)
    )
    question = result.scalar_one_or_none()

    # Get test cases
    tc_result = await db.execute(
        select(TestCase)
        .where(TestCase.question_id == submission.question_id)
        .order_by(TestCase.is_hidden)
    )
    test_cases = tc_result.scalars().all()

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
        # Build the code to execute
        if question and question.driver_code:
            # Use custom driver code from admin
            if submission.language == "python3":
                final_code = f"""
import json
import sys

{submission.code}

try:
    sol = Solution()
    {question.driver_code.replace("__INPUT__", repr(tc.input))}
except Exception as e:
    print(f"Error: {{e}}", file=sys.stderr)
    sys.exit(1)
"""
            else:
                final_code = submission.code
        else:
            # Default: treat code as full program
            final_code = submission.code

        execution = await run_code_in_sandbox(
            code=final_code,
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