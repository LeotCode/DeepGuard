"""
run.py — start the DeepGuard API server.

Usage:
    python run.py
    python run.py --host 0.0.0.0 --port 8000 --reload
"""

import argparse
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepGuard API server")
    parser.add_argument("--host",   default="0.0.0.0",  help="Bind address")
    parser.add_argument("--port",   default=8000, type=int, help="Port")
    parser.add_argument("--reload", action="store_true",   help="Hot-reload (dev only)")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )
