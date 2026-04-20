# DeepGuard — Complete Backend Implementation Guide

This guide covers every step to get the backend running and wired up to the
existing Next.js frontend, on both **macOS Apple Silicon** and **Windows**.

---

## Directory Structure After Setup

```
deepguard-project/
├── DeepGuard-frontend/          ← your existing Next.js app
│   ├── lib/
│   │   ├── firebase.js          ← REPLACE with frontend-updates/lib/firebase.js
│   │   └── auth.js              ← REPLACE with frontend-updates/lib/auth.js
│   ├── components/
│   │   └── ImageUpload.jsx      ← REPLACE with frontend-updates/components/ImageUpload.jsx
│   ├── context/
│   │   └── ResultsContext.jsx   ← REPLACE with frontend-updates/context/ResultsContext.jsx
│   └── .env.local               ← CREATE from frontend-updates/.env.local.example
│
└── deepguard-backend/
    ├── app/
    │   ├── __init__.py
    │   ├── main.py              ← FastAPI routes
    │   ├── firebase_client.py   ← Firebase Admin SDK + auth middleware
    │   ├── model_runner.py      ← Ensemble image + EfficientNet video pipelines
    │   └── schemas.py           ← Pydantic response models
    ├── models/                  ← Put your trained .pth / .h5 / .keras files here
    ├── run.py                   ← Entry point
    ├── requirements.txt
    ├── .env.example             ← Copy to .env and fill in
    └── firestore.rules          ← Deploy to Firebase
```

---

## PART 1 — Backend Setup

### Step 1 — Python Version

Make sure you have **Python 3.10, 3.11, or 3.12** installed.

```bash
python --version   # or python3 --version
```

- **macOS ARM**: use [Homebrew](https://brew.sh) — `brew install python@3.11`
- **Windows**: download from [python.org](https://www.python.org/downloads/)
  and tick **"Add Python to PATH"** during install.

---

### Step 2 — Create a Virtual Environment

**macOS / Linux:**
```bash
cd deepguard-backend
python3 -m venv venv
source venv/bin/activate
```

**Windows (Command Prompt):**
```bat
cd deepguard-backend
python -m venv venv
venv\Scripts\activate
```

**Windows (PowerShell):**
```powershell
cd deepguard-backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

---

### Step 3 — Install Dependencies

#### macOS Apple Silicon (M1/M2/M3/M4)

```bash
# Upgrade pip first
pip install --upgrade pip

# Install everything
pip install -r requirements.txt
```

PyTorch and TensorFlow both ship native arm64 wheels — no extra steps needed.

#### Windows

```bat
pip install --upgrade pip
pip install -r requirements.txt
```

> **Optional GPU (CUDA) on Windows/Linux:**  
> Before running the above, install the CUDA-enabled PyTorch wheel from  
> https://pytorch.org/get-started/locally/  
> Example (CUDA 12.1):  
> `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`

---

### Step 4 — Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com) → your project
   → **Project Settings** → **Service Accounts**
2. Click **"Generate new private key"** → download the JSON file
3. Save it as `deepguard-backend/firebase-service-account.json`
   (or anywhere — you'll set the path in `.env`)

---

### Step 5 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and set:

```env
FIREBASE_SERVICE_ACCOUNT_JSON=./firebase-service-account.json
```

If you have trained model weights, set their paths too:

```env
EFFICIENTNET_IMAGE_MODEL_PATH=models/efficientnet_image.pth
XCEPTION_MODEL_PATH=models/xception_model.h5
RESNET_MODEL_PATH=models/resnet_model.keras
EFFICIENTNET_VIDEO_MODEL_PATH=models/efficientnet_video.pth
```

> If weight files are missing the server still starts — models run with
> random (untrained) weights so you can verify wiring before training is done.

---

### Step 6 — Place Trained Model Weights

Copy your trained weight files into `deepguard-backend/models/`:

| File | Trained from |
|------|-------------|
| `efficientnet_image.pth` | `DeepGuard-efficientnet` — `DeepfakeDetector` class |
| `xception_model.h5` | `DeepGuard-xception` — Xception Keras model |
| `resnet_model.keras` | `DeepGuard-resnet` — ResNet50V2 Keras model |
| `efficientnet_video.pth` | `DeepGuard-efficientnet` — `VideoDeepfakeDetector` class |

**Saving weights from each training repo:**

EfficientNet (PyTorch):
```python
# After training, save with:
torch.save(model.state_dict(), "efficientnet_image.pth")
# or for video model:
torch.save(video_model.state_dict(), "efficientnet_video.pth")
```

Xception / ResNet (Keras):
```python
model.save("xception_model.h5")   # or .keras format
model.save("resnet_model.keras")
```

---

### Step 7 — Start the Backend Server

**Development (with auto-reload):**
```bash
python run.py --reload
```

**Production:**
```bash
python run.py --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Test the health endpoint:**
```bash
curl http://localhost:8000/health
# → {"status":"ok","service":"DeepGuard API"}
```

**Interactive API docs** (Swagger UI):
```
http://localhost:8000/docs
```

---

## PART 2 — Frontend Updates

### Step 8 — Create the `lib/` folder

Inside your `DeepGuard-frontend/` directory:

```bash
mkdir -p lib
```

---

### Step 9 — Replace / Add Files

Copy these files from `deepguard-backend/frontend-updates/` into the
matching locations in `DeepGuard-frontend/`:

| Source (frontend-updates/) | Destination (DeepGuard-frontend/) |
|---|---|
| `lib/firebase.js` | `lib/firebase.js` ← **NEW** |
| `lib/auth.js` | `lib/auth.js` ← **NEW** |
| `components/ImageUpload.jsx` | `components/ImageUpload.jsx` ← **REPLACE** |
| `context/ResultsContext.jsx` | `context/ResultsContext.jsx` ← **REPLACE** |

---

### Step 10 — Update Imports in Existing Frontend Files

Any file that currently imports from `./firebase` or `../firebase` must now
import from `@/lib/firebase` (or the relative equivalent).

In particular, update `app/auth/page.jsx`:

Find:
```js
import { auth, googleProvider, facebookProvider } from "./firebase"
// or
import { loginWithGoogle, loginWithEmail, ... } from "./firebase"
```

Replace with:
```js
import { auth, googleProvider, facebookProvider } from "@/lib/firebase"
import { loginWithGoogle, loginWithEmail, logout, ... } from "@/lib/auth"
```

---

### Step 11 — Create `.env.local`

Inside `DeepGuard-frontend/`:

```bash
cp ../deepguard-backend/frontend-updates/.env.local.example .env.local
```

The file already contains your Firebase config values. Just confirm
`NEXT_PUBLIC_API_URL` points to your backend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

When you deploy to production, change this to your hosted backend URL.

---

### Step 12 — Start the Frontend

```bash
cd DeepGuard-frontend
npm install
npm run dev
```

Visit `http://localhost:3000`.

---

## PART 3 — Firebase Configuration

### Step 13 — Enable Firestore

1. Firebase Console → your project → **Firestore Database**
2. Click **"Create database"** → choose a region → **Start in production mode**

---

### Step 14 — Deploy Firestore Security Rules

From inside `deepguard-backend/`:

```bash
# Install Firebase CLI if you don't have it
npm install -g firebase-tools

# Login
firebase login

# Init (point to your project)
firebase use deepguard-project

# Deploy rules only
firebase deploy --only firestore:rules
```

This ensures users can only read/write their own scans.

---

### Step 15 — Enable Authentication Providers

Firebase Console → **Authentication** → **Sign-in method**:

- ✅ Email/Password — Enable
- ✅ Google — Enable (add your support email)
- ✅ Facebook — Enable (paste your App ID + App Secret from
  [developers.facebook.com](https://developers.facebook.com))

---

## PART 4 — API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | None | Server health check |
| `POST` | `/scan` | Bearer token | Upload image or video for analysis |
| `GET` | `/results` | Bearer token | Get all scans for current user |
| `GET` | `/results/{scan_id}` | Bearer token | Get single scan |
| `DELETE` | `/results/{scan_id}` | Bearer token | Delete single scan |

**POST /scan — Request:**
```
Content-Type: multipart/form-data
Authorization: Bearer <firebase_id_token>
Body: file=<image or video file>
```

**POST /scan — Response:**
```json
{
  "scan_id": "uuid",
  "user_id": "firebase_uid",
  "filename": "photo.jpg",
  "file_type": "image",
  "created_at": "2026-04-13T00:00:00Z",
  "ai_score": 78.4,
  "confidence": 56.8,
  "is_deepfake": true,
  "total_faces": 1,
  "predictions": [{ "face": 1, "label": "fake", "confidence": 78.4 }],
  "model_scores": [
    { "model": "efficientnet", "score": 81.2 },
    { "model": "xception",     "score": 75.3 },
    { "model": "resnet",       "score": 78.7 }
  ],
  "red_flags": ["Low image sharpness ...", "High composite deepfake probability ..."],
  "analysis_summary": "The image scored 78.4% ...",
  "heatmap_regions": [{ "x": 48, "y": 38, "width": 18, "height": 22, "intensity": 0.3 }],
  "temporal_data": []
}
```

---

## PART 5 — How the Ensemble Works

### Image Detection (3-model ensemble)

```
Input image
    │
    ├── Face detection (OpenCV Haar Cascade)
    │       └── crops each detected face
    │
    └── For each face:
            ├── EfficientNet-B5 + OpenCV features  → score_1  (0–1)
            ├── Xception                           → score_2  (0–1)
            └── ResNet50V2                         → score_3  (0–1)
                         │
                         └── average = (s1 + s2 + s3) / 3
                                    × 100 = ai_score (%)
```

- `ai_score > 50` → classified as DEEPFAKE
- `confidence = |ai_score − 50| × 2`  (how far from the decision boundary)

### Video Detection (EfficientNet LSTM)

```
Input video
    │
    ├── Extract N evenly-spaced frames (default: 10)
    ├── Each frame → OpenCV features (5-dim vector)
    └── Frame tensors + feature vectors → EfficientNet-B0 → LSTM → score
                                                               × 100 = ai_score (%)
```

Per-frame scores are also computed (using the image EfficientNet) and
returned as `temporal_data` for the timeline chart in the frontend.

---

## PART 6 — Troubleshooting

### `Firebase credentials not configured`
→ Make sure `.env` is present in `deepguard-backend/` and
  `FIREBASE_SERVICE_ACCOUNT_JSON` points to a valid file.

### `401 Missing or malformed Authorization header`
→ The frontend isn't sending the Firebase token.  Make sure `auth.currentUser`
  is non-null when scanning (user must be signed in).  
  For development testing without auth, you can temporarily remove the
  `Depends(verify_token)` from the scan endpoint.

### `415 Unsupported file type`
→ The browser is sending a MIME type not in the allow-list.  Check the
  `content_type` in the error — add it to `ALLOWED_IMAGE_TYPES` or
  `ALLOWED_VIDEO_TYPES` in `app/main.py` if needed.

### `torch.hub.load` fails on first run (no internet)
→ The video model uses `torch.hub` to download EfficientNet-B0 architecture.
  Run once with internet access; it caches to `~/.cache/torch/hub/`.

### TensorFlow + macOS ARM — `Illegal instruction`
→ Ensure you installed from PyPI (which ships a native arm64 wheel):
  `pip install tensorflow`  — do NOT use `tensorflow-macos` (deprecated).

### `cv2.error` — Haar cascade not found
→ Reinstall `opencv-python-headless`:
  `pip install --force-reinstall opencv-python-headless`

---

## Quick-Start Checklist

- [ ] Python 3.10–3.12 installed
- [ ] Virtual environment created and activated
- [ ] `pip install -r requirements.txt` completed without errors
- [ ] `firebase-service-account.json` saved to `deepguard-backend/`
- [ ] `.env` created from `.env.example`
- [ ] Model weight files placed in `deepguard-backend/models/` (or paths set in `.env`)
- [ ] `python run.py` starts without errors
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] Frontend files replaced (lib/firebase.js, lib/auth.js, components/ImageUpload.jsx, context/ResultsContext.jsx)
- [ ] `.env.local` created in `DeepGuard-frontend/`
- [ ] Firestore database created in Firebase Console
- [ ] Firestore security rules deployed
- [ ] Firebase Auth providers enabled (Email, Google, Facebook)
- [ ] `npm run dev` starts frontend without errors
- [ ] Upload a test image → result appears in the UI ✅
