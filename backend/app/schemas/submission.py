from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SubmissionCreate(BaseModel):
    question_id: str
    code: str
    language: str


class TestCaseResult(BaseModel):
    input: str
    expected: str
    got: str
    passed: bool
    error: str
    is_hidden: bool


class SubmissionResponse(BaseModel):
    id: str
    question_id: str
    user_id: str
    language: str
    status: str
    runtime_ms: Optional[int] = None
    memory_kb: Optional[int] = None
    test_cases_passed: int
    test_cases_total: int
    submitted_at: datetime
    results: Optional[List[TestCaseResult]] = None

    class Config:
        from_attributes = True