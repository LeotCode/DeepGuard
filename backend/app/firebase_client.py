"""
Firebase / Firestore client + Firebase Auth token verifier.

Set FIREBASE_SERVICE_ACCOUNT_JSON to the *path* of your service-account JSON
file, set FIREBASE_SERVICE_ACCOUNT_INLINE to the raw JSON string, or use
Application Default Credentials on Cloud Run.
"""

import os
import json
from dotenv import load_dotenv
load_dotenv(override=True)

import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from fastapi import HTTPException, Header
from typing import Optional

# ──────────────────────────────────────────────
# Initialise Firebase Admin SDK (once)
# ──────────────────────────────────────────────
def _init_firebase() -> None:
    if firebase_admin._apps:
        return  # already initialised

    # Prefer inline JSON (env var contains the JSON string directly)
    inline = os.environ.get("FIREBASE_SERVICE_ACCOUNT_INLINE")
    path   = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    project_id = os.environ.get("FIREBASE_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")

    if inline:
        service_account_info = json.loads(inline)
        cred = credentials.Certificate(service_account_info)
        project_id = project_id or service_account_info.get("project_id")
    elif path:
        cred = credentials.Certificate(path)
        with open(path, "r", encoding="utf-8") as service_account_file:
            project_id = project_id or json.load(service_account_file).get("project_id")
    else:
        cred = credentials.ApplicationDefault()

    options = {"projectId": project_id} if project_id else None
    firebase_admin.initialize_app(cred, options)


_init_firebase()

# Firestore database handle — used across the app
db: firestore.Client = firestore.client(
    database_id=os.environ.get("FIRESTORE_DATABASE_ID", "deepguard")
)


# ──────────────────────────────────────────────
# Auth dependency  — verifies Firebase ID tokens
# ──────────────────────────────────────────────
async def verify_token(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency.  Expects:  Authorization: Bearer <firebase_id_token>

    Returns the decoded token dict (contains uid, email, etc.).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")

    id_token = authorization.split("Bearer ", 1)[1].strip()

    try:
        decoded = firebase_auth.verify_id_token(id_token)
        return decoded
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {exc}")
