from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config.settings import FRONTEND_DIR
from storage.db import init_db
from backend.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables on startup
    init_db()
    yield


app = FastAPI(
    title="Tatkal Booking Preparation Assistant",
    description="Local offline organizer for preparing Tatkal booking details and timing reminders.",
    version="1.0.0",
    lifespan=lifespan
)

# Include API routes
app.include_router(router)

# Mount frontend directory for static assets
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def serve_index():
    index_file = FRONTEND_DIR / "index.html"
    return FileResponse(str(index_file))
