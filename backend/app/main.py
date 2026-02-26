from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import engine, Base
from app.models import (
    User, Test, Question, TestCase,
    Session, Submission, DetectionResult,
    Ranking, KeystrokeEvent
)
# Import all routers
from app.routers import auth
from app.routers import tests
from app.routers import questions
from app.routers import submissions
from app.routers import monitoring
from app.routers import rankings
from app.routers import analytics


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables verified")
    yield
    # Shutdown: dispose engine
    await engine.dispose()
    print("✅ Database connection closed")


app = FastAPI(
    title="CodeShield API",
    description="Production-grade coding assessment platform with AI detection",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)


# CORS Middleware — must be before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check — used by Render to verify backend is alive
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0"
    }


# Register all routers
app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Auth"]
)
app.include_router(
    tests.router,
    prefix="/api/tests",
    tags=["Tests"]
)
app.include_router(
    questions.router,
    prefix="/api/questions",
    tags=["Questions"]
)
app.include_router(
    submissions.router,
    prefix="/api/submissions",
    tags=["Submissions"]
)
app.include_router(
    monitoring.router,
    prefix="/api/monitoring",
    tags=["Monitoring"]
)
app.include_router(
    rankings.router,
    prefix="/api/rankings",
    tags=["Rankings"]
)
app.include_router(
    analytics.router,
    prefix="/api/analytics",
    tags=["Analytics"]
)