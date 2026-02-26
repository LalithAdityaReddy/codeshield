from pydantic_settings import BaseSettings
from typing import List
class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Environment
    ENVIRONMENT: str = "development"

    # Frontend URL for CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Derived CORS origins
    @property
    def CORS_ORIGINS(self) -> List[str]:
        if self.ENVIRONMENT == "production":
            return [
                self.FRONTEND_URL,
                "https://codeshield.vercel.app",
            ]
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
        ]

    # Async database URL (required for SQLAlchemy async)
    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return self.DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()