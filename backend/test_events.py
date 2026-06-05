import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("SELECT count(*) FROM keystroke_events;"))
        print("TOTAL EVENTS:", res.scalar())

asyncio.run(check())
