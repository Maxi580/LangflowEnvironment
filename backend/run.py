import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    host = os.getenv("SERVER_HOST", "0.0.0.0")
    port = int(os.getenv("SERVER_PORT", "8000"))

    print(f"Starting server at http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)