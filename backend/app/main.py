import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

from backend.app.api.routes.health import router as health_router

load_dotenv()

app = FastAPI(
    title="LangflowSetupBackend",
    description="A backend API for user management and file processing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to the Langflow Setup API",
        "docs": "/docs",
        "version": "1.0.0"
    }
