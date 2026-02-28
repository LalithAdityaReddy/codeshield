from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.services.ranking_service import get_leaderboard, compute_rankings
from app.models.user import User
from app.models.submission import Submission
from app.models.detection import DetectionResult
from app.models.session import Session
from app.models.keystroke import KeystrokeEvent

router = APIRouter()


@router.get("/{test_id}/leaderboard")
async def get_test_leaderboard(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_leaderboard(test_id, db)


@router.post("/{test_id}/compute")
async def trigger_compute_rankings(
    test_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    await compute_rankings(test_id, db)
    return {"message": "Rankings computed successfully"}


@router.get("/{test_id}/analytics")
async def get_test_analytics(
    test_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Full analytics for a test — for admin dashboard."""

    leaderboard = await get_leaderboard(test_id, db)

    # Get all submissions with detection results
    result = await db.execute(
        select(Submission, DetectionResult, User)
        .outerjoin(
            DetectionResult,
            Submission.id == DetectionResult.submission_id
        )
        .join(User, Submission.user_id == User.id)
        .join(Session, Submission.session_id == Session.id)
        .where(Session.test_id == test_id)
        .order_by(Submission.submitted_at.desc())
    )
    rows = result.all()

    submissions_data = []
    for submission, detection, user in rows:
        submissions_data.append({
            "submission_id": str(submission.id),
            "user_id": str(submission.user_id),
            "username": user.username,
            "question_id": str(submission.question_id),
            "language": submission.language,
            "status": submission.status,
            "runtime_ms": submission.runtime_ms,
            "test_cases_passed": submission.test_cases_passed,
            "test_cases_total": submission.test_cases_total,
            "submitted_at": str(submission.submitted_at),
            "detection": {
                "ai_score": detection.ai_final_score if detection else None,
                "plag_score": detection.plag_final_score if detection else None,
                "is_ai_flagged": detection.is_ai_flagged if detection else False,
                "is_plag_flagged": detection.is_plag_flagged if detection else False,
                "plag_matched_with": str(detection.plag_matched_submission_id)
                    if detection and detection.plag_matched_submission_id else None,
            } if detection else None
        })

    # Get violation counts per user
    violations_result = await db.execute(
        select(
            KeystrokeEvent.session_id,
            Session.user_id,
        )
        .join(Session, KeystrokeEvent.session_id == Session.id)
        .where(
            Session.test_id == test_id,
            KeystrokeEvent.event_type.in_([
                "no_face", "multiple_faces",
                "tab_switch", "fullscreen_exit",
                "paste"
            ])
        )
    )
    violation_rows = violations_result.all()

    violation_counts = {}
    for _, user_id in violation_rows:
        uid = str(user_id)
        violation_counts[uid] = violation_counts.get(uid, 0) + 1

    return {
        "test_id": test_id,
        "total_candidates": len(leaderboard),
        "leaderboard": leaderboard,
        "submissions": submissions_data,
        "violation_counts": violation_counts,
    }


@router.get("/candidate/{user_id}/report")
async def get_candidate_report(
    user_id: str,
    test_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Detailed report for a single candidate."""

    # Get all submissions
    result = await db.execute(
        select(Submission, DetectionResult)
        .outerjoin(
            DetectionResult,
            Submission.id == DetectionResult.submission_id
        )
        .join(Session, Submission.session_id == Session.id)
        .where(
            Submission.user_id == user_id,
            Session.test_id == test_id
        )
        .order_by(Submission.submitted_at)
    )
    rows = result.all()

    # Get violations
    violations_result = await db.execute(
        select(KeystrokeEvent)
        .join(Session, KeystrokeEvent.session_id == Session.id)
        .where(
            Session.user_id == user_id,
            Session.test_id == test_id,
            KeystrokeEvent.event_type.in_([
                "no_face", "multiple_faces",
                "tab_switch", "fullscreen_exit",
                "paste", "copy_attempt"
            ])
        )
        .order_by(KeystrokeEvent.occurred_at)
    )
    violations = violations_result.scalars().all()

    return {
        "user_id": user_id,
        "test_id": test_id,
        "submissions": [
            {
                "submission_id": str(s.id),
                "question_id": str(s.question_id),
                "status": s.status,
                "language": s.language,
                "runtime_ms": s.runtime_ms,
                "submitted_at": str(s.submitted_at),
                "ai_score": d.ai_final_score if d else None,
                "plag_score": d.plag_final_score if d else None,
                "is_ai_flagged": d.is_ai_flagged if d else False,
                "is_plag_flagged": d.is_plag_flagged if d else False,
                "detection_explanation": d.explanation if d else None,
            }
            for s, d in rows
        ],
        "violations": [
            {
                "type": v.event_type,
                "payload": v.payload,
                "occurred_at": str(v.occurred_at)
            }
            for v in violations
        ],
        "total_violations": len(violations),
    }
@router.get("/{test_id}/candidate/{user_id}/detailed")
async def get_detailed_candidate_report(
    test_id: str,
    user_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    from app.models.question import Question
    from datetime import timezone

    # Get user info
    user_result = await db.execute(select(User).where(User.id == user_id))
    candidate = user_result.scalar_one_or_none()

    # Get session
    session_result = await db.execute(
        select(Session).where(
            Session.test_id == test_id,
            Session.user_id == user_id
        ).order_by(Session.started_at.desc())
    )
    session = session_result.scalars().first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all submissions with detection
    subs_result = await db.execute(
        select(Submission, DetectionResult, Question)
        .outerjoin(DetectionResult, Submission.id == DetectionResult.submission_id)
        .join(Question, Submission.question_id == Question.id)
        .where(Submission.session_id == session.id)
        .order_by(Submission.submitted_at)
    )
    rows = subs_result.all()

    # Get all keystroke events
    events_result = await db.execute(
        select(KeystrokeEvent)
        .where(KeystrokeEvent.session_id == session.id)
        .order_by(KeystrokeEvent.occurred_at)
    )
    events = events_result.scalars().all()

    # Compute event breakdowns
    event_counts = {}
    for e in events:
        event_counts[e.event_type] = event_counts.get(e.event_type, 0) + 1

    total_events = len(events)
    keystrokes = event_counts.get("keypress", 0)
    pastes = event_counts.get("paste", 0)
    tab_switches = event_counts.get("tab_switch", 0)
    no_face = event_counts.get("no_face", 0)
    multiple_faces = event_counts.get("multiple_faces", 0)
    fullscreen_exits = event_counts.get("fullscreen_exit", 0)
    copy_attempts = event_counts.get("copy_attempt", 0)

    # Compute typing speed stats
    speeds = [
        e.payload.get("typing_speed_ms", 0)
        for e in events
        if e.event_type == "keypress" and e.payload
    ]
    avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else 0

    # Compute scam percentages
    total_violations = tab_switches + no_face + multiple_faces + fullscreen_exits + copy_attempts
    paste_score = min(pastes * 20, 100)
    tab_score = min(tab_switches * 25, 100)
    face_score = min((no_face + multiple_faces) * 15, 100)
    copy_score = min(copy_attempts * 30, 100)
    screen_score = min(fullscreen_exits * 20, 100)

    # Get best detection scores across all submissions
    all_plag_scores = [
        d.plag_final_score for _, d, _ in rows if d and d.plag_final_score
    ]
    all_ai_scores = [
        d.ai_final_score for _, d, _ in rows if d and d.ai_final_score
    ]

    max_plag = max(all_plag_scores) if all_plag_scores else 0
    max_ai = max(all_ai_scores) if all_ai_scores else 0

    # Overall integrity score (lower = more suspicious)
    integrity_score = max(0, 100 - (
        max_plag * 40 +
        max_ai * 30 +
        min(total_violations * 5, 30)
    ))

    # Build explanation
    explanations = []

    if max_plag > 0.75:
        explanations.append({
            "type": "plagiarism",
            "severity": "high",
            "percentage": round(max_plag * 100),
            "reason": "Code structure and token patterns are highly similar to another submission after variable normalization. Different variable names but identical logic flow detected.",
            "evidence": f"Token similarity, AST structure, and n-gram analysis all indicate copied code."
        })
    elif max_plag > 0.50:
        explanations.append({
            "type": "plagiarism",
            "severity": "medium",
            "percentage": round(max_plag * 100),
            "reason": "Moderately similar code structure detected. Could be same algorithmic approach.",
            "evidence": "Partial token and structure overlap found."
        })

    if max_ai > 0.70:
        explanations.append({
            "type": "ai_generated",
            "severity": "high",
            "percentage": round(max_ai * 100),
            "reason": "Code shows characteristics of AI generation: excessive commenting, uniform indentation, generic variable names, and large paste bursts.",
            "evidence": f"Paste events: {pastes}, Avg typing speed: {avg_speed}ms, Uniform code structure detected."
        })

    if tab_switches > 2:
        explanations.append({
            "type": "tab_switching",
            "severity": "high" if tab_switches > 5 else "medium",
            "percentage": min(tab_switches * 20, 100),
            "reason": f"Candidate switched tabs or windows {tab_switches} times during the exam.",
            "evidence": "Browser visibility change events logged."
        })

    if no_face + multiple_faces > 3:
        explanations.append({
            "type": "camera_violation",
            "severity": "high",
            "percentage": min((no_face + multiple_faces) * 15, 100),
            "reason": f"Face not detected {no_face} times. Multiple faces detected {multiple_faces} times.",
            "evidence": "Camera monitoring events logged during exam."
        })

    if pastes > 2:
        explanations.append({
            "type": "paste_detected",
            "severity": "medium",
            "percentage": min(pastes * 20, 100),
            "reason": f"Large paste events detected {pastes} times. Code may have been copied from external source.",
            "evidence": "Keystroke monitoring detected sudden large code insertions."
        })

    if copy_attempts > 0:
        explanations.append({
            "type": "copy_attempt",
            "severity": "medium",
            "percentage": min(copy_attempts * 30, 100),
            "reason": f"Copy keyboard shortcut used {copy_attempts} times.",
            "evidence": "Keyboard event monitoring detected Ctrl+C / Cmd+C."
        })

    return {
        "candidate": {
            "user_id": user_id,
            "username": candidate.username if candidate else "Unknown",
            "email": candidate.email if candidate else "Unknown",
        },
        "session": {
            "session_id": str(session.id),
            "started_at": str(session.started_at),
"ended_at": str(session.submitted_at) if session.submitted_at else None,            
"status": session.status,
        },
        "submissions": [
            {
                "submission_id": str(s.id),
                "question_title": q.title,
                "question_difficulty": q.difficulty,
                "status": s.status,
                "language": s.language,
                "runtime_ms": s.runtime_ms,
                "test_cases_passed": s.test_cases_passed,
                "test_cases_total": s.test_cases_total,
                "submitted_at": str(s.submitted_at),
                "plag_score": round((d.plag_final_score or 0) * 100) if d else 0,
                "ai_score": round((d.ai_final_score or 0) * 100) if d else 0,
                "is_plag_flagged": d.is_plag_flagged if d else False,
                "is_ai_flagged": d.is_ai_flagged if d else False,
                "plag_breakdown": {
                    "token_similarity": round((d.plag_token_similarity or 0) * 100) if d else 0,
                    "tfidf_similarity": round((d.plag_tfidf_similarity or 0) * 100) if d else 0,
                    "ngram_similarity": round((d.plag_ngram_similarity or 0) * 100) if d else 0,
                    "ast_similarity": round((d.plag_ast_similarity or 0) * 100) if d else 0,
                } if d else None,
                "ai_breakdown": {
                    "comment_density": round((d.ai_comment_density or 0) * 100) if d else 0,
                    "paste_burst": round((d.ai_paste_burst_score or 0) * 100) if d else 0,
                    "typing_anomaly": round((d.ai_typing_anomaly or 0) * 100) if d else 0,
                    "template_match": round((d.ai_template_match or 0) * 100) if d else 0,
                    "indent_uniformity": round((d.ai_indent_uniformity or 0) * 100) if d else 0,
                } if d else None,
            }
            for s, d, q in rows
        ],
        "behavior": {
            "total_keystrokes": keystrokes,
            "total_pastes": pastes,
            "tab_switches": tab_switches,
            "no_face_events": no_face,
            "multiple_face_events": multiple_faces,
            "fullscreen_exits": fullscreen_exits,
            "copy_attempts": copy_attempts,
            "avg_typing_speed_ms": avg_speed,
        },
        "scam_scores": {
            "plagiarism_pct": round(max_plag * 100),
            "ai_generated_pct": round(max_ai * 100),
            "tab_switching_pct": tab_score,
            "camera_violation_pct": face_score,
            "paste_score_pct": paste_score,
            "copy_attempt_pct": copy_score,
            "screen_exit_pct": screen_score,
            "overall_integrity_score": round(integrity_score),
        },
        "explanations": explanations,
        "verdict": (
            "high_risk" if integrity_score < 40 else
            "medium_risk" if integrity_score < 70 else
            "low_risk"
        )
    }