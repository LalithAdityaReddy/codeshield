import uuid
from sqlalchemy import Column, Float, Integer, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    test_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tests.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    rank = Column(Integer, nullable=True)
    total_score = Column(Float, default=0.0)
    questions_solved = Column(Integer, default=0)
    total_runtime_ms = Column(Integer, default=0)
    penalty_score = Column(Float, default=0.0)
    final_score = Column(Float, default=0.0)
    computed_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("test_id", "user_id", name="uq_ranking_test_user"),
    )

    # Relationships
    test = relationship("Test")
    user = relationship("User")