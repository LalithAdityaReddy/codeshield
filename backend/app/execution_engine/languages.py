LANGUAGE_CONFIG = {
    "python3": {
        "image": "python:3.11-slim",
        "filename": "solution.py",
        "run_cmd": "python3 solution.py",
        "compile_cmd": None,
    },
    "javascript": {
        "image": "node:18-slim",
        "filename": "solution.js",
        "run_cmd": "node solution.js",
        "compile_cmd": None,
    },
    "java": {
        "image": "openjdk:17-slim",
        "filename": "Solution.java",
        "run_cmd": "java Solution",
        "compile_cmd": "javac Solution.java",
    },
    "cpp": {
        "image": "gcc:12",
        "filename": "solution.cpp",
        "run_cmd": "./solution",
        "compile_cmd": "g++ -o solution solution.cpp",
    },
}

SUPPORTED_LANGUAGES = list(LANGUAGE_CONFIG.keys())

TIME_LIMIT_SECONDS = 5
MEMORY_LIMIT_MB = 128