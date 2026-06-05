# pyrefly: ignore [missing-import]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.dependencies import get_current_admin
from app.monitoring.websocket_manager import manager
from app.monitoring.event_processor import (
    process_keystroke_event,
    get_session_events,
    get_violation_events,
    get_typing_stats
)
from app.models.session import Session
from app.models.user import User
from sqlalchemy import select
import json

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...)
):
    import uuid
    from app.core.database import AsyncSessionLocal

    # Verify token
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")

    # Cast parameters to UUID objects for pg/asyncpg compatibility
    try:
        session_uuid = uuid.UUID(session_id)
        user_uuid = uuid.UUID(user_id)
    except (ValueError, TypeError):
        await websocket.close(code=4002)
        return

    # Verify session belongs to user using a short-lived DB session
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Session).where(
                Session.id == session_uuid,
                Session.user_id == user_uuid
            )
        )
        session = result.scalar_one_or_none()

        if not session:
            await websocket.close(code=4002)
            return

    await manager.connect(session_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            event = json.loads(data)

            event_type = event.get("type")
            question_id = event.get("question_id")
            payload_data = event.get("payload", {})

            # Store event if it has a question_id OR is a known violation type
            VIOLATION_TYPES = {
                "no_face", "multiple_faces", "tab_switch",
                "fullscreen_exit", "copy_attempt", "right_click",
                "focus_out", "focus_in", "noise_detected",
                "paste", "keypress", "comment_deletion"
            }
            if event_type and (question_id or event_type in VIOLATION_TYPES):
                # Use None for question_id on violation events with sentinel or missing id
                real_question_id = None
                if question_id and question_id != "__session__":
                    try:
                        real_question_id = uuid.UUID(question_id)
                    except (ValueError, TypeError):
                        real_question_id = None

                # Save the event in a short-lived local session to avoid transaction deadlocks / connection leaks
                async with AsyncSessionLocal() as db:
                    await process_keystroke_event(
                        session_id=session_uuid,
                        question_id=real_question_id,
                        event_type=event_type,
                        payload=payload_data,
                        db=db
                    )
                    await db.commit()

                    # Check for disqualification violations
                    violation_types = [
                        "no_face", "multiple_faces",
                        "tab_switch", "fullscreen_exit",
                        "copy_attempt",
                    ]
                    if event_type in violation_types:
                        # Count violations
                        from sqlalchemy import func
                        from app.models.keystroke import KeystrokeEvent
                        result = await db.execute(
                            select(func.count(KeystrokeEvent.id))
                            .where(
                                KeystrokeEvent.session_id == session_uuid,
                                KeystrokeEvent.event_type.in_(violation_types)
                            )
                        )
                        violation_count = result.scalar() or 0

                        # Send warning back to client
                        await manager.send_message(session_id, {
                            "status": "warning",
                            "type": event_type,
                            "violation_count": violation_count,
                            "message": f"Violation detected: {event_type}"
                        })

                # Send acknowledgment back
                await manager.send_message(session_id, {
                    "status": "received",
                    "type": event_type
                })

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(session_id)


@router.get("/events/{session_id}")
async def get_events(
    session_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    events = await get_session_events(session_id, db)
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "payload": e.payload,
            "occurred_at": str(e.occurred_at)
        }
        for e in events
    ]


@router.get("/violations/{session_id}")
async def get_violations(
    session_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    violations = await get_violation_events(session_id, db)
    return [
        {
            "id": str(v.id),
            "event_type": v.event_type,
            "payload": v.payload,
            "occurred_at": str(v.occurred_at)
        }
        for v in violations
    ]


@router.get("/stats/{session_id}")
async def get_stats(
    session_id: str,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    return await get_typing_stats(session_id, db)