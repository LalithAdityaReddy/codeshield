import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class KeystrokeEvent(Base):
    __tablename__ = "keystroke_events"

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
    event_type = Column(String(20), nullable=False)
    payload = Column(JSONB, nullable=True)
    occurred_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationships
    session = relationship("Session", back_populates="keystroke_events")