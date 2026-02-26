import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    test_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tests.id", ondelete="CASCADE"),
        nullable=False
    )
    started_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    time_remaining = Column(Integer, nullable=True)
    status = Column(String(20), default="in_progress")
    ip_address = Column(String(50), nullable=True)
    browser_info = Column(String, nullable=True)

    # Unique constraint — one attempt per user per test
    __table_args__ = (
        UniqueConstraint("user_id", "test_id", name="uq_user_test"),
    )

    # Relationships
    user = relationship("User")
    test = relationship("Test", back_populates="sessions")
    submissions = relationship(
        "Submission",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    keystroke_events = relationship(
        "KeystrokeEvent",
        back_populates="session",
        cascade="all, delete-orphan"
    )