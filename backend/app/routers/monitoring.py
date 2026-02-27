from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.monitoring.websocket_manager import manager
from app.monitoring.event_processor import (
    process_keystroke_event,
    get_session_events,
    get_violation_events,
    get_typing_stats
)
from app.models.session import Session
from sqlalchemy import select
import json

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    # Verify token
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload.get("sub")

    # Verify session belongs to user
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user_id
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

        if event_type and question_id:
            await process_keystroke_event(
        session_id=session_id,
        question_id=question_id,
        event_type=event_type,
        payload=payload_data,
        db=db
    )
            await db.commit()

    # Check for disqualification
            violation_types = [
        "no_face", "multiple_faces",
        "tab_switch", "fullscreen_exit"
    ]
            if event_type in violation_types:
        # Count violations
                from sqlalchemy import select, func
                from app.models.keystroke import KeystrokeEvent
                result = await db.execute(
            select(func.count(KeystrokeEvent.id))
            .where(
                KeystrokeEvent.session_id == session_id,
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
    db: AsyncSession = Depends(get_db)
):
    return await get_typing_stats(session_id, db)