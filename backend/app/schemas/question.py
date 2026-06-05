# Empty schema placeholder — extend when full question schema is needed
from pydantic import BaseModel
from typing import Optional, List


class QuestionDetailResponse(BaseModel):
    id: str
    test_id: str
    title: str
    description: str
    difficulty: str
    order_index: int
    constraints: Optional[str] = None
    examples: Optional[list] = None
    function_signature: Optional[str] = None
    driver_code: Optional[str] = None

    class Config:
        from_attributes = True
