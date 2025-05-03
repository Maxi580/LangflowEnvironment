import os
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import uvicorn
from dotenv import load_dotenv
import requests

from fileupload import (
    check_ollama_connection,
    check_qdrant_connection,
    upload_to_qdrant,
    delete_file_from_qdrant,
    detect_file_type,
    OLLAMA_URL, get_files_from_collection,
)

load_dotenv()

app = FastAPI(title="Simple File Processor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = Path("./uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class FileDeleteRequest(BaseModel):
    file_path: str
    flow_id: str


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "UP"}


@app.get("/api/status")
async def get_status(flow_id: str = Query(None, description="Flow ID to check/create collection for")):
    """Check connection status to Ollama and Qdrant, optionally create a collection"""
    ollama_ok = check_ollama_connection()
    qdrant_ok = check_qdrant_connection(flow_id=flow_id)

    return {
        "ollama_connected": ollama_ok,
        "qdrant_connected": qdrant_ok
    }


@app.get("/api/models")
async def get_models():
    """Get available Ollama models"""
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        if response.status_code == 200:
            models = response.json().get("models", [])
            return {"models": [m.get("name", "unknown") for m in models]}
        else:
            raise HTTPException(status_code=503, detail="Ollama service is not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting models: {str(e)}")


@app.post("/api/upload")
async def upload_file(
        file: UploadFile = File(...),
        flow_id: str = Query(..., description="Flow ID to use as the collection name")
):
    """Upload a file to Qdrant"""
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    if not flow_id:
        raise HTTPException(status_code=400, detail="Flow ID is required")

    try:
        file_id = str(uuid.uuid4())
        safe_filename = f"{file_id}-{file.filename.replace(' ', '_')}"
        file_path = str(UPLOADS_DIR / safe_filename)

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        file_type = detect_file_type(file_path)
        if file_type == 'unknown':
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="Unsupported file format")

        success = upload_to_qdrant(
            file_path,
            file.filename,
            file_id,
            flow_id=flow_id
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to process file")

        return {
            "file_id": file_id,
            "file_name": file.filename,
            "file_path": file_path,
            "file_type": file_type,
            "flow_id": flow_id,
            "status": "processed"
        }

    except Exception as e:
        try:
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.delete("/api/files")
async def delete_file(request: FileDeleteRequest):
    """Delete a file from Qdrant and disk"""
    try:
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="File not found")

        if not request.flow_id:
            raise HTTPException(status_code=400, detail="Flow ID is required")

        deleted = delete_file_from_qdrant(
            request.file_path,
            flow_id=request.flow_id
        )

        try:
            os.remove(request.file_path)
            disk_deleted = True
        except:
            disk_deleted = False

        return {
            "qdrant_deleted": deleted,
            "disk_deleted": disk_deleted,
            "file_path": request.file_path,
            "flow_id": request.flow_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


@app.get("/api/files")
async def list_files(flow_id: str = Query(None, description="Filter files by flow ID")):
    """List all files in the uploads directory, optionally filtered by flow ID"""
    try:
        if flow_id:
            try:
                files = get_files_from_collection(flow_id)
                return {"files": files}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error getting files, does collection exist: {str(e)}")

        files = []
        for file_path in UPLOADS_DIR.glob("*"):
            if file_path.is_file():
                file_id = file_path.name.split("-")[0]
                file_type = detect_file_type(file_path)
                files.append({
                    "file_id": file_id,
                    "file_path": str(file_path),
                    "file_name": "-".join(file_path.name.split("-")[1:]),
                    "file_size": os.path.getsize(file_path),
                    "file_type": file_type,
                })

        return {"files": files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)