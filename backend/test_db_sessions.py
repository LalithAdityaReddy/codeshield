import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.core.database import engine, AsyncSessionLocal
from sqlalchemy import select, func
from app.models.keystroke import KeystrokeEvent

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(KeystrokeEvent.session_id, func.count(KeystrokeEvent.id)).group_by(KeystrokeEvent.session_id))
        for row in result.all():
            print(f"Session ID: {row[0]}, Count: {row[1]}")

asyncio.run(main())
