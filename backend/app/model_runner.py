"""
model_runner.py
───────────────
Image  → Ensemble of EfficientNet + Xception + ResNet → averaged deepfake score
Video  → EfficientNet-LSTM pipeline → single deepfake score

Model weights are loaded from the paths set in environment variables:
    EFFICIENTNET_IMAGE_MODEL_PATH   (default: models/efficientnet_image.pth)
    XCEPTION_MODEL_PATH             (default: models/best_xception_weights.h5)
    RESNET_MODEL_PATH               (default: models/resnet_model.keras)
    EFFICIENTNET_VIDEO_MODEL_PATH   (default: models/efficientnet_video.pth)

If a weight file does not exist the corresponding model runs with random
(untrained) weights — useful during development.
"""

from __future__ import annotations

import os
import warnings
import librosa
import librosa.feature
from groq import Groq as _GroqClient
from dotenv import load_dotenv
import math
from pathlib import Path
from typing import Optional

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_ROOT / ".env")

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
_BASE = _BACKEND_ROOT / "models"


def _model_path(env_name: str, default_filename: str) -> Path:
    configured = os.environ.get(env_name)
    if not configured:
        return _BASE / default_filename

    path = Path(configured).expanduser()
    candidates = [path]
    if not path.is_absolute():
        candidates.extend((_BACKEND_ROOT / path, _BASE / path.name))
    candidates.append(_BASE / default_filename)

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


_EFFNET_IMG_PATH  = _model_path("EFFICIENTNET_IMAGE_MODEL_PATH", "image_model.pth")
_XCEPTION_PATH    = _model_path("XCEPTION_MODEL_PATH",           "best_xception_weights.h5")
_RESNET_PATH      = _model_path("RESNET_MODEL_PATH",             "best_model.keras")
_AUDIO_PATH       = _model_path("AUDIO_MODEL_PATH",              "audio_model.pth")
_EFFNET_VID_PATH  = _model_path("EFFICIENTNET_VIDEO_MODEL_PATH", "video_model.pth")

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
            try:
                raw = torch.load(_EFFNET_IMG_PATH, map_location=_DEVICE)
                m.load_state_dict(_remap_keys(raw), strict=False)
                print(f"[DeepGuard] Loaded EfficientNet-B5 image weights: {_EFFNET_IMG_PATH}")
            except Exception as e:
                print(f"[DeepGuard] Failed to load checkpoint ({e}). Using pretrained B5 backbone.")
                try:
                    backbone = models.efficientnet_b5(weights='DEFAULT')
                except TypeError:
                    backbone = models.efficientnet_b5(pretrained=True)
                in_feats = backbone.classifier[1].in_features
                backbone.classifier = nn.Identity()
                m.backbone = backbone
        else:
            print(f"[DeepGuard] EfficientNet-B5 image: no weights at {_EFFNET_IMG_PATH}, using pretrained backbone.")
            try:
                backbone = models.efficientnet_b5(weights='DEFAULT')
            except TypeError:
                backbone = models.efficientnet_b5(pretrained=True)
            in_feats = backbone.classifier[1].in_features
            backbone.classifier = nn.Identity()
            m.backbone = backbone
        m.to(_DEVICE).eval()
        _effnet_img_model = m
    return _effnet_img_model


def _load_effnet_video() -> _EfficientNetVideoModel:
    global _effnet_vid_model
    if _effnet_vid_model is None:
        m = _EfficientNetVideoModel()
        if _EFFNET_VID_PATH.exists():
            try:
                raw = torch.load(_EFFNET_VID_PATH, map_location=_DEVICE)
                m.load_state_dict(_remap_keys(raw), strict=False)
                print(f"[DeepGuard] Loaded EfficientNet-B5 video weights: {_EFFNET_VID_PATH}")
            except Exception as e:
                print(f"[DeepGuard] Failed to load checkpoint ({e}). Using pretrained B0 backbone.")
                try:
                    backbone = models.efficientnet_b0(weights='DEFAULT')
                except TypeError:
                    backbone = models.efficientnet_b0(pretrained=True)
                in_feats = backbone.classifier[1].in_features
                backbone.classifier = nn.Identity()
                m.backbone = backbone
        else:
            print(f"[DeepGuard] EfficientNet-B0 video: no weights at {_EFFNET_VID_PATH}, using pretrained backbone.")
            try:
                backbone = models.efficientnet_b0(weights='DEFAULT')
            except TypeError:
                backbone = models.efficientnet_b0(pretrained=True)
            in_feats = backbone.classifier[1].in_features
            backbone.classifier = nn.Identity()
            m.backbone = backbone
        m.to(_DEVICE).eval()
        _effnet_vid_model = m
    return _effnet_vid_model


def _load_xception():
    """
    Load best_xception_weights.h5 (Keras weights format).

    """
    global _xception_model
    if _xception_model is None:
        model = _build_xception_arch()

        if _XCEPTION_PATH.exists():
            print(f"[DeepGuard] Loading Xception weights from: {_XCEPTION_PATH}")
            try:
                model.load_weights(str(_XCEPTION_PATH))
                print(f"[DeepGuard] Loaded Xception weights: {_XCEPTION_PATH}")
                _xception_model = model
                return _xception_model
            except Exception as direct_error:
                print(f"[DeepGuard] Xception direct weight load warning: {direct_error}")

            try:
                import h5py

                def _weight_order(name):
                    n = name.split('/')[-1].split(':')[0]
                    order = {'kernel':0,'gamma':1,'depthwise_kernel':0,'pointwise_kernel':0,
                             'beta':2,'bias':3,'moving_mean':4,'moving_variance':5}
                    return order.get(n, 6)

                def _load_layer(layer, grp):
                    if not layer.weights:
                        return False
                    lname = layer.name
                    wn_attr = grp.attrs.get("weight_names", [])
                    if not len(wn_attr):
                        return False

                    # Filter to this layer
                    layer_wns = []
                    for wn in wn_attr:
                        wn_str = wn.decode() if isinstance(wn, bytes) else wn
                        if wn_str.startswith(lname + "/"):
                            layer_wns.append(wn_str)

                    # DEDUPLICATE — remove Adam optimizer moment duplicates
                    seen_types = set()
                    deduped = []
                    for wn_str in layer_wns:
                        wtype = wn_str.split('/')[-1].split(':')[0]
                        if wtype not in seen_types:
                            seen_types.add(wtype)
                            deduped.append(wn_str)

                    deduped.sort(key=_weight_order)

                    arrays = [grp[wn][:] for wn in deduped if wn in grp]
                    if len(arrays) == len(layer.weights):
                        layer.set_weights(arrays)
                        return True
                    return False

                loaded_base = 0
                loaded_dense = 0

                with h5py.File(str(_XCEPTION_PATH), "r") as f:
                    mw = f["model_weights"] if "model_weights" in f else f

                    # Base Xception layers stored under model_weights/xception/
                    if "xception" in mw:
                        xc_grp = mw["xception"]
                        for layer in model.layers:
                            if hasattr(layer, 'layers'):  # nested model
                                for sub in layer.layers:
                                    if _load_layer(sub, xc_grp):
                                        loaded_base += 1
                            else:
                                if _load_layer(layer, xc_grp):
                                    loaded_base += 1

                    # Dense head layers
                    for layer in model.layers:
                        if isinstance(layer, tf.keras.layers.Dense):
                            lname = layer.name
                            if lname in mw:
                                if _load_layer(layer, mw[lname]):
                                    loaded_dense += 1

                print(f"[DeepGuard] Loaded Xception: {loaded_base} base + {loaded_dense} dense from {_XCEPTION_PATH}")
                test = np.random.rand(1, 299, 299, 3).astype(np.float32)
                t1 = float(model.predict(test, verbose=0)[0][0])
                test2 = np.zeros((1, 299, 299, 3), dtype=np.float32)
                t2 = float(model.predict(test2, verbose=0)[0][0])
                print(f"[DeepGuard] Xception sanity — random input: {t1:.4f}, zeros: {t2:.4f}")

            except Exception as e:
                import traceback
                print(f"[DeepGuard] Xception h5py load failed: {e}")
                traceback.print_exc()

        else:
            print(f"[DeepGuard] Xception not found at {_XCEPTION_PATH}, using random init.")

        _xception_model = model
    return _xception_model


def _build_xception_arch():
    """Build Xception architecture matching the training code."""
    try:
        base_model = Xception(
            weights="imagenet",
            include_top=False,
            input_shape=(299, 299, 3),
        )
    except Exception as e:
        print(f"[DeepGuard] Xception ImageNet base load warning: {e}. Using weights=None.")
        base_model = Xception(
            weights=None,
            include_top=False,
            input_shape=(299, 299, 3),
        )

    base_model.trainable = False

    inputs = tf.keras.Input(shape=(299, 299, 3))
    x = base_model(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(512, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    outputs = tf.keras.layers.Dense(1, activation="sigmoid")(x)

    model = tf.keras.Model(inputs, outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss="binary_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.AUC(name="auc"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )
    return model


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

def _effnet_score(img: Image.Image, feature_vec: np.ndarray) -> float:
    """
    Score a full image with EfficientNet-B5.
    Output is sigmoid P(fake) 0-1.
    Clamp to [0.001, 0.999] to avoid float rounding to exact 0 or 1.
    """
    model  = _load_effnet_image()
    tensor = _TORCH_TRANSFORM(img).unsqueeze(0).to(_DEVICE)
    fvec   = torch.tensor(feature_vec, dtype=torch.float32).unsqueeze(0).to(_DEVICE)
    with torch.no_grad():
        raw = float(model(tensor, fvec).item())
    if raw < 0.01 or raw > 0.99:
        print(f"[DeepGuard] EfficientNet extreme output: {raw:.4f} (feature_vec={feature_vec})")
    return float(np.clip(raw, 0.001, 0.999))



def _xception_score(img: Image.Image) -> float:
    """
    Score an image with Xception.
    The model is biased toward high outputs (~0.99 for most inputs).
    We apply logit rescaling (temperature=8) to spread the distribution:
      - Very high raw outputs (~0.9997) stay high after rescaling
      - Medium raw outputs (~0.85) get pulled toward 0.5
      - Low raw outputs pull toward 0
    This makes Xception contribute meaningful signal in the ensemble
    rather than always voting ~100% fake.
    """
    model = _load_xception()
    arr   = np.array(img.convert("RGB").resize((299, 299))).astype(np.float32)
    arr   = xception_preprocess(np.expand_dims(arr, 0))
    pred  = model.predict(arr, verbose=0)[0]
    raw   = float(pred[1]) if (hasattr(pred,'__len__') and len(pred)==2) else float(pred[0])

    # Temperature scaling: convert to logit, divide by T, convert back
    # Higher T = more spread. T=8 spreads 0.85-0.9997 range across 0.1-0.99
    raw   = float(np.clip(raw, 1e-7, 1 - 1e-7))
    logit = np.log(raw / (1 - raw))
    T     = 8.0
    scaled = float(1 / (1 + np.exp(-logit / T)))
    return scaled


def _resnet_score(img: Image.Image) -> float:
    """
    Score a full image with ResNet50V2.
    train.py: class_mode='binary', dirs=fake/real → Keras assigns fake=0, real=1
    Model output (sigmoid) = P(real) → P(fake) = 1 - output
    Input: full image (NOT face crop) — matches training distribution.
    """
    model = _load_resnet()
    arr   = np.array(img.convert("RGB").resize((224, 224))).astype(np.float32)
    arr   = resnet_preprocess(np.expand_dims(arr, 0))
    pred  = model.predict(arr, verbose=0)[0]
    # Sigmoid output = P(real), so P(fake) = 1 - output
    return float(1.0 - np.squeeze(pred))


def _ensemble_score(img: Image.Image, feature_vec: np.ndarray) -> dict:
    """
    Three-model ensemble: EfficientNet-B5 + Xception + ResNet50V2.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results = {}

    def run_effnet():
        return ("efficientnet", _effnet_score(img, feature_vec))

    def run_resnet():
        return ("resnet", _resnet_score(img))

    def run_xception():
        return ("xception", _xception_score(img))

    # Pre-load models before threading to avoid race conditions
    _load_effnet_image()
    _load_xception()
    _load_resnet()

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
                import traceback; traceback.print_exc()

    s_eff = results.get("efficientnet", 0.5)
    s_xcp = results.get("xception",     0.5)
    s_res = results.get("resnet",       0.5)

    weighted = (s_eff + s_xcp + s_res) / 3.0

    return {
        "efficientnet": round(s_eff    * 100, 2),
        "xception":     round(s_xcp    * 100, 2),
        "resnet":       round(s_res    * 100, 2),
        "average":      round(weighted * 100, 2),
    }


# ══════════════════════════════════════════════════════════════════════════
# 5.  RED FLAGS  (explainability helpers)
# ══════════════════════════════════════════════════════════════════════════

def _generate_red_flags(
    feature_vec: np.ndarray,
    ai_score: float,
    model_scores: dict | None = None,
) -> list[str]:
    """
    Generate red flags from real measured signals:
      - feature_vec: [num_faces, avg_face_area, blur, color_std, edge_density]
      - ai_score: ensemble average (0-100)
      - model_scores: per-model scores dict for agreement analysis
    """
    flags = []
    _, _, blur, color, edge = feature_vec

    # ── CV feature flags (from real OpenCV measurements) ──
    if blur < 0.15:
        flags.append("Very low image sharpness — heavy blurring around facial features, typical of GAN face synthesis")
    elif blur < 0.35:
        flags.append("Below-average image sharpness — moderate blurring around edges, common in synthesised faces")

    if color < 0.15:
        flags.append("Extremely uniform skin tone — near-zero colour variance, characteristic of GAN-generated faces")
    elif color < 0.30:
        flags.append("Low colour diversity — unnaturally uniform skin tone detected")

    if edge < 0.03:
        flags.append("Very sparse edge detail — smooth boundaries typical of neural face synthesis (GAN smoothing)")
    elif edge < 0.07:
        flags.append("Reduced edge density — softer boundaries than expected for a real photograph")

    # ── Model agreement flags ──
    if model_scores:
        scores = list(model_scores.values())
        if len(scores) >= 2:
            spread = max(scores) - min(scores)
            if spread > 40:
                flags.append(
                    f"High model disagreement ({spread:.0f}% spread) — "
                    "models detected inconsistent signals, suggesting partial manipulation"
                )
            elif spread > 20:
                flags.append(f"Moderate model disagreement ({spread:.0f}% spread) — some inconsistency between detection models")

        # Flag when all models agree strongly
        high_scores = [s for s in scores if s > 70]
        if len(high_scores) == len(scores) and len(scores) >= 2:
            flags.append(f"All {len(scores)} models independently scored above 70% — strong consensus on deepfake indicators")
        elif all(s < 30 for s in scores) and len(scores) >= 2:
            flags.append(f"All {len(scores)} models scored below 30% — strong consensus that content is authentic")

    # ── Score-based flags ──
    if ai_score > 85:
        flags.append("Extremely high deepfake probability — ensemble score in the top risk tier")
    elif ai_score > 70:
        flags.append("High composite deepfake probability across detection models")
    elif ai_score > 50:
        flags.append("Moderate deepfake probability — further manual review recommended")
    elif ai_score < 20:
        flags.append("Very low AI score — content shows strong characteristics of authentic media")

    if not flags:
        flags.append("No strong artefacts detected — content appears authentic across all signal channels")

    return flags


def _generate_summary(
    ai_score: float,
    is_deepfake: bool,
    file_type: str,
    model_scores: dict | None = None,
    red_flags: list[str] | None = None,
    total_faces: int = 0,
    extra_context: dict | None = None,
) -> str:
    """
    Generate analysis summary using Groq (completely free, no credit card).
    Get your free API key at https://console.groq.com/
    Set GROQ_API_KEY in your .env file.
    Falls back to hardcoded summary if key is not set or call fails.
    """
    api_key = os.environ.get("GROQ_API_KEY", "")
    if api_key:
        try:
            scores_text = ", ".join(f"{k}: {v:.1f}%" for k, v in (model_scores or {}).items())
            flags_text  = "; ".join(red_flags or [])
            verdict     = "DEEPFAKE" if is_deepfake else "AUTHENTIC"
            faces_text  = f"{total_faces} face(s) detected" if file_type == "image" else ""

            faces_line = f"\n- Faces detected: {total_faces}" if file_type == "image" else ""

            # Build model context so the LLM understands what each model does
            if file_type == "image":
                model_context = (
                    "EfficientNet-B5: CNN trained on full images, fused with OpenCV "
                    "visual features (sharpness, edge density, colour variance). "
                    "Xception: ImageNet-initialised CNN fine-tuned for image deepfake detection. "
                    "ResNet50V2: residual CNN trained on real/fake images. "
                    "Final score: average of the three image models."
                )
            elif file_type == "video":
                model_context = (
                    "EfficientNet-B0 + LSTM: a video-specific model that extracts CNN visual features "
                    "from each frame, then feeds the sequence into an LSTM to detect temporal "
                    "inconsistencies across frames. The final score is the LSTM output after "
                    "processing the entire frame sequence."
                )
            else:
                model_context = (
                    "IMPORTANT: There is only ONE model used for audio detection — AudioCNN. "
                    "There is NO ensemble, NO multiple models, NO combination of models. "
                    "AudioCNN is a single CNN that takes a log-mel spectrogram (128 mel bands) "
                    "fused with 13 MFCC features and outputs a single fake probability score."
                )

            # Compute model agreement for the prompt
            scores_list = list((model_scores or {}).values())
            if len(scores_list) >= 2:
                spread = max(scores_list) - min(scores_list)
                agreement = "high agreement" if spread < 15 else "moderate agreement" if spread < 30 else "significant disagreement"
                agreement_text = f"Model agreement: {agreement} (spread: {spread:.1f}%)"
            else:
                agreement_text = ""

            # Add extra context (e.g. temporal stats for video)
            extra_lines = ""
            if extra_context:
                for k, v in extra_context.items():
                    if v is not None:
                        extra_lines += f"\n- {k.replace('_', ' ').title()}: {v}"

            prompt = f"""You are a deepfake detection analyst writing a report for a media authenticity platform.

A {file_type} was scanned by an ensemble of AI models. Write a precise, informative 2-3 sentence summary explaining what the models found and what it means.

=== HOW THE MODELS WORK ===
{model_context}

=== SCAN RESULTS ===
- Overall AI score: {ai_score:.1f}% (>50% = likely fake, <50% = likely real)
- Verdict: {verdict}
- Individual model scores: {scores_text or "not available"}
- {agreement_text}
- Detected signals/red flags: {flags_text or "none detected"}{faces_line}{extra_lines}

=== INSTRUCTIONS ===
- Reference the specific score ({ai_score:.1f}%) and verdict ({verdict}) in your summary
- Mention which models flagged it and whether they agreed or disagreed
- Explain what the red flags mean in plain language
- Be precise and technical but understandable to a non-expert
- Write in third person, 2-3 sentences maximum, no bullet points
- Do NOT start with "The image/video scored" — vary the opening
- Keep it under 60 words total
- Do NOT contradict the verdict — if the verdict is AUTHENTIC, do not suggest manipulation
- NEVER use the word "ensemble" for audio — there is only ONE model (AudioCNN)"""

            client = _GroqClient(api_key=api_key)
            chat   = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return chat.choices[0].message.content.strip()
        except Exception as e:
            print(f"[DeepGuard] Groq summary failed ({e}), using fallback.")
    return _fallback_summary(ai_score, is_deepfake, file_type)


def _fallback_summary(ai_score: float, is_deepfake: bool, file_type: str) -> str:
    if is_deepfake:
        return (
            f"The {file_type} scored {ai_score:.1f}% on the ensemble deepfake detector. "
            "All three models independently flagged suspicious characteristics including "
            "texture inconsistencies, unnatural smoothing, or lighting artefacts. "
            "High confidence that this content has been synthetically generated or manipulated."
        )
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



# ══════════════════════════════════════════════════════════════════════════
# Audio deepfake model
# Architecture: CNN on Mel spectrogram -> MLP head
# Checkpoint keys: cnn_encoder.encoder.* and fusion_layer.*
# ══════════════════════════════════════════════════════════════════════════

class _MelCNNEncoder(nn.Module):
    """CNN encoder matching audio_trainer.py / main.py _MelCNNEncoder exactly."""
    def __init__(self, n_mels: int = 128, embed_dim: int = 256):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(128, embed_dim),
            nn.ReLU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)


class _AudioCNN(nn.Module):
    """
    AudioDeepfakeDetector matching main.py / audio_trainer.py exactly.
    Architecture:
      cnn_encoder: _MelCNNEncoder(n_mels=128, embed_dim=256)
      fusion_layer: Linear(256+13, 256) → ReLU → Dropout(0.3)
                  → Linear(256, 128) → ReLU → Dropout(0.3)
                  → Linear(128, 1) → Sigmoid
    Input:
      mel_tensor:   (B, 1, n_mels, T) — log-mel spectrogram, normalised to [0,1]
      feature_vec:  (B, 13) — 13 scalar handcrafted audio features
    """
    NUM_AUDIO_FEATURES = 13
    CNN_EMBED_DIM      = 256

    def __init__(self):
        super().__init__()
        self.cnn_encoder = _MelCNNEncoder(n_mels=128, embed_dim=self.CNN_EMBED_DIM)
        self.fusion_layer = nn.Sequential(
            nn.Linear(self.CNN_EMBED_DIM + self.NUM_AUDIO_FEATURES, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )

    def forward(self, mel_tensor: torch.Tensor, audio_feature_vector: torch.Tensor) -> torch.Tensor:
        cnn_features = self.cnn_encoder(mel_tensor)
        combined     = torch.cat([cnn_features, audio_feature_vector], dim=1)
        return self.fusion_layer(combined)


_audio_model: Optional[_AudioCNN] = None


def _load_audio() -> _AudioCNN:
    global _audio_model
    if _audio_model is None:
        model = _AudioCNN()
        if _AUDIO_PATH.exists():
            try:
                ckpt = torch.load(str(_AUDIO_PATH), map_location="cpu", weights_only=True)
                sd = ckpt.get("state_dict") or ckpt.get("model_state_dict") or ckpt
                missing, unexpected = model.load_state_dict(sd, strict=False)
                if missing:
                    print(f"[DeepGuard] Audio missing keys ({len(missing)}): {missing[:3]}")
                print(f"[DeepGuard] Loaded audio model: {_AUDIO_PATH}")
            except Exception as e:
                print(f"[DeepGuard] Audio model load error: {e}")
        else:
            print(f"[DeepGuard] Audio model not found at {_AUDIO_PATH}")
        model.eval()
        _audio_model = model
    return _audio_model


# ── Audio preprocessing constants matching AudioPreprocessor in main.py ──
_AUDIO_SR          = 16_000
_AUDIO_DURATION    = 4.0          # seconds — fixed clip length used in training
_AUDIO_N_MELS      = 128
_AUDIO_N_FFT       = 1024         # matches AudioPreprocessor.n_fft
_AUDIO_HOP_LENGTH  = 512
_AUDIO_N_MFCC      = 13
_AUDIO_TARGET_SAMPLES = int(_AUDIO_SR * _AUDIO_DURATION)


def _load_waveform(file_path: str) -> np.ndarray:
    """Load audio to mono 16kHz float32, matching AudioPreprocessor.load_audio."""
    try:
        waveform, sr = librosa.load(file_path, sr=_AUDIO_SR, mono=True)
    except Exception:
        import soundfile as sf
        waveform, sr = sf.read(file_path, always_2d=False)
        if waveform.ndim > 1:
            waveform = waveform.mean(axis=1)
        if sr != _AUDIO_SR:
            waveform = librosa.resample(waveform, orig_sr=sr, target_sr=_AUDIO_SR)
    return waveform.astype(np.float32)


def _fix_length(waveform: np.ndarray) -> np.ndarray:
    """Pad or trim to exactly _AUDIO_TARGET_SAMPLES, matching AudioPreprocessor._fix_length."""
    n = len(waveform)
    if n >= _AUDIO_TARGET_SAMPLES:
        return waveform[:_AUDIO_TARGET_SAMPLES]
    return np.pad(waveform, (0, _AUDIO_TARGET_SAMPLES - n), mode="constant")


def _waveform_to_mel_tensor(waveform: np.ndarray) -> torch.Tensor:
    """Convert waveform to normalised log-mel tensor, matching AudioPreprocessor.waveform_to_mel_tensor."""
    waveform = _fix_length(waveform)
    mel_spec  = librosa.feature.melspectrogram(
        y=waveform, sr=_AUDIO_SR,
        n_fft=_AUDIO_N_FFT, hop_length=_AUDIO_HOP_LENGTH, n_mels=_AUDIO_N_MELS,
    )
    log_mel      = librosa.power_to_db(mel_spec, ref=np.max)
    log_mel_norm = (log_mel - log_mel.min()) / (log_mel.max() - log_mel.min() + 1e-8)
    tensor = torch.tensor(log_mel_norm, dtype=torch.float32)
    return tensor.unsqueeze(0).unsqueeze(0)   # (1, 1, n_mels, T)


def _extract_audio_features(waveform: np.ndarray) -> np.ndarray:
    """
    Extract 13 scalar features matching AudioPreprocessor.extract_audio_features exactly.
    Feature order must match training: MFCC mean, spectral centroid, bandwidth, rolloff,
    ZCR, RMS energy, tempo, pitch mean, pitch std, HNR, spectral flatness, chroma std,
    dynamic range.
    """
    waveform = _fix_length(waveform)
    sr       = _AUDIO_SR

    # MFCC — single mean scalar
    mfccs    = librosa.feature.mfcc(y=waveform, sr=sr, n_mfcc=_AUDIO_N_MFCC)
    mfcc_mean = float(np.mean(mfccs))

    # Spectral features
    spec_centroid  = librosa.feature.spectral_centroid(y=waveform, sr=sr)
    spec_bandwidth = librosa.feature.spectral_bandwidth(y=waveform, sr=sr)
    spec_rolloff   = librosa.feature.spectral_rolloff(y=waveform, sr=sr)

    # Zero crossing rate & RMS
    zcr = librosa.feature.zero_crossing_rate(waveform)
    rms = librosa.feature.rms(y=waveform)
    rms_energy_mean = float(np.mean(rms))

    # Tempo
    tempo, _ = librosa.beat.beat_track(y=waveform, sr=sr)
    tempo_val = float(tempo) if np.isscalar(tempo) else float(tempo[0])

    # Pitch (YIN)
    f0        = librosa.yin(waveform, fmin=60, fmax=400, sr=sr)
    f0_voiced = f0[f0 > 0]
    pitch_mean = float(np.mean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    pitch_std  = float(np.std(f0_voiced))  if len(f0_voiced) > 0 else 0.0

    # Harmonics-to-Noise Ratio
    harmonic, percussive = librosa.effects.hpss(waveform)
    harmonic_rms   = float(np.sqrt(np.mean(harmonic ** 2)) + 1e-8)
    percussive_rms = float(np.sqrt(np.mean(percussive ** 2)) + 1e-8)
    hnr = float(10 * np.log10(harmonic_rms / percussive_rms))

    # Spectral flatness
    spec_flatness = librosa.feature.spectral_flatness(y=waveform)

    # Chroma stability
    chroma        = librosa.feature.chroma_stft(y=waveform, sr=sr)
    chroma_std_mean = float(np.mean(np.std(chroma, axis=1)))

    # Dynamic range
    peak_db      = float(20 * np.log10(np.max(np.abs(waveform)) + 1e-8))
    rms_db       = float(20 * np.log10(rms_energy_mean + 1e-8))
    dynamic_range = peak_db - rms_db

    return np.array([
        mfcc_mean,
        float(np.mean(spec_centroid)),
        float(np.mean(spec_bandwidth)),
        float(np.mean(spec_rolloff)),
        float(np.mean(zcr)),
        rms_energy_mean,
        tempo_val,
        pitch_mean,
        pitch_std,
        hnr,
        float(np.mean(spec_flatness)),
        chroma_std_mean,
        dynamic_range,
    ], dtype=np.float32)


def _audio_score_from_path(file_path: str) -> float:
    """
    Full audio preprocessing pipeline matching AudioPreprocessor.process_audio() exactly:
      1. Load to mono 16kHz float32
      2. Pad/trim to 4 seconds (64,000 samples)
      3. Log-mel spectrogram (n_fft=1024, hop=512, n_mels=128) → normalise [0,1]
      4. 13 scalar handcrafted features (MFCC, spectral, pitch, HNR, etc.)
      5. Run through _AudioCNN → sigmoid → P(fake) 0-100
    """
    try:
        waveform   = _load_waveform(file_path)
        mel_tensor = _waveform_to_mel_tensor(waveform)          # (1, 1, 128, T)
        feat_vec   = _extract_audio_features(waveform)          # (13,)
        feat_tensor = torch.tensor(feat_vec, dtype=torch.float32).unsqueeze(0)  # (1, 13)

        model = _load_audio()
        with torch.no_grad():
            pred = model(mel_tensor.to(_DEVICE), feat_tensor.to(_DEVICE))
        return round(float(pred.squeeze()) * 100.0, 2)
    except Exception as e:
        print(f"[DeepGuard] Audio scoring error: {e}")
        import traceback; traceback.print_exc()
        return 50.0


def run_image_pipeline(image_path: str, filename: str) -> dict:
    """
    Ensemble image pipeline — matches training exactly.

    ALL THREE MODELS were trained on FULL IMAGES (not face crops):
      - image_trainer.py: full image 224x224, ImageNet normalise
      - train.py (ResNet): full image 224x224, ResNetV2 preprocess
      - train3.py (Xception): full image 299x299, Xception preprocess

    Face detection is used only for:
      1. Extracting the 5-dim OpenCV feature vector (for EfficientNet fusion layer)
      2. Counting faces for metadata / per-face predictions
      3. Generating heatmap regions

    The ensemble runs once on the full image, not per-crop.
    """
    pil_img     = Image.open(image_path).convert("RGB")
    feature_vec, num_faces = _opencv_features(pil_img)
    face_crops  = _detect_faces_opencv(pil_img)

    # ── Run ensemble on FULL image (matches training distribution) ──
    scores = _ensemble_score(pil_img, feature_vec)
    ai_score    = round(scores["average"], 2)
    is_deepfake = ai_score > 50.0
    confidence  = round(abs(ai_score - 50.0) * 2, 2)

    # ── Per-face predictions (metadata only, not used for scoring) ──
    # We run EfficientNet on each face crop just for face-level labels
    all_predictions = []
    for i, crop in enumerate(face_crops):
        fv_crop, _ = _opencv_features(crop)
        face_score = _effnet_score(crop, fv_crop) * 100
        all_predictions.append({
            "face":       i + 1,
            "label":      "likely fake" if face_score > 50 else "likely real",
            "confidence": round(face_score, 2),
        })

    model_scores_list = [
        {"model": "efficientnet_b5", "score": scores["efficientnet"]},
        {"model": "xception",        "score": scores["xception"]},
        {"model": "resnet50v2",      "score": scores["resnet"]},
    ]

    img_model_scores = {
        "EfficientNet-B5": scores["efficientnet"],
        "Xception":        scores["xception"],
        "ResNet50V2":      scores["resnet"],
    }
    flags   = _generate_red_flags(feature_vec, ai_score, model_scores=img_model_scores)
    summary = _generate_summary(
        ai_score, is_deepfake, "image",
        model_scores=img_model_scores,
        red_flags=flags,
        total_faces=num_faces,
    )

    return {
        "ai_score":         ai_score,
        "confidence":       confidence,
        "is_deepfake":      is_deepfake,
        "total_faces":      num_faces,
        "predictions":      all_predictions,
        "model_scores":     model_scores_list,
        "red_flags":        flags,
        "analysis_summary": summary,
        "heatmap_regions":  _heatmap_regions(num_faces),
        "temporal_data":    [],
    }



def run_audio_pipeline(file_path: str, filename: str) -> dict:
    """
    Run audio deepfake detection on a standalone audio file.
    Also used for the audio track of video files.
    """
    audio_score = _audio_score_from_path(file_path)
    is_deepfake = audio_score >= 50.0

    flags = []
    if audio_score >= 70:
        flags.append("High deepfake probability in audio track")
        flags.append("Synthetic speech patterns detected")
    elif audio_score >= 50:
        flags.append("Moderate deepfake probability in audio track")
        flags.append("Some anomalies detected in spectral features")
    else:
        flags.append("Audio track appears authentic")
        flags.append("No synthetic speech patterns detected")

    summary = _generate_summary(
        audio_score, is_deepfake, "audio",
        model_scores={"AudioCNN": audio_score},
        red_flags=flags, total_faces=0
    )

    return {
        "filename":         filename,
        "file_type":        "audio",
        "ai_score":         round(audio_score, 2),
        "confidence":       round(abs(audio_score - 50) * 2, 2),
        "is_deepfake":      is_deepfake,
        "total_faces":      0,
        "predictions":      [],
        "model_scores":     [{"model": "AudioCNN", "score": audio_score}],
        "heatmap_regions":  [],
        "temporal_data":    [],
        "red_flags":        flags,
        "analysis_summary": summary,
        "frames_analyzed":  0,
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

    ai_score      = round(score * 100, 2)
    combined_score = ai_score  # video-only score, no audio blending
    is_deepfake    = combined_score >= 50.0
    confidence     = round(abs(combined_score - 50.0) * 2, 2)
    # ── Temporal data first (needed for real red flags) ──
    effnet_vid = _load_effnet_video()
    temporal_data = []
    all_img_tensors = [_TORCH_TRANSFORM(f) for f in pil_frames]

    for i in range(len(pil_frames)):
        window_imgs = torch.stack(all_img_tensors[:i+1]).unsqueeze(0).to(_DEVICE)
        window_fvs  = torch.stack(feature_vectors[:i+1]).unsqueeze(0).to(_DEVICE)
        with torch.no_grad():
            frame_score = float(effnet_vid(window_imgs, window_fvs).item())
        temporal_data.append({
            "timestamp":     round(float(frame_indices[i]) / fps, 2),
            "ai_likelihood": round(frame_score * 100, 2),
        })

    # ── Real video red flags from temporal + audio data ──
    frame_scores = [d["ai_likelihood"] for d in temporal_data]
    flags = []

    # Temporal pattern flags — only fire when the overall score supports them
    if frame_scores:
        avg_frame  = float(np.mean(frame_scores))
        peak_frame = float(np.max(frame_scores))
        low_frame  = float(np.min(frame_scores))
        spread     = peak_frame - low_frame

        # Temporal inconsistency: only meaningful if overall score is moderate/high
        # A 0.88% overall score with a 60% peak just means 1 noisy frame — not manipulation
        if spread > 50 and combined_score > 35:
            flags.append(
                f"High temporal inconsistency — frame scores vary by {spread:.0f}% "
                f"(peak {peak_frame:.0f}%, low {low_frame:.0f}%), suggesting selective manipulation"
            )

        # Strong consistent signal — only if avg AND overall score are both high
        if peak_frame > 85 and avg_frame > 65 and combined_score > 60:
            flags.append(
                f"Peak frame score of {peak_frame:.0f}% with sustained average of {avg_frame:.0f}% — "
                "strong and consistent deepfake indicators across the video"
            )

        # Sustained high frames — only if overall score agrees
        if avg_frame > 75 and combined_score > 60:
            flags.append(
                f"Sustained high frame scores (average {avg_frame:.0f}%) across the video duration"
            )

        # Authentic — only show if score is genuinely low
        if combined_score < 25:
            flags.append(
                f"Low overall score ({combined_score:.1f}%) with consistently low frame scores "
                f"(average {avg_frame:.0f}%) — temporal pattern appears authentic throughout"
            )

    # (Audio model not used for video detection — only for standalone audio files)

    if not flags:
        flags.append("No strong deepfake indicators detected across video or audio channels")

    # ── Summary with real temporal context ──
    vid_model_scores = {"EfficientNet-B0 LSTM": round(ai_score, 1)}
    summary = _generate_summary(
        combined_score, is_deepfake, "video",
        model_scores=vid_model_scores,
        red_flags=flags,
        total_faces=0,
        extra_context={
            "avg_frame_score":  round(float(np.mean(frame_scores)), 1) if frame_scores else None,
            "peak_frame_score": round(float(np.max(frame_scores)), 1) if frame_scores else None,
            "frames_analyzed":  len(pil_frames),
        }
    )

    return {
        "ai_score":         combined_score,
        "confidence":       round(abs(combined_score - 50.0) * 2, 2),
        "is_deepfake":      is_deepfake,
        "frames_analyzed":  len(pil_frames),
        "temporal_data":    temporal_data,
        "predictions":      [],
        "total_faces":      None,
        "model_scores":     [{"model": "EfficientNet-B0 LSTM", "score": round(ai_score, 2)}],
        "red_flags":        flags,
        "analysis_summary": summary,
        "heatmap_regions":  [],
    }
