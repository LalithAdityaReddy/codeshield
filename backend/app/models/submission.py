import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False
    )
    question_id = Column(
        UUID(as_uuid=True),
        ForeignKey("questions.id"),
        nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    code = Column(Text, nullable=False)
    language = Column(String(30), nullable=False)
    status = Column(String(20), default="pending")
    runtime_ms = Column(Integer, nullable=True)
    memory_kb = Column(Integer, nullable=True)
    test_cases_passed = Column(Integer, default=0)
    test_cases_total = Column(Integer, default=0)
    submitted_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationships
    session = relationship("Session", back_populates="submissions")
    question = relationship("Question", back_populates="submissions")
    user = relationship("User")
    detection_result = relationship(
        "DetectionResult",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan"
    )