import uuid
from sqlalchemy import Column, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class DetectionResult(Base):
    __tablename__ = "detection_results"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    submission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # AI Detection Scores
    ai_comment_density = Column(Float, default=0.0)
    ai_line_length_score = Column(Float, default=0.0)
    ai_indent_uniformity = Column(Float, default=0.0)
    ai_var_naming_entropy = Column(Float, default=0.0)
    ai_paste_burst_score = Column(Float, default=0.0)
    ai_typing_anomaly = Column(Float, default=0.0)
    ai_template_match = Column(Float, default=0.0)
    ai_final_score = Column(Float, default=0.0)

    # Plagiarism Scores
    plag_token_similarity = Column(Float, default=0.0)
    plag_tfidf_similarity = Column(Float, default=0.0)
    plag_ngram_similarity = Column(Float, default=0.0)
    plag_ast_similarity = Column(Float, default=0.0)
    plag_final_score = Column(Float, default=0.0)
    plag_matched_submission = Column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id"),
        nullable=True
    )

    # Flags
    is_ai_flagged = Column(Boolean, default=False)
    is_plag_flagged = Column(Boolean, default=False)
    explanation = Column(JSONB, nullable=True)
    analyzed_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    # Relationships
    submission = relationship(
        "Submission",
        back_populates="detection_result",
        foreign_keys=[submission_id]
    )