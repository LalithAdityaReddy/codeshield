import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.core.database import engine, AsyncSessionLocal
from sqlalchemy import select, func
from app.models.keystroke import KeystrokeEvent

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count(KeystrokeEvent.id)))
        count = result.scalar()
        print(f"Total keystroke events in DB: {count}")

asyncio.run(main())
