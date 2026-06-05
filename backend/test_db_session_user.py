import asyncio
from dotenv import load_dotenv
load_dotenv()

from app.core.database import engine, AsyncSessionLocal
from sqlalchemy import select
from app.models.session import Session
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Session.id, Session.user_id, Session.started_at).order_by(Session.started_at.desc()))
        for row in result.all():
            print(f"Session {row[0]} | User {row[1]} | Started {row[2]}")

asyncio.run(main())
