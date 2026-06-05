"""
Fixed reset script — uses correct column name: password_hash (not hashed_password)
Also checks correct field: role = 'admin' (no is_admin column in this model)

Usage:  python reset_admin.py
"""
import asyncio
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import hash_password
from sqlalchemy import select

EMAIL    = "newadmin@codeshield.com"
PASSWORD = "Admin@1234"
USERNAME = "newadmin"


async def reset():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == EMAIL))
        user = result.scalar_one_or_none()

        hashed = hash_password(PASSWORD)  # uses the same hasher as auth_service

        if user:
            user.password_hash = hashed   # ← correct column name
            user.role = "admin"
            print(f"✅ Reset password for: {EMAIL}")
        else:
            user = User(
                email=EMAIL,
                username=USERNAME,
                password_hash=hashed,      # ← correct column name
                role="admin",
            )
            db.add(user)
            print(f"✅ Created admin: {EMAIL}")

        await db.commit()
        print(f"   Email   : {EMAIL}")
        print(f"   Password: {PASSWORD}")
        print(f"   Role    : admin")
        print()
        print("Now login at http://localhost:5173")


if __name__ == "__main__":
    asyncio.run(reset())
