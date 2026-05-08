# DeepGuard

**DeepGuard** is a fully deployed, multimodal deepfake detection platform for image, video, and audio. It combines a three-model ensemble with temporal analysis to deliver confidence scores, visual explanations, and natural language summaries — all through a cloud-hosted web application.

> Built as a senior design project at Hofstra University — Spring 2026  
> Team: Leo Oliveira, Farris Hussain, Awab Abedin  
> Faculty Advisor: Dr. Sherwin Shen

---

## Features

- **Image Detection** — Three-model ensemble (Xception, ResNet, EfficientNet) produces a soft-vote average confidence score. Bounding boxes highlight suspected manipulation regions.
- **Video Detection** — EfficientNet-LSTM pipeline performs temporal analysis across frames. Per-frame anomaly scores are plotted over a video timeline.
- **Audio Detection** — CNN encoder classifier converts audio to mel spectrograms and extracts spectral and signal features to flag audio artifacts.
- **Confidence Score** — A single 0–100% AI likelihood rating derived from the ensemble output.
- **Text Summary** — A natural language explanation of each scan result, generated using Groq (LLaMA 3.1).
- **Scan History** — User accounts and past scan results stored via Firebase Firestore.

---

## Detection Pipeline

### Image
Frames are RGB-loaded, resized, and preprocessed (blur, color, edges) using Pillow, OpenCV, and NumPy. Three models — EfficientNet, Xception, and ResNet — each produce a prediction. Their outputs are averaged into a final ensemble score via PyTorch / TensorFlow.

### Video
Frames are decoded, extracted, and preprocessed for face detection. The EfficientNet-LSTM model analyzes the sequence temporally, producing per-frame scores that are rendered into a timeline visualization and stored via Firestore and Recharts.

### Audio
Audio is converted to mono, resampled, and trimmed to a fixed length using Librosa, PyTorch, and NumPy. A CNN encoder then converts it to a mel spectrogram, extracts spectral and signal features, and outputs a confidence score.

---

## Model Results

| Model    | Precision | Accuracy | F-1    | AUC-ROC |
|----------|-----------|----------|--------|---------|
| Ensemble | 95.23%    | 94.27%   | 92.54% | 95.77%  |
| Video    | 60.13%    | 58.96%   | 56.87% | N/A     |
| Audio    | 43.23%    | 41.34%   | 39.78% | 40.64%  |

---

## Tech Stack

**Frontend**
- Next.js (App Router) — routing, SSR, and build tooling
- React — component-based UI
- Firebase Authentication — user accounts
- Recharts — data visualization

**Backend**
- Python / FastAPI — high-performance REST API
- PyTorch / TensorFlow — model inference
- OpenCV, Pillow, NumPy — image and video preprocessing
- Librosa — audio preprocessing
- Groq (LLaMA 3.1) — natural language scan summaries

**Infrastructure**
- Google Cloud Platform (Cloud Run) — serverless deployment
- Docker — containerization
- Firebase Firestore — scan history and result storage
- GPU Inference Service — model weights loaded on demand

---

## System Architecture

User uploads flow through an API Gateway to a Backend Container running AI inference. Trained model weights are loaded from storage into the GPU Inference Service (PyTorch / TensorFlow). Results — including scores, metadata, and visualizations — are stored in Firebase Firestore and returned to the Next.js frontend.

```
Client (Web App)
    └── API Gateway (POST)
            ├── Backend Container → GPU Inference → Trained Model Storage
            └── Firebase (Auth + Firestore)
```

---

## Project Structure

```
DeepGuard/
├── frontend/          # Next.js web application
├── backend/           # FastAPI inference server
├── docs/              # Project documentation
├── docker-compose.yaml
└── cloudbuild.yaml    # GCP Cloud Build config
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker
- Firebase project with Authentication and Firestore enabled
- GCP project with Cloud Run enabled

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Docker (Full Stack)

```bash
docker-compose up --build
```

---

## Future Work

- Improve model accuracy for video and audio detection using larger, more diverse datasets
- Develop a browser extension for real-time deepfake detection while browsing
- Optimize for real-time inference and lower latency

---

## Acknowledgements

Special thanks to **Dr. Sherwin Shen** and **Dr. Simona Doboli** for their guidance and support throughout the development of this project.