from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .api.routes.health import router as health_router
from .api.routes.user import router as user_router
from .api.routes.auth import router as auth_router

load_dotenv()

app = FastAPI(
    title="LangflowSetupBackend",
    description="A backend API to extend Langflow",
    version="1.0.0",
)

ENV = "dev"

if ENV == "dev":
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
else:
    allowed_origins = [
        "https://yourdomain.com",
        "https://www.yourdomain.com"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(health_router)
app.include_router(user_router)
app.include_router(auth_router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to the Langflow Setup API",
        "docs": "/docs",
        "version": "1.0.0"
    }
