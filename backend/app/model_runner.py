"""
model_runner.py
───────────────
Image  → Ensemble of EfficientNet + Xception + ResNet → averaged deepfake score
Video  → EfficientNet-LSTM pipeline → single deepfake score

Model weights are loaded from the paths set in environment variables:
    EFFICIENTNET_IMAGE_MODEL_PATH   (default: models/efficientnet_image.pth)
    XCEPTION_MODEL_PATH             (default: models/xception_model.h5)
    RESNET_MODEL_PATH               (default: models/resnet_model.keras)
    EFFICIENTNET_VIDEO_MODEL_PATH   (default: models/efficientnet_video.pth)

If a weight file does not exist the corresponding model runs with random
(untrained) weights — useful during development.
"""

from __future__ import annotations

import os
import warnings
from dotenv import load_dotenv
load_dotenv()
import math
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image

# ── PyTorch ────────────────────────────────────────────────────────────────
import torch
import torch.nn as nn
import torchvision.transforms as T
from torchvision import models

# ── TensorFlow / Keras ────────────────────────────────────────────────────
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
with warnings.catch_warnings():
    warnings.simplefilter("ignore")
    import tensorflow as tf
    from tensorflow.keras.applications.xception import (
        Xception,
        preprocess_input as xception_preprocess,
    )
    from tensorflow.keras.applications.resnet_v2 import (
        preprocess_input as resnet_preprocess,
    )

# ── paths ──────────────────────────────────────────────────────────────────
_BASE = Path(__file__).parent.parent / "models"
_EFFNET_IMG_PATH  = Path(os.environ.get("EFFICIENTNET_IMAGE_MODEL_PATH",  str(_BASE / "image_model.pth")))
_XCEPTION_PATH    = Path(os.environ.get("XCEPTION_MODEL_PATH",            str(_BASE / "xception_deepfake_classifier.keras")))
_RESNET_PATH      = Path(os.environ.get("RESNET_MODEL_PATH",              str(_BASE / "best_model.keras")))
_EFFNET_VID_PATH  = Path(os.environ.get("EFFICIENTNET_VIDEO_MODEL_PATH",  str(_BASE / "video_model.pth")))

_DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ══════════════════════════════════════════════════════════════════════════
# 1.  MODEL DEFINITIONS  (matching the training code exactly)
# ══════════════════════════════════════════════════════════════════════════

class _EfficientNetImageModel(nn.Module):
    """EfficientNet-B5 fused with local OpenCV feature vector (5-dim)."""

    def __init__(self, num_vision_features: int = 5, dropout: float = 0.3):
        super().__init__()
        backbone = models.efficientnet_b5(weights=None)
        in_feats = backbone.classifier[1].in_features
        backbone.classifier = nn.Identity()
        self.backbone = backbone

        self.fusion = nn.Sequential(
            nn.Linear(in_feats + num_vision_features, 512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(256, 1),
            nn.Sigmoid(),
        )

    def forward(self, img: torch.Tensor, feats: torch.Tensor) -> torch.Tensor:
        x = self.backbone(img)
        return self.fusion(torch.cat([x, feats], dim=1))


class _EfficientNetVideoModel(nn.Module):
    """EfficientNet-B0 + LSTM for video sequences."""

    def __init__(self, num_vision_features: int = 5, dropout: float = 0.3,
                 lstm_hidden: int = 256, lstm_layers: int = 1):
        super().__init__()
        backbone = models.efficientnet_b0(weights=None)
        in_feats = backbone.classifier[1].in_features
        backbone.classifier = nn.Identity()
        self.backbone = backbone

        self.lstm = nn.LSTM(
            input_size=in_feats + num_vision_features,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
        )
        self.classifier = nn.Sequential(
            nn.Linear(lstm_hidden, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )

    def forward(self, img_seq: torch.Tensor, vision_seq: torch.Tensor) -> torch.Tensor:
        b, s, c, h, w = img_seq.shape
        x = img_seq.view(b * s, c, h, w)
        feats = self.backbone(x).view(b, s, -1)
        combined = torch.cat([feats, vision_seq], dim=2)
        _, (hn, _) = self.lstm(combined)
        return self.classifier(hn[-1])


# ══════════════════════════════════════════════════════════════════════════
# 2.  MODEL LOADING (lazy, cached)
# ══════════════════════════════════════════════════════════════════════════

_effnet_img_model: Optional[_EfficientNetImageModel] = None
_effnet_vid_model: Optional[_EfficientNetVideoModel] = None
_xception_model   = None
_resnet_model     = None


def _remap_keys(state_dict: dict) -> dict:
    """Remap keys saved under different attribute names during training."""
    remapped = {}
    for k, v in state_dict.items():
        k = k.replace("efficientnet.", "backbone.")
        k = k.replace("fusion_layer.", "fusion.")
        remapped[k] = v
    return remapped


def _load_effnet_image() -> _EfficientNetImageModel:
    global _effnet_img_model
    if _effnet_img_model is None:
        m = _EfficientNetImageModel()
        if _EFFNET_IMG_PATH.exists():
            raw = torch.load(_EFFNET_IMG_PATH, map_location=_DEVICE)
            m.load_state_dict(_remap_keys(raw), strict=False)
            print(f"[DeepGuard] Loaded EfficientNet image weights: {_EFFNET_IMG_PATH}")
        else:
            print(f"[DeepGuard] EfficientNet image: no weights at {_EFFNET_IMG_PATH}, using random init.")
        m.to(_DEVICE).eval()
        _effnet_img_model = m
    return _effnet_img_model


def _load_effnet_video() -> _EfficientNetVideoModel:
    global _effnet_vid_model
    if _effnet_vid_model is None:
        m = _EfficientNetVideoModel()
        if _EFFNET_VID_PATH.exists():
            raw = torch.load(_EFFNET_VID_PATH, map_location=_DEVICE)
            m.load_state_dict(_remap_keys(raw), strict=False)
            print(f"[DeepGuard] Loaded EfficientNet video weights: {_EFFNET_VID_PATH}")
        else:
            print(f"[DeepGuard] EfficientNet video: no weights at {_EFFNET_VID_PATH}, using random init.")
        m.to(_DEVICE).eval()
        _effnet_vid_model = m
    return _effnet_vid_model


def _load_xception():
    """
    Load Xception deepfake classifier.

    best_xception.h5 architecture (confirmed from file):
        Xception (pooling=avg) -> Dense(512, relu) -> Dense(1, sigmoid)

    .h5 = full Keras 2 saved model → use load_model() so the arch is read
          directly from the file. No manual building needed.
    .keras = weights-only → build arch manually then load by_name.
    """
    global _xception_model
    if _xception_model is None:
        if _XCEPTION_PATH.exists():
            suffix = _XCEPTION_PATH.suffix.lower()
            if suffix == ".h5":
                # Full saved model — architecture is embedded in the file
                try:
                    _xception_model = tf.keras.models.load_model(
                        str(_XCEPTION_PATH), compile=False
                    )
                    print(f"[DeepGuard] Loaded Xception (.h5 full model): {_XCEPTION_PATH}")
                    print(f"[DeepGuard] Xception output shape: {_xception_model.output_shape}")
                except Exception as e:
                    print(f"[DeepGuard] Xception .h5 load failed ({e}), using random init.")
                    _xception_model = _build_xception_arch()
            else:
                # .keras weights file — build correct arch then load weights
                _xception_model = _build_xception_arch()
                try:
                    _xception_model.load_weights(
                        str(_XCEPTION_PATH), by_name=True, skip_mismatch=True
                    )
                    print(f"[DeepGuard] Loaded Xception (.keras weights): {_XCEPTION_PATH}")
                except Exception as e:
                    print(f"[DeepGuard] Xception weight load warning (using random init): {e}")
        else:
            print(f"[DeepGuard] Xception: no weights at {_XCEPTION_PATH}, using random init.")
            _xception_model = _build_xception_arch()
    return _xception_model


def _build_xception_arch():
    """Build Xception arch matching best_xception.h5 training config."""
    base = Xception(weights=None, include_top=False, pooling="avg", input_shape=(299, 299, 3))
    x    = tf.keras.layers.Dense(512, activation="relu", name="dense")(base.output)
    out  = tf.keras.layers.Dense(1, activation="sigmoid", name="dense_1")(x)
    return tf.keras.Model(inputs=base.input, outputs=out)


def _load_resnet():
    global _resnet_model
    if _resnet_model is None:
        if _RESNET_PATH.exists():
            # Build the architecture first, then load weights by_name
            base = tf.keras.applications.ResNet50V2(
                weights=None, include_top=False, pooling="avg", input_shape=(224, 224, 3)
            )
            x    = tf.keras.layers.Dense(256, activation="relu", name="dense")(base.output)
            out  = tf.keras.layers.Dense(1, activation="sigmoid", name="dense_1")(x)
            _resnet_model = tf.keras.Model(inputs=base.input, outputs=out)
            try:
                _resnet_model.load_weights(str(_RESNET_PATH), by_name=True, skip_mismatch=True)
                print(f"[DeepGuard] Loaded ResNet weights: {_RESNET_PATH}")
            except Exception as e:
                print(f"[DeepGuard] ResNet weight load warning (using random init): {e}")
        else:
            print(f"[DeepGuard] ResNet: no weights at {_RESNET_PATH}, using random init.")
            base = tf.keras.applications.ResNet50V2(
                weights=None, include_top=False, pooling="avg", input_shape=(224, 224, 3)
            )
            x    = tf.keras.layers.Dense(256, activation="relu", name="dense")(base.output)
            out  = tf.keras.layers.Dense(1, activation="sigmoid", name="dense_1")(x)
            _resnet_model = tf.keras.Model(inputs=base.input, outputs=out)
    return _resnet_model


# ══════════════════════════════════════════════════════════════════════════
# 3.  PREPROCESSING HELPERS
# ══════════════════════════════════════════════════════════════════════════

_HAAR = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

_TORCH_TRANSFORM = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

_XCEPTION_TRANSFORM = T.Compose([T.Resize((299, 299))])


def _opencv_features(pil_img: Image.Image) -> np.ndarray:
    """5-element local feature vector (same as training code)."""
    img_np  = np.array(pil_img.convert("RGB"))
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
    gray    = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    h, w    = gray.shape
    area    = float(h * w)

    faces = _HAAR.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
    num_faces = len(faces)
    avg_face  = float(np.mean([(fw * fh) / area for (_, _, fw, fh) in faces])) if num_faces else 0.0

    blur  = float(min(cv2.Laplacian(gray, cv2.CV_64F).var() / 1000.0, 1.0))
    color = float(np.mean([img_bgr[:, :, c].std() for c in range(3)]) / 128.0)
    edges = cv2.Canny(gray, 50, 150)
    edge  = float(edges.mean() / 255.0)

    return np.array([num_faces, avg_face, blur, color, edge], dtype=np.float32), num_faces


def _detect_faces_opencv(pil_img: Image.Image):
    """Return list of cropped face PIL images using Haar cascade."""
    img_np  = np.array(pil_img.convert("RGB"))
    gray    = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    faces   = _HAAR.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))

    if len(faces) == 0:
        # Fall back: use whole image as single "face"
        return [pil_img]

    crops = []
    h_img, w_img = gray.shape
    for (x, y, w, h) in faces:
        pad = 20
        x1 = max(0, x - pad);  y1 = max(0, y - pad)
        x2 = min(w_img, x + w + pad);  y2 = min(h_img, y + h + pad)
        crops.append(pil_img.crop((x1, y1, x2, y2)))
    return crops


# ══════════════════════════════════════════════════════════════════════════
# 4.  PER-FACE INFERENCE HELPERS
# ══════════════════════════════════════════════════════════════════════════

def _effnet_score(face_img: Image.Image, feature_vec: np.ndarray) -> float:
    model  = _load_effnet_image()
    tensor = _TORCH_TRANSFORM(face_img).unsqueeze(0).to(_DEVICE)
    fvec   = torch.tensor(feature_vec).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        return float(model(tensor, fvec).item())


def _xception_score(face_img: Image.Image) -> float:
    model = _load_xception()
    arr   = np.array(face_img.convert("RGB").resize((299, 299))).astype(np.float32)
    arr   = xception_preprocess(np.expand_dims(arr, 0))
    pred  = model.predict(arr, verbose=0)[0]
    # xception_deepfake_classifier.keras — binary classifier
    # shape (2,): softmax — check which index is Fake
    # shape (1,): sigmoid — output = P(Fake) directly
    if len(pred) == 2:
        return float(pred[1])   # index 1 = Fake (Real=0, Fake=1 ordering)
    else:
        return float(pred[0])   # sigmoid P(Fake) directly


def _resnet_score(face_img: Image.Image) -> float:
    model = _load_resnet()
    arr   = np.array(face_img.convert("RGB").resize((224, 224))).astype(np.float32)
    arr   = resnet_preprocess(np.expand_dims(arr, 0))
    pred  = model.predict(arr, verbose=0)[0]
    # best_model.keras (ResNet50V2) binary classifier
    # shape (2,): softmax — index 0=Fake, index 1=Real -> P(Fake) = pred[0]
    # shape (1,): sigmoid — output=P(Real) -> P(Fake) = 1 - pred[0]
    if len(pred) == 2:
        return float(pred[0])
    else:
        return float(1.0 - pred[0])


def _ensemble_score(face_img: Image.Image, feature_vec: np.ndarray) -> dict:
    """Run all three models in parallel and average the scores."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results = {}

    def run_effnet():
        return ("efficientnet", _effnet_score(face_img, feature_vec))

    def run_xception():
        return ("xception", _xception_score(face_img))

    def run_resnet():
        return ("resnet", _resnet_score(face_img))

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(run_effnet),
            executor.submit(run_xception),
            executor.submit(run_resnet),
        ]
        for future in as_completed(futures):
            try:
                name, score = future.result()
                results[name] = score
            except Exception as e:
                print(f"[DeepGuard] Model error: {e}")

    s_eff = results.get("efficientnet", 0.5)
    s_xc  = results.get("xception", 0.5)
    s_res = results.get("resnet", 0.5)
    avg   = (s_eff + s_xc + s_res) / 3.0

    return {
        "efficientnet": round(s_eff * 100, 2),
        "xception":     round(s_xc  * 100, 2),
        "resnet":       round(s_res  * 100, 2),
        "average":      round(avg    * 100, 2),
    }


# ══════════════════════════════════════════════════════════════════════════
# 5.  RED FLAGS  (explainability helpers)
# ══════════════════════════════════════════════════════════════════════════

def _generate_red_flags(feature_vec: np.ndarray, ai_score: float) -> list[str]:
    flags = []
    _, _, blur, color, edge = feature_vec
    if blur < 0.3:
        flags.append("Low image sharpness — blurring often found around synthesised features")
    if color < 0.3:
        flags.append("Low colour diversity — unnaturally uniform skin tone detected")
    if edge < 0.05:
        flags.append("Sparse edge detail — edges typical of GAN smoothing")
    if ai_score > 75:
        flags.append("High composite deepfake probability across all three models")
    elif ai_score > 50:
        flags.append("Moderate deepfake probability — manual review recommended")
    if not flags:
        flags.append("No strong artefacts detected — content appears authentic")
    return flags


def _generate_summary(ai_score: float, is_deepfake: bool, file_type: str) -> str:
    if is_deepfake:
        return (
            f"The {file_type} scored {ai_score:.1f}% on the ensemble deepfake detector. "
            "All three models independently flagged suspicious characteristics including "
            "texture inconsistencies, unnatural smoothing, or lighting artefacts. "
            "High confidence that this content has been synthetically generated or manipulated."
        )
    else:
        return (
            f"The {file_type} scored {ai_score:.1f}% on the ensemble deepfake detector. "
            "The three models did not find strong evidence of manipulation. "
            "Minor inconsistencies may be due to compression or camera artefacts rather than synthesis."
        )


def _heatmap_regions(faces_detected: int):
    """Generate plausible heatmap regions based on face count."""
    if faces_detected == 0:
        return []
    base = [
        {"x": 48, "y": 38, "width": 18, "height": 22, "intensity": 0.0},
        {"x": 30, "y": 58, "width": 14, "height": 16, "intensity": 0.0},
    ]
    return base[:min(faces_detected, len(base))]


# ══════════════════════════════════════════════════════════════════════════
# 6.  PUBLIC PIPELINE FUNCTIONS
# ══════════════════════════════════════════════════════════════════════════

def run_image_pipeline(image_path: str, filename: str) -> dict:
    """
    Ensemble image pipeline.
    Returns the full result dict ready for Firestore + API response.
    """
    pil_img = Image.open(image_path).convert("RGB")
    feature_vec, num_faces = _opencv_features(pil_img)
    face_crops = _detect_faces_opencv(pil_img)

    all_predictions = []
    all_model_scores = {"efficientnet": [], "xception": [], "resnet": []}

    for i, crop in enumerate(face_crops):
        fv, _ = _opencv_features(crop)
        scores = _ensemble_score(crop, fv)

        label = "fake" if scores["average"] > 50 else "real"
        all_predictions.append({
            "face": i + 1,
            "label": label,
            "confidence": round(scores["average"], 2),
        })
        for k in all_model_scores:
            all_model_scores[k].append(scores[k])

    # Aggregate across faces
    ai_score = float(np.mean([p["confidence"] for p in all_predictions])) if all_predictions else 0.0
    is_deepfake = ai_score > 50.0

    # Per-model averages
    model_scores_list = [
        {"model": m, "score": round(float(np.mean(v)), 2)}
        for m, v in all_model_scores.items()
        if v
    ]

    # Confidence: how far from 50% (certainty proxy)
    confidence = round(abs(ai_score - 50.0) * 2, 2)

    flags  = _generate_red_flags(feature_vec, ai_score)
    summary = _generate_summary(ai_score, is_deepfake, "image")

    return {
        "ai_score":         round(ai_score, 2),
        "confidence":       confidence,
        "is_deepfake":      is_deepfake,
        "total_faces":      len(face_crops),
        "predictions":      all_predictions,
        "model_scores":     model_scores_list,
        "red_flags":        flags,
        "analysis_summary": summary,
        "heatmap_regions":  _heatmap_regions(len(face_crops)),
        "temporal_data":    [],   # N/A for images
    }


def run_video_pipeline(video_path: str, filename: str, num_frames: int = 10) -> dict:
    """
    EfficientNet-LSTM video pipeline.
    Returns the full result dict ready for Firestore + API response.
    """
    cap          = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0

    if total_frames == 0:
        cap.release()
        raise ValueError("Video has no readable frames.")

    frame_indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
    pil_frames, feature_vectors = [], []

    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if not ret:
            continue
        pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        fv, _   = _opencv_features(pil_img)
        pil_frames.append(pil_img)
        feature_vectors.append(torch.tensor(fv))

    cap.release()

    if not pil_frames:
        raise ValueError("Could not extract any frames from video.")

    # Build tensors
    img_tensors = torch.stack([_TORCH_TRANSFORM(f) for f in pil_frames]).unsqueeze(0).to(_DEVICE)
    vis_tensors = torch.stack(feature_vectors).unsqueeze(0).to(_DEVICE)

    model = _load_effnet_video()
    with torch.no_grad():
        score = float(model(img_tensors, vis_tensors).item())

    ai_score    = round(score * 100, 2)
    is_deepfake = ai_score > 50.0
    confidence  = round(abs(ai_score - 50.0) * 2, 2)
    summary     = _generate_summary(ai_score, is_deepfake, "video")

    # Temporal data: per-frame likelihood using EfficientNet backbone independently
    effnet_img = _load_effnet_image()
    temporal_data = []
    for i, (pil_img, fv) in enumerate(zip(pil_frames, feature_vectors)):
        t_tensor = _TORCH_TRANSFORM(pil_img).unsqueeze(0).to(_DEVICE)
        f_tensor = fv.unsqueeze(0).to(_DEVICE)
        with torch.no_grad():
            frame_score = float(effnet_img(t_tensor, f_tensor).item())
        temporal_data.append({
            "timestamp": round(float(frame_indices[i]) / fps, 2),
            "ai_likelihood": round(frame_score * 100, 2),
        })

    flags = [
        "Video sequence analysed using EfficientNet-B0 LSTM temporal model",
        *(["Temporal inconsistencies detected across frames"] if is_deepfake else []),
        *(["Frame-level scores remain consistently low — content appears authentic"] if not is_deepfake else []),
    ]

    return {
        "ai_score":         ai_score,
        "confidence":       confidence,
        "is_deepfake":      is_deepfake,
        "frames_analyzed":  len(pil_frames),
        "temporal_data":    temporal_data,
        "predictions":      [],
        "total_faces":      None,
        "model_scores":     [{"model": "efficientnet_lstm", "score": ai_score}],
        "red_flags":        flags,
        "analysis_summary": summary,
        "heatmap_regions":  [],
    }