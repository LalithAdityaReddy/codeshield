"""
Seed script — creates an admin user in the database.
Run: python seed_admin.py
"""
import asyncio
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user import User
from app.core.security import hash_password
from sqlalchemy import select


ADMIN_EMAIL = "newadmin@codeshield.com"
ADMIN_USERNAME = "newadmin"
ADMIN_PASSWORD = "admin123"


async def seed():
    # Create tables if not exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Check if already exists
        result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Admin already exists: {ADMIN_EMAIL}")
            return

        admin = User(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print(f"✅ Admin user created!")
        print(f"   Email:    {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
