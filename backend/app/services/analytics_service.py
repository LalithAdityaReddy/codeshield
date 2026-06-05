from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.submission import Submission
from app.models.detection import DetectionResult
from app.models.keystroke import KeystrokeEvent
from app.ml_engine.plagiarism_detector import compare_against_all
from app.ml_engine.ai_detector import calculate_ai_score
import uuid


async def run_detection(
    submission_id: str,
    db: AsyncSession
) -> DetectionResult:
    """
    Run plagiarism + AI detection for a submission.
    Called for ALL submissions (not just accepted ones).
    """
    # Get current submission
    result = await db.execute(
        select(Submission).where(Submission.id == submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        return None

    # Get the current submission's test_id
    from app.models.session import Session
    curr_session_result = await db.execute(
        select(Session).where(Session.id == submission.session_id)
    )
    curr_session = curr_session_result.scalar_one_or_none()
    current_test_id = curr_session.test_id if curr_session else None

    # Get all OTHER submissions for same question by DIFFERENT users IN THE SAME CONTEST
    query = select(Submission).join(Session, Submission.session_id == Session.id).where(
        Submission.question_id == submission.question_id,
        Submission.id != submission.id,
        Submission.user_id != submission.user_id,
        Submission.language == submission.language,
    )
    if current_test_id:
        query = query.where(Session.test_id == current_test_id)

    result = await db.execute(query)
    other_submissions = result.scalars().all()

    other_codes = [
        (str(s.id), s.code)
        for s in other_submissions
        if s.code
    ]

    # Run plagiarism detection
    plag_result = await compare_against_all(submission.code, other_codes)

    # Get ALL keystroke events for this session
    ks_result = await db.execute(
        select(KeystrokeEvent).where(
            KeystrokeEvent.session_id == submission.session_id
        ).order_by(KeystrokeEvent.occurred_at)
    )
    keystroke_events = ks_result.scalars().all()
    events_data = [
        {"type": e.event_type, "payload": e.payload or {}}
        for e in keystroke_events
    ]

    # Run AI detection (passing the code + all behavioral events)
    ai_result = calculate_ai_score(submission.code, events_data)

    # Upsert detection result
    existing = await db.execute(
        select(DetectionResult).where(
            DetectionResult.submission_id == submission_id
        )
    )
    detection = existing.scalar_one_or_none()

    explanation_parts = []

    # 1. Handle Plagiarism Explanation
    if plag_result["is_flagged"]:
        matched_id = str(plag_result.get("matched_submission_id", ""))[:6]
        explanation_parts.append(
            f"Flagged for Plagiarism: Code is {int(plag_result['final_score']*100)}% identical to another submission in this contest (ID: {matched_id})."
        )
    elif plag_result["final_score"] > 0.5:
        explanation_parts.append(f"Moderate similarity ({int(plag_result['final_score']*100)}%) to another submission found, but below plagiarism threshold.")

    # 2. Handle Paste & AI Explanation
    if ai_result["paste_burst_score"] > 0.8:
        explanation_parts.append("Flagged for Cheating: An immediate massive copy-paste event was detected from the proctoring logs.")
        # User requested immediate copy-paste = high plagiarism/cheating score
        ai_result["is_flagged"] = True
        ai_result["final_score"] = max(ai_result["final_score"], 0.99)
        plag_result["is_flagged"] = True
    elif ai_result["is_flagged"]:
        reasons = []
        if ai_result["indent_uniformity"] > 0.8:
            reasons.append("machine-perfect indentation")
        if ai_result["var_naming_entropy"] > 0.6:
            reasons.append("highly generic algorithmic variables")
        if ai_result["typing_anomaly"] > 0.7:
            reasons.append("unnatural typing speed/rhythm")
        
        reason_str = ", ".join(reasons) if reasons else "suspicious structural patterns"
        explanation_parts.append(f"Flagged for AI Assistance: Detected {reason_str}.")

    if not explanation_parts:
        explanation_parts.append("Submission looks clean. Normal typing behavior and unique code structure detected.")

    summary_text = " ".join(explanation_parts)

    fields = dict(
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
        explanation={"plagiarism": plag_result, "ai": ai_result, "summary": summary_text}
    )

    if detection:
        for k, v in fields.items():
            setattr(detection, k, v)
    else:
        detection = DetectionResult(submission_id=submission_id, **fields)
        db.add(detection)

    await db.flush()
    return detection


# Alias so existing imports from submission_service still work
run_plagiarism_check = run_detection