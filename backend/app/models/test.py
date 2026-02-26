import uuid
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    duration_mins = Column(Integer, nullable=False, default=60)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    is_active = Column(Boolean, default=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationships
    questions = relationship(
        "Question",
        back_populates="test",
        cascade="all, delete-orphan"
    )
    sessions = relationship(
        "Session",
        back_populates="test",
        cascade="all, delete-orphan"
    )