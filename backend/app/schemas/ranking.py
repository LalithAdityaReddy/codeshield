# Empty schema placeholder — extend when ranking schema is needed
from pydantic import BaseModel
from typing import Optional


class RankingResponse(BaseModel):
    rank: int
    user_id: str
    username: str
    total_score: int
    questions_solved: int
    final_score: int

    class Config:
        from_attributes = True
