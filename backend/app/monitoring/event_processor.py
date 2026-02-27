from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.keystroke import KeystrokeEvent
from app.models.session import Session
from typing import List
import json


async def process_keystroke_event(
    session_id: str,
    question_id: str,
    event_type: str,
    payload: dict,
    db: AsyncSession
):
    event = KeystrokeEvent(
        session_id=session_id,
        question_id=question_id,
        event_type=event_type,
        payload=payload
    )
    db.add(event)
    await db.flush()
    return event


async def get_session_events(
    session_id: str,
    db: AsyncSession
) -> List[KeystrokeEvent]:
    result = await db.execute(
        select(KeystrokeEvent)
        .where(KeystrokeEvent.session_id == session_id)
        .order_by(KeystrokeEvent.occurred_at)
    )
    return result.scalars().all()


async def get_paste_events(
    session_id: str,
    db: AsyncSession
) -> List[KeystrokeEvent]:
    result = await db.execute(
        select(KeystrokeEvent)
        .where(
            KeystrokeEvent.session_id == session_id,
            KeystrokeEvent.event_type == "paste"
        )
    )
    return result.scalars().all()


async def get_violation_events(
    session_id: str,
    db: AsyncSession
) -> List[KeystrokeEvent]:
    result = await db.execute(
        select(KeystrokeEvent)
        .where(
            KeystrokeEvent.session_id == session_id,
            KeystrokeEvent.event_type.in_([
                "paste",
                "focus_out",
                "tab_switch",
                "no_face",
                "multiple_faces",
                "looking_away",
                "noise_detected",
                "fullscreen_exit"
            ])
        )
        .order_by(KeystrokeEvent.occurred_at)
    )
    return result.scalars().all()


async def get_typing_stats(
    session_id: str,
    db: AsyncSession
) -> dict:
    result = await db.execute(
        select(func.count(KeystrokeEvent.id))
        .where(
            KeystrokeEvent.session_id == session_id,
            KeystrokeEvent.event_type == "keypress"
        )
    )
    total_keystrokes = result.scalar() or 0

    paste_result = await db.execute(
        select(func.count(KeystrokeEvent.id))
        .where(
            KeystrokeEvent.session_id == session_id,
            KeystrokeEvent.event_type == "paste"
        )
    )
    total_pastes = paste_result.scalar() or 0

    violation_result = await db.execute(
        select(func.count(KeystrokeEvent.id))
        .where(
            KeystrokeEvent.session_id == session_id,
            KeystrokeEvent.event_type.in_([
                "no_face", "multiple_faces",
                "looking_away", "tab_switch",
                "fullscreen_exit"
            ])
        )
    )
    total_violations = violation_result.scalar() or 0

    return {
        "total_keystrokes": total_keystrokes,
        "total_pastes": total_pastes,
        "total_violations": total_violations
    }