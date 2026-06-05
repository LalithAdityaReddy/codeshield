import asyncio
from app.core.database import AsyncSessionLocal
from app.models.keystroke import KeystrokeEvent
from sqlalchemy import select

async def inspect():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(KeystrokeEvent))
        events = result.scalars().all()
        print(f"Total events in database: {len(events)}")
        for e in events[:20]:
            print(f"ID: {e.id}, Session: {e.session_id}, Question: {e.question_id}, Type: {e.event_type}, Payload: {e.payload}")

if __name__ == "__main__":
    asyncio.run(inspect())
