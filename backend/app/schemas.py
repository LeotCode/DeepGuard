"""
Pydantic schemas for DeepGuard API responses.
"""

from typing import Optional, List, Any
from pydantic import BaseModel


class FacePrediction(BaseModel):
    face: int
    label: str           # "likely fake" | "likely real"
    confidence: float    # 0–100


class ModelScore(BaseModel):
    model: str           # "efficientnet" | "xception" | "resnet"
    score: float         # raw 0–1 deepfake probability


class TemporalPoint(BaseModel):
    timestamp: float     # seconds into video
    ai_likelihood: float # 0–100


class HeatmapRegion(BaseModel):
    x: float
    y: float
    width: float
    height: float
    intensity: float


class ScanResult(BaseModel):
    scan_id: str
    user_id: str
    filename: str
    file_type: str                          # "image" | "video"
    created_at: str

    # Core scores
    ai_score: float                         # 0–100 aggregate
    confidence: float                       # 0–100 model confidence
    is_deepfake: bool

    # Per-face predictions (images)
    total_faces: Optional[int] = None
    predictions: Optional[List[FacePrediction]] = None

    # Per-model breakdown (images)
    model_scores: Optional[List[ModelScore]] = None

    # Video extras
    frames_analyzed: Optional[int] = None
    temporal_data: Optional[List[TemporalPoint]] = None

    # Explainability
    red_flags: Optional[List[str]] = None
    analysis_summary: Optional[str] = None
    heatmap_regions: Optional[List[HeatmapRegion]] = None
    
    # Audio spectrogram visualization
    spectrogram_image: Optional[str] = None


class ScanHistoryItem(BaseModel):
    """Full scan data returned in list endpoint — same as ScanResult minus user_id."""
    scan_id: str
    filename: str
    file_type: str
    created_at: str
    ai_score: float
    confidence: float
    is_deepfake: bool
    total_faces: Optional[int] = None
    frames_analyzed: Optional[int] = None
    predictions: Optional[List[Any]] = None
    model_scores: Optional[List[Any]] = None
    temporal_data: Optional[List[Any]] = None
    red_flags: Optional[List[str]] = None
    analysis_summary: Optional[str] = None
    heatmap_regions: Optional[List[Any]] = None
    spectrogram_image: Optional[str] = None
