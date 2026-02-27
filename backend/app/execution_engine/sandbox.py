import asyncio
import tempfile
import os
import time
from app.execution_engine.languages import LANGUAGE_CONFIG, TIME_LIMIT_SECONDS


async def run_code_in_sandbox(
    code: str,
    language: str,
    input_data: str,
    time_limit: int = TIME_LIMIT_SECONDS
) -> dict:
    config = LANGUAGE_CONFIG.get(language)

    if not config:
        return {
            "success": False,
            "output": "",
            "error": f"Unsupported language: {language}",
            "runtime_ms": 0
        }

    # Create temp directory for this execution
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write code to file
        code_file = os.path.join(tmpdir, config["filename"])
        with open(code_file, "w") as f:
            f.write(code)

        # Write input to file
        input_file = os.path.join(tmpdir, "input.txt")
        with open(input_file, "w") as f:
            f.write(input_data)

        try:
            start_time = time.time()

            # Compile if needed
            if config["compile_cmd"]:
                compile_result = await asyncio.wait_for(
                    asyncio.create_subprocess_shell(
                        config["compile_cmd"],
                        cwd=tmpdir,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    ),
                    timeout=10
                )
                compile_proc = compile_result
                stdout, stderr = await compile_proc.communicate()

                if compile_proc.returncode != 0:
                    return {
                        "success": False,
                        "output": "",
                        "error": stderr.decode("utf-8"),
                        "runtime_ms": 0
                    }

            # Run the code
            process = await asyncio.create_subprocess_shell(
                f"{config['run_cmd']} < input.txt",
                cwd=tmpdir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=time_limit
                )
            except asyncio.TimeoutError:
                process.kill()
                return {
                    "success": False,
                    "output": "",
                    "error": "Time Limit Exceeded",
                    "runtime_ms": time_limit * 1000
                }

            runtime_ms = int((time.time() - start_time) * 1000)

            if process.returncode != 0:
                return {
                    "success": False,
                    "output": "",
                    "error": stderr.decode("utf-8"),
                    "runtime_ms": runtime_ms
                }

            return {
                "success": True,
                "output": stdout.decode("utf-8").strip(),
                "error": "",
                "runtime_ms": runtime_ms
            }

        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": str(e),
                "runtime_ms": 0
            }