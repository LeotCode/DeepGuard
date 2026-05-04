"""
DeepGuard Backend — FastAPI
Aggregates EfficientNet + Xception + ResNet for image deepfake detection.
Uses EfficientNet LSTM for video deepfake detection.
Saves results to Firebase Firestore.
"""

import os
import uuid
import mimetypes
import tempfile
import traceback
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.firebase_client import db, verify_token
from typing import Optional
from app.schemas import ScanResult, ScanHistoryItem
from app.model_runner import run_image_pipeline, run_video_pipeline, run_audio_pipeline

# ──────────────────────────────────────────────
# App setup
# ──────────────────────────────────────────────
app = FastAPI(
    title="DeepGuard API",
    description="Deepfake detection backend — image (ensemble) & video (EfficientNet LSTM)",
    version="1.0.0",
)


@app.on_event("startup")
def preload_models():
    """Pre-load all models at startup so the first scan is fast."""
    import threading
    from app.model_runner import (
        _load_effnet_image, _load_effnet_video,
        _load_xception, _load_resnet,
    )
    def _load():
        try:
            print("[DeepGuard] Preloading models...")
            _load_effnet_image()
            _load_xception()
            _load_resnet()
            _load_effnet_video()
            print("[DeepGuard] All models ready.")
        except Exception as e:
            print(f"[DeepGuard] Model preload warning: {e}")
    threading.Thread(target=_load, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/aac", "audio/ogg", "audio/flac"}
MAX_FILE_SIZE_MB = 100


async def verify_token_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Like verify_token but returns None for guests instead of raising 401."""
    if not authorization or not authorization.startswith("Bearer "):
        return None  # guest — no token
    try:
        from app.firebase_client import verify_token as _vt
        # Temporarily wrap the strict verify_token
        import firebase_admin.auth as _fa
        token = authorization.split(" ", 1)[1]
        decoded = _fa.verify_id_token(token)
        return decoded
    except Exception:
        return None  # invalid token → treat as guest


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "DeepGuard API"}


# ──────────────────────────────────────────────
# POST /scan  — analyse a file
# ──────────────────────────────────────────────
@app.post("/scan", response_model=ScanResult)
async def scan_file(
    file: UploadFile = File(...),
    token_data: Optional[dict] = Depends(verify_token_optional),
):
    """
    Accepts an image or video upload.

    - **Image**: runs EfficientNet + Xception + ResNet and averages the three
      deepfake probability scores to produce a single `ai_score`.
    - **Video**: runs the EfficientNet-LSTM pipeline and returns
      per-frame analysis + an `ai_score`.

    The result is saved to Firestore under the authenticated user's collection
    and returned as JSON.
    """
    user_id = token_data["uid"] if token_data else None

    # ── validate mime type ──────────────────────────────────────────────────
    content_type = file.content_type or mimetypes.guess_type(file.filename)[0] or ""
    is_image = content_type in ALLOWED_IMAGE_TYPES
    is_video = content_type in ALLOWED_VIDEO_TYPES
    is_audio = content_type in ALLOWED_AUDIO_TYPES

    if not is_image and not is_video and not is_audio:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. "
                   f"Allowed: JPEG, PNG, WEBP, MP4, MOV, AVI, WEBM, MP3, WAV, AAC.",
        )

    # ── read & size-check ───────────────────────────────────────────────────
    raw = await file.read()
    size_mb = len(raw) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max is {MAX_FILE_SIZE_MB} MB.",
        )

    # ── write to a temp file (needed by OpenCV / torch) ────────────────────
    suffix = Path(file.filename).suffix or (".jpg" if is_image else ".mp4")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        # ── run the appropriate pipeline ────────────────────────────────────
        if is_image:
            result_data = run_image_pipeline(tmp_path, file.filename)
        elif is_audio:
            result_data = run_audio_pipeline(tmp_path, file.filename)
        else:
            result_data = run_video_pipeline(tmp_path, file.filename)

        # ── build scan record ───────────────────────────────────────────────
        scan_id = str(uuid.uuid4())
        record = {
            "scan_id": scan_id,
            "user_id": user_id,
            "filename": file.filename,
            "file_type": "image" if is_image else "video",
            "created_at": datetime.utcnow().isoformat() + "Z",
            **result_data,
        }

        # ── persist to Firestore (logged-in users only) ──────────────────────
        if user_id:
            db.collection("users").document(user_id) \
              .collection("scans").document(scan_id).set(record)

        return JSONResponse(content=record)

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(exc)}")
    finally:
        os.unlink(tmp_path)


# ──────────────────────────────────────────────
# GET /results  — fetch scan history
# ──────────────────────────────────────────────
@app.get("/results", response_model=list[ScanHistoryItem])  # ScanHistoryItem now contains full fields
def get_results(token_data: dict = Depends(verify_token)):
    """Return all past scans for the authenticated user, newest first."""
    user_id = token_data["uid"]

    docs = (
        db.collection("users").document(user_id)
        .collection("scans")
        .order_by("created_at", direction="DESCENDING")
        .stream()
    )

    return [doc.to_dict() for doc in docs]


# ──────────────────────────────────────────────
# GET /results/{scan_id}  — single scan
# ──────────────────────────────────────────────
@app.get("/results/{scan_id}", response_model=ScanResult)
def get_result(scan_id: str, token_data: dict = Depends(verify_token)):
    """Return a single scan result by ID (must belong to the requesting user)."""
    user_id = token_data["uid"]

    doc = (
        db.collection("users").document(user_id)
        .collection("scans").document(scan_id).get()
    )

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Scan not found.")

    return doc.to_dict()


# ──────────────────────────────────────────────
# DELETE /results/{scan_id}  — delete single scan
# ──────────────────────────────────────────────
@app.delete("/results/{scan_id}")
def delete_result(scan_id: str, token_data: dict = Depends(verify_token)):
    """Delete a single scan for the authenticated user."""
    user_id = token_data["uid"]

    ref = (
        db.collection("users").document(user_id)
        .collection("scans").document(scan_id)
    )

    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Scan not found.")

    ref.delete()
    return {"deleted": scan_id}