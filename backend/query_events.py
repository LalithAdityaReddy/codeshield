import asyncio
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func
from app.models.keystroke import KeystrokeEvent
from app.models.session import Session
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.ASYNC_DATABASE_URL)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as db:
        result = await db.execute(select(func.count(KeystrokeEvent.id)))
        count = result.scalar()
        print(f"Total keystroke events in DB: {count}")
        
        if count > 0:
            result = await db.execute(select(KeystrokeEvent.event_type, func.count(KeystrokeEvent.id)).group_by(KeystrokeEvent.event_type))
            for row in result.all():
                print(f"{row[0]}: {row[1]}")

asyncio.run(main())
