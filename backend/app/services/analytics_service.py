from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.submission import Submission
from app.models.detection import DetectionResult
from app.models.keystroke import KeystrokeEvent
from app.ml_engine.plagiarism_detector import compare_against_all
from app.ml_engine.ai_detector import calculate_ai_score
import uuid


async def run_plagiarism_check(
    submission_id: str,
    db: AsyncSession
) -> DetectionResult:
    # Get current submission
    result = await db.execute(
        select(Submission).where(Submission.id == submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        return None

    # Get all other accepted submissions for same question
    result = await db.execute(
        select(Submission).where(
            Submission.question_id == submission.question_id,
            Submission.id != submission.id,
            Submission.language == submission.language,
            Submission.status == "accepted"
        )
    )
    other_submissions = result.scalars().all()

    other_codes = [
        (str(s.id), s.code)
        for s in other_submissions
        if s.code
    ]

    # Run plagiarism detection
    plag_result = await compare_against_all(submission.code, other_codes)

    # Get keystroke events for AI detection
    ks_result = await db.execute(
        select(KeystrokeEvent).where(
            KeystrokeEvent.session_id == submission.session_id
        )
    )
    keystroke_events = ks_result.scalars().all()
    events_data = [
        {"type": e.event_type, "payload": e.payload}
        for e in keystroke_events
    ]

    # Run AI detection
    ai_result = calculate_ai_score(submission.code, events_data)

    # Check if detection result already exists
    existing = await db.execute(
        select(DetectionResult).where(
            DetectionResult.submission_id == submission_id
        )
    )
    detection = existing.scalar_one_or_none()

    if detection:
        # Update existing
        detection.plag_token_similarity = plag_result["token_similarity"]
        detection.plag_tfidf_similarity = plag_result["tfidf_similarity"]
        detection.plag_ngram_similarity = plag_result["ngram_similarity"]
        detection.plag_ast_similarity = plag_result["ast_similarity"]
        detection.plag_final_score = plag_result["final_score"]
        detection.plag_matched_submission_id = (
            uuid.UUID(plag_result["matched_submission_id"])
            if plag_result.get("matched_submission_id") else None
        )
        detection.is_plag_flagged = plag_result["is_flagged"]

        detection.ai_comment_density = ai_result["comment_density"]
        detection.ai_line_length_score = ai_result["line_length_score"]
        detection.ai_indent_uniformity = ai_result["indent_uniformity"]
        detection.ai_var_naming_entropy = ai_result["var_naming_entropy"]
        detection.ai_paste_burst_score = ai_result["paste_burst_score"]
        detection.ai_typing_anomaly = ai_result["typing_anomaly"]
        detection.ai_template_match = ai_result["template_match"]
        detection.ai_final_score = ai_result["final_score"]
        detection.is_ai_flagged = ai_result["is_flagged"]

        detection.explanation = {
            "plagiarism": plag_result,
            "ai": ai_result
        }
    else:
        # Create new
        detection = DetectionResult(
            submission_id=submission_id,
            plag_token_similarity=plag_result["token_similarity"],
            plag_tfidf_similarity=plag_result["tfidf_similarity"],
            plag_ngram_similarity=plag_result["ngram_similarity"],
            plag_ast_similarity=plag_result["ast_similarity"],
            plag_final_score=plag_result["final_score"],
            plag_matched_submission_id=(
                uuid.UUID(plag_result["matched_submission_id"])
                if plag_result.get("matched_submission_id") else None
            ),
            is_plag_flagged=plag_result["is_flagged"],
            ai_comment_density=ai_result["comment_density"],
            ai_line_length_score=ai_result["line_length_score"],
            ai_indent_uniformity=ai_result["indent_uniformity"],
            ai_var_naming_entropy=ai_result["var_naming_entropy"],
            ai_paste_burst_score=ai_result["paste_burst_score"],
            ai_typing_anomaly=ai_result["typing_anomaly"],
            ai_template_match=ai_result["template_match"],
            ai_final_score=ai_result["final_score"],
            is_ai_flagged=ai_result["is_flagged"],
            explanation={
                "plagiarism": plag_result,
                "ai": ai_result
            }
        )
        db.add(detection)

    await db.flush()
    return detection