from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TestCaseSchema(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False


class QuestionCreate(BaseModel):
    title: str
    description: str
    difficulty: str = "Medium"
    order_index: int = 1
    constraints: Optional[str] = None
    examples: Optional[list] = None
    function_signature: Optional[str] = None
    driver_code: Optional[str] = None
    test_cases: List[TestCaseSchema] = []


class QuestionResponse(BaseModel):
    id: str
    test_id: str
    title: str
    description: str
    difficulty: str
    order_index: int
    constraints: Optional[str] = None
    examples: Optional[list] = None
    function_signature: Optional[str] = None

    class Config:
        from_attributes = True


class TestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    duration_mins: int = 60
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class TestResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    duration_mins: int
    is_active: bool
    created_by: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TestDetailResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    duration_mins: int
    is_active: bool
    created_by: str
    questions: List[QuestionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True