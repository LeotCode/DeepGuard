"""
Firebase / Firestore client + Firebase Auth token verifier.

Set the environment variable FIREBASE_SERVICE_ACCOUNT_JSON to the *path*
of your service-account JSON file, OR set FIREBASE_SERVICE_ACCOUNT_INLINE
to the raw JSON string (useful for Render / Railway / etc.).
"""

import os
import json
from dotenv import load_dotenv
load_dotenv()

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

    if inline:
        service_account_info = json.loads(inline)
        cred = credentials.Certificate(service_account_info)
    elif path:
        cred = credentials.Certificate(path)
    else:
        raise RuntimeError(
            "Firebase credentials not configured. "
            "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_INLINE."
        )

    firebase_admin.initialize_app(cred, {'projectId': 'deepguard-project'})


_init_firebase()

# Firestore database handle — used across the app
db: firestore.Client = firestore.client(database_id='deepguard')


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
