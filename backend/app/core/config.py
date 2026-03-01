from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        if self.ENVIRONMENT == "production":
            origins = ["https://codeshield.vercel.app"]
            if self.FRONTEND_URL:
                origins.append(self.FRONTEND_URL)
            return origins
        return [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ]

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return self.DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
