import io
import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from PIL import Image
import argparse
from torchvision import models
import os
import mimetypes
import librosa
import librosa.feature
import soundfile as sf

class DeepfakeImagePreprocessor:
 
    # Preprocesses images using local OpenCV feature extraction and converts to tensors.
 
    def __init__(self):
        # Load OpenCV's built-in Haar cascade for face detection (no download required)
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        if self.face_cascade.empty():
            raise RuntimeError(f"Failed to load Haar cascade from {cascade_path}")
 
    def load_image(self, image_path):
        # Load image from file path
        pil_image = Image.open(image_path).convert('RGB')
        return pil_image
 
    def extract_local_features(self, pil_image):
        """Extract deepfake-relevant features locally using OpenCV.
 
        Produces a dict with 5 values that replace the former Vision API feature set:
          - num_faces       : number of faces detected
          - avg_face_area   : mean face bounding-box area as a fraction of the image
          - blur_score      : normalised Laplacian variance (low = blurry, common in fakes)
          - color_diversity : normalised per-channel std (captures colour inconsistencies)
          - edge_density    : fraction of edge pixels (reveals compression artefacts)
        """
        img_np = np.array(pil_image)                          # RGB uint8
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
 
        h, w = gray.shape
        image_area = float(h * w)
 
        # --- Face detection ---
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        num_faces = len(faces)
        if num_faces > 0:
            avg_face_area = float(np.mean([(fw * fh) / image_area for (_, _, fw, fh) in faces]))
        else:
            avg_face_area = 0.0
 
        # --- Blur score (Laplacian variance, clipped to [0, 1]) ---
        blur_score = float(min(cv2.Laplacian(gray, cv2.CV_64F).var() / 1000.0, 1.0))
 
        # --- Colour diversity (mean per-channel std, normalised) ---
        color_diversity = float(
            np.mean([img_bgr[:, :, c].std() for c in range(3)]) / 128.0
        )
 
        # --- Edge density (Canny, fraction of edge pixels) ---
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(edges.mean() / 255.0)
 
        return {
            'num_faces': num_faces,
            'avg_face_area': avg_face_area,
            'blur_score': blur_score,
            'color_diversity': color_diversity,
            'edge_density': edge_density,
        }
 
    def preprocess_image_to_tensor(self, pil_image, target_size=(224, 224), normalize=True):
        # Convert PIL Image to tensor format suitable for ML models
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
 
        transform_list = [
            transforms.Resize(target_size),
            transforms.ToTensor(),  # scales to [0, 1]
        ]
 
        if normalize:
            # Standard ImageNet normalisation (used by pretrained EfficientNet)
            transform_list.append(
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                     std=[0.229, 0.224, 0.225])
            )
 
        transform = transforms.Compose(transform_list)
        tensor = transform(pil_image).unsqueeze(0)  # (1, 3, H, W)
        return tensor
 
    def create_feature_vector(self, local_features):
        # Convert local OpenCV features into a fixed-length numerical vector
        feature_list = [
            local_features['num_faces'],
            local_features['avg_face_area'],
            local_features['blur_score'],
            local_features['color_diversity'],
            local_features['edge_density'],
        ]
        return np.array(feature_list, dtype=np.float32)
 
    def process_image(self, image_path, target_size=(224, 224)):
        # Complete pipeline: load image, extract local features, create tensor
        pil_image = self.load_image(image_path)
        local_features = self.extract_local_features(pil_image)
        image_tensor = self.preprocess_image_to_tensor(pil_image, target_size)
        feature_vector = self.create_feature_vector(local_features)
 
        return {
            'image_tensor': image_tensor,
            'local_features': local_features,
            'feature_vector': feature_vector,
            'original_size': pil_image.size,
        }
 
    def extract_frames(self, video_path, num_frames=10):
        # Extracts evenly spaced frames from a video using OpenCV
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
 
        if total_frames == 0:
            raise ValueError("Could not read video or video has no frames.")
 
        frame_indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
 
        frames = []
        for idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                frames.append(pil_image)
 
        cap.release()
        return frames
 
    def process_video(self, video_path, num_frames=10, target_size=(224, 224)):
        # Processes a video and returns sequences of tensors and features for the LSTM
        frames = self.extract_frames(video_path, num_frames)
 
        image_tensors = []
        feature_vectors = []
 
        for pil_image in frames:
            local_features = self.extract_local_features(pil_image)
            image_tensor = self.preprocess_image_to_tensor(pil_image, target_size)
            feature_vector = self.create_feature_vector(local_features)
 
            image_tensors.append(image_tensor)
            feature_vectors.append(torch.tensor(feature_vector))
 
        # (1, seq_len, 3, H, W)
        seq_image_tensors = torch.cat(image_tensors, dim=0).unsqueeze(0)
        # (1, seq_len, 5)
        seq_feature_vectors = torch.stack(feature_vectors, dim=0).unsqueeze(0)
 
        return {
            'image_tensor_seq': seq_image_tensors,
            'feature_vector_seq': seq_feature_vectors,
            'num_frames_processed': len(frames),
        }
    
class AudioPreprocessor:
    """Load audio clips, extract a mel spectrogram tensor and a fixed-length
    handcrafted feature vector suitable for the AudioDeepfakeDetector."""

    def __init__(
        self,
        sample_rate: int = 16_000,
        duration: float = 4.0,
        n_mels: int = 128,
        n_fft: int = 1024,
        hop_length: int = 512,
        n_mfcc: int = 13,
    ):
        self.sample_rate = sample_rate
        self.duration = duration
        self.n_mels = n_mels
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.n_mfcc = n_mfcc
        self.target_samples = int(sample_rate * duration)

    def load_audio(self, audio_path: str) -> np.ndarray:
        """Load an audio file and return a mono waveform at *self.sample_rate*."""
 
        try:
            waveform, sr = librosa.load(audio_path, sr=self.sample_rate, mono=True)
        except Exception:
            waveform, sr = sf.read(audio_path, always_2d=False)
            if waveform.ndim > 1:
                waveform = waveform.mean(axis=1)
            if sr != self.sample_rate:
                waveform = librosa.resample(waveform, orig_sr=sr, target_sr=self.sample_rate)
        return waveform.astype(np.float32)
    
    def _fix_length(self, waveform: np.ndarray) -> np.ndarray:
        """Ensure the waveform is exactly *self.target_samples* long."""

        n = len(waveform)
        if n >= self.target_samples:
            return waveform[: self.target_samples]
        # Pad with zeros (silence) on the right
        return np.pad(waveform, (0, self.target_samples - n), mode='constant')
    
    def waveform_to_mel_tensor(self, waveform: np.ndarray) -> torch.Tensor:
        """Convert a waveform to a normalised mel spectrogram tensor."""
 
        waveform = self._fix_length(waveform)
 
        mel_spec = librosa.feature.melspectrogram(
            y=waveform,
            sr=self.sample_rate,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            n_mels=self.n_mels,
        )
        # Convert to log scale (dB), then normalise to [0, 1]
        log_mel = librosa.power_to_db(mel_spec, ref=np.max)
        log_mel_norm = (log_mel - log_mel.min()) / (log_mel.max() - log_mel.min() + 1e-8)
 
        tensor = torch.tensor(log_mel_norm, dtype=torch.float32)
        tensor = tensor.unsqueeze(0).unsqueeze(0)  # (1, 1, n_mels, T)
        return tensor
    
    def extract_audio_features(self, waveform: np.ndarray) -> dict:
        """Extract 13 scalar features indicative of audio deepfakes."""
 
        waveform = self._fix_length(waveform)
        sr = self.sample_rate
 
        # MFCCs — collapse time axis to a single mean value
        mfccs = librosa.feature.mfcc(y=waveform, sr=sr, n_mfcc=self.n_mfcc)
        mfcc_mean = float(np.mean(mfccs))
 
        # Spectral features
        spec_centroid = librosa.feature.spectral_centroid(y=waveform, sr=sr)
        spectral_centroid_mean = float(np.mean(spec_centroid))
 
        spec_bandwidth = librosa.feature.spectral_bandwidth(y=waveform, sr=sr)
        spectral_bandwidth_mean = float(np.mean(spec_bandwidth))
 
        spec_rolloff = librosa.feature.spectral_rolloff(y=waveform, sr=sr)
        spectral_rolloff_mean = float(np.mean(spec_rolloff))
 
        # Zero crossing rate
        zcr = librosa.feature.zero_crossing_rate(waveform)
        zero_crossing_rate_mean = float(np.mean(zcr))
 
        # RMS energy
        rms = librosa.feature.rms(y=waveform)
        rms_energy_mean = float(np.mean(rms))
 
        # Tempo (scalar)
        tempo, _ = librosa.beat.beat_track(y=waveform, sr=sr)
        tempo_val = float(tempo) if np.isscalar(tempo) else float(tempo[0])
 
        # Fundamental frequency (pitch) via YIN
        f0 = librosa.yin(waveform, fmin=60, fmax=400, sr=sr)
        f0_voiced = f0[f0 > 0]
        pitch_mean = float(np.mean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
        pitch_std  = float(np.std(f0_voiced))  if len(f0_voiced) > 0 else 0.0
 
        # Harmonics-to-Noise Ratio (via harmonic/percussive separation)
        harmonic, percussive = librosa.effects.hpss(waveform)
        harmonic_rms   = float(np.sqrt(np.mean(harmonic ** 2)) + 1e-8)
        percussive_rms = float(np.sqrt(np.mean(percussive ** 2)) + 1e-8)
        harmonics_to_noise_ratio = float(10 * np.log10(harmonic_rms / percussive_rms))
 
        # Spectral flatness
        spec_flatness = librosa.feature.spectral_flatness(y=waveform)
        spectral_flatness_mean = float(np.mean(spec_flatness))
 
        # Chroma stability
        chroma = librosa.feature.chroma_stft(y=waveform, sr=sr)
        chroma_std_mean = float(np.mean(np.std(chroma, axis=1)))
 
        # Dynamic range (peak-to-RMS difference in dB)
        peak_db = float(20 * np.log10(np.max(np.abs(waveform)) + 1e-8))
        rms_db  = float(20 * np.log10(rms_energy_mean + 1e-8))
        dynamic_range = peak_db - rms_db
 
        return {
            'mfcc_mean':               mfcc_mean,
            'spectral_centroid_mean':  spectral_centroid_mean,
            'spectral_bandwidth_mean': spectral_bandwidth_mean,
            'spectral_rolloff_mean':   spectral_rolloff_mean,
            'zero_crossing_rate_mean': zero_crossing_rate_mean,
            'rms_energy_mean':         rms_energy_mean,
            'tempo':                   tempo_val,
            'pitch_mean':              pitch_mean,
            'pitch_std':               pitch_std,
            'harmonics_to_noise_ratio': harmonics_to_noise_ratio,
            'spectral_flatness_mean':  spectral_flatness_mean,
            'chroma_std_mean':         chroma_std_mean,
            'dynamic_range':           dynamic_range,
        }
    
    def create_feature_vector(self, audio_features: dict) -> np.ndarray:
        """Flatten the feature dict into a fixed-length float32 array."""

        feature_list = [
            audio_features['mfcc_mean'],
            audio_features['spectral_centroid_mean'],
            audio_features['spectral_bandwidth_mean'],
            audio_features['spectral_rolloff_mean'],
            audio_features['zero_crossing_rate_mean'],
            audio_features['rms_energy_mean'],
            audio_features['tempo'],
            audio_features['pitch_mean'],
            audio_features['pitch_std'],
            audio_features['harmonics_to_noise_ratio'],
            audio_features['spectral_flatness_mean'],
            audio_features['chroma_std_mean'],
            audio_features['dynamic_range'],
        ]
        return np.array(feature_list, dtype=np.float32)
    
    def process_audio(self, audio_path: str) -> dict:
        """End-to-end preprocessing for a single audio file."""
 
        waveform = self.load_audio(audio_path)
        actual_duration = len(waveform) / self.sample_rate
 
        mel_tensor = self.waveform_to_mel_tensor(waveform)
        audio_features = self.extract_audio_features(waveform)
        feature_vector = self.create_feature_vector(audio_features)
 
        return {
            'mel_tensor':     mel_tensor,
            'audio_features': audio_features,
            'feature_vector': feature_vector,
            'duration_s':     actual_duration,
            'sample_rate':    self.sample_rate,
        }
    
class _MelCNNEncoder(nn.Module):
    """Lightweight CNN that encodes a (1, n_mels, T) mel spectrogram into a
    fixed-length embedding.  Uses the same depthwise-separable-style block
    pattern as MobileNet so it stays fast on CPU.
    """
 
    def __init__(self, n_mels: int = 128, embed_dim: int = 256):
        super().__init__()
        self.encoder = nn.Sequential(
            # Block 1
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),          # (32, n_mels/2, T/2)
 
            # Block 2
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),          # (64, n_mels/4, T/4)
 
            # Block 3
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2),          # (128, n_mels/8, T/8)
 
            # Global average pool → (128,)
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
 
            nn.Linear(128, embed_dim),
            nn.ReLU(),
        )
 
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.encoder(x)

class DeepfakeDetector(nn.Module):
 
    # Deepfake detection model using pre-trained EfficientNet.
 
    def __init__(self, num_vision_features=5, dropout_rate=0.3):
        super(DeepfakeDetector, self).__init__()
 
        self.efficientnet = models.efficientnet_b5(pretrained=True)
        num_efficientnet_features = self.efficientnet.classifier[1].in_features
        self.efficientnet.classifier = nn.Identity()
 
        self.fusion_layer = nn.Sequential(
            nn.Linear(num_efficientnet_features + num_vision_features, 512),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )
 
    def forward(self, image_tensor, vision_feature_vector):
        image_features = self.efficientnet(image_tensor)
        combined_features = torch.cat([image_features, vision_feature_vector], dim=1)
        confidence = self.fusion_layer(combined_features)
        return confidence

class VideoDeepfakeDetector(nn.Module):
    """Sequence model that fuses frame-level EfficientNet features with local OpenCV
    features and passes them through an LSTM before making a binary prediction."""
 
    def __init__(self, num_vision_features=5, dropout_rate=0.3, lstm_hidden=256, lstm_layers=1):
        super(VideoDeepfakeDetector, self).__init__()
 
        self.efficientnet = torch.hub.load('pytorch/vision:v0.16.1', 'efficientnet_b0', pretrained=True)
        num_eff_features = self.efficientnet.classifier[1].in_features
        self.efficientnet.classifier = nn.Identity()
 
        self.lstm = nn.LSTM(
            input_size=num_eff_features + num_vision_features,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
        )
 
        self.classifier = nn.Sequential(
            nn.Linear(lstm_hidden, 128),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )
 
    def forward(self, image_seq, vision_seq):
        # image_seq: (batch, seq, 3, H, W)
        # vision_seq: (batch, seq, features)
        b, s, c, h, w = image_seq.shape
        x = image_seq.view(b * s, c, h, w)
        feats = self.efficientnet(x)        # (b*s, eff_feat)
        feats = feats.view(b, s, -1)
        combined = torch.cat([feats, vision_seq], dim=2)
        lstm_out, (hn, cn) = self.lstm(combined)
        last_hidden = hn[-1]                # (batch, hidden)
        out = self.classifier(last_hidden)
        return out
    
class AudioDeepfakeDetector(nn.Module):
    """Binary classifier that fuses a CNN-encoded mel spectrogram with a
    handcrafted audio feature vector.
 
    Parameters
    ----------
    n_mels : int
        Mel bands — must match AudioPreprocessor.n_mels.
    num_audio_features : int
        Length of the handcrafted feature vector (default 13).
    cnn_embed_dim : int
        Output dimensionality of the CNN encoder.
    dropout_rate : float
        Dropout probability in the fusion MLP.
    """
 
    def __init__(
        self,
        n_mels: int = 128,
        num_audio_features: int = 13,
        cnn_embed_dim: int = 256,
        dropout_rate: float = 0.3,
    ):
        super().__init__()
 
        self.cnn_encoder = _MelCNNEncoder(n_mels=n_mels, embed_dim=cnn_embed_dim)
 
        self.fusion_layer = nn.Sequential(
            nn.Linear(cnn_embed_dim + num_audio_features, 256),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )
 
    def forward(
        self,
        mel_tensor: torch.Tensor,        # (batch, 1, n_mels, T)
        audio_feature_vector: torch.Tensor,  # (batch, num_audio_features)
    ) -> torch.Tensor:
        cnn_features = self.cnn_encoder(mel_tensor)               # (batch, embed_dim)
        combined = torch.cat([cnn_features, audio_feature_vector], dim=1)
        return self.fusion_layer(combined) 

class DeepfakeDetectionPipeline:
 
    # Complete pipeline for image deepfake detection.
 
    def __init__(self, model_path=None, device=None):
        self.preprocessor = DeepfakeImagePreprocessor()
 
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = device
 
        self.model = DeepfakeDetector()
 
        if model_path:
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            print(f"Loaded model weights from {model_path}")
        else:
            print("Warning: No model weights provided. Using randomly initialised weights.")
            print("For production use, train the model on a deepfake dataset first.")
 
        self.model.to(self.device)
        self.model.eval()
 
    def predict(self, image_path, threshold=0.5):
        preprocessed = self.preprocessor.process_image(image_path)
 
        image_tensor = preprocessed['image_tensor'].to(self.device)
        feature_vector = torch.tensor(preprocessed['feature_vector']).unsqueeze(0).to(self.device)
 
        with torch.no_grad():
            confidence = self.model(image_tensor, feature_vector)
            confidence_score = confidence.item()
 
        is_deepfake = confidence_score > threshold
 
        return {
            'confidence_score': confidence_score,
            'is_deepfake': is_deepfake,
            'classification': 'DEEPFAKE' if is_deepfake else 'REAL',
            'threshold': threshold,
            'num_faces_detected': preprocessed['local_features']['num_faces'],
            'original_size': preprocessed['original_size'],
        }

class VideoDeepfakeDetectionPipeline:
    """Pipeline for running inference on video files."""
 
    def __init__(self, model_path=None, device=None):
        self.preprocessor = DeepfakeImagePreprocessor()
 
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = device
 
        self.model = VideoDeepfakeDetector()
 
        if model_path:
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            print(f"Loaded video model weights from {model_path}")
        else:
            print("Warning: No video model weights provided. Using randomly initialised weights.")
 
        self.model.to(self.device)
        self.model.eval()
 
    def predict(self, video_path, threshold=0.5, num_frames=10):
        processed = self.preprocessor.process_video(video_path, num_frames=num_frames)
        image_seq = processed['image_tensor_seq'].to(self.device)
        vision_seq = processed['feature_vector_seq'].to(self.device)
 
        with torch.no_grad():
            confidence = self.model(image_seq, vision_seq)
            confidence_score = confidence.item()
 
        is_deepfake = confidence_score > threshold
        return {
            'confidence_score': confidence_score,
            'is_deepfake': is_deepfake,
            'classification': 'DEEPFAKE' if is_deepfake else 'REAL',
            'threshold': threshold,
            'frames_analyzed': processed['num_frames_processed'],
        }
    
class AudioDeepfakeDetectionPipeline:
    """End-to-end pipeline for audio deepfake inference.
 
    Usage
    -----
    >>> pipeline = AudioDeepfakeDetectionPipeline(model_path="audio_model.pth")
    >>> result   = pipeline.predict("suspect_clip.wav")
    >>> print(result['classification'], result['confidence_score'])
    """
 
    def __init__(self, model_path: str | None = None, device=None):
        self.preprocessor = AudioPreprocessor()
 
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = device
 
        self.model = AudioDeepfakeDetector()
 
        if model_path:
            self.model.load_state_dict(
                torch.load(model_path, map_location=self.device)
            )
            print(f"Loaded audio model weights from {model_path}")
        else:
            print("Warning: No audio model weights provided. Using randomly initialised weights.")
            print("For production use, train the model on an audio deepfake dataset first.")
 
        self.model.to(self.device)
        self.model.eval()
 
    def predict(self, audio_path: str, threshold: float = 0.5) -> dict:
        """Run inference on a single audio file.
 
        Parameters
        ----------
        audio_path : str
            Path to any audio format supported by librosa / soundfile.
        threshold : float
            Confidence score above which the clip is classified as a deepfake.
 
        Returns
        -------
        dict with keys:
            confidence_score  – float in [0, 1]
            is_deepfake       – bool
            classification    – 'DEEPFAKE' or 'REAL'
            threshold         – value used for classification
            duration_s        – original clip length in seconds
            sample_rate       – sample rate used during preprocessing
            audio_features    – raw handcrafted feature dict
        """
        preprocessed = self.preprocessor.process_audio(audio_path)
 
        mel_tensor = preprocessed['mel_tensor'].to(self.device)
        feature_vector = (
            torch.tensor(preprocessed['feature_vector'])
            .unsqueeze(0)
            .to(self.device)
        )
 
        with torch.no_grad():
            confidence = self.model(mel_tensor, feature_vector)
            confidence_score = confidence.item()
 
        is_deepfake = confidence_score > threshold
 
        return {
            'confidence_score': confidence_score,
            'is_deepfake':      is_deepfake,
            'classification':   'DEEPFAKE' if is_deepfake else 'REAL',
            'threshold':        threshold,
            'duration_s':       preprocessed['duration_s'],
            'sample_rate':      preprocessed['sample_rate'],
            'audio_features':   preprocessed['audio_features'],
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deepfake detection using local OpenCV / librosa preprocessing")
    parser.add_argument("file_path", type=str, help="Path to the input file (image, video, or audio)")
    parser.add_argument("--model", type=str, default=None, help="Path to trained model weights")
    parser.add_argument("--threshold", type=float, default=0.5, help="Classification threshold (0-1)")
    parser.add_argument("--frames", type=int, default=10, help="Frames to sample if input is a video")
    args = parser.parse_args()
 
    mime_type, _ = mimetypes.guess_type(args.file_path)
    is_video = mime_type and mime_type.startswith('video')
    is_audio = mime_type and mime_type.startswith('audio')
 
    try:
        if is_video:
            print("\n🎥 Video file detected. Initialising LSTM Video Pipeline...")
            pipeline = VideoDeepfakeDetectionPipeline(model_path=args.model)
            result = pipeline.predict(args.file_path, threshold=args.threshold, num_frames=args.frames)
            print_type = "Video"
        elif is_audio:
            print("\n🔊 Audio file detected. Initialising Audio Pipeline...")
            pipeline   = AudioDeepfakeDetectionPipeline(model_path=args.model)
            result     = pipeline.predict(args.file_path, threshold=args.threshold)
            print_type = "Audio"
        else:
            print("\n🖼️ Image file detected. Initialising Image Pipeline...")
            pipeline = DeepfakeDetectionPipeline(model_path=args.model)
            result = pipeline.predict(args.file_path, threshold=args.threshold)
            print_type = "Image"
 
        print("\n" + "=" * 50)
        print("DEEPFAKE DETECTION RESULTS")
        print("=" * 50)
        print(f"File: {args.file_path} ({print_type})")
        print(f"Classification: {result['classification']}")
        print(f"Confidence Score: {result['confidence_score']:.4f}")
        
        if is_video:
            print(f"Frames Analysed:  {result['frames_analyzed']}")
        elif is_audio:
            print(f"Duration:         {result['duration_s']:.2f}s")
            print(f"Sample Rate:      {result['sample_rate']} Hz")
        else:
            print(f"Faces Detected:   {result['num_faces_detected']}")
            print(f"Original Size:    {result['original_size']}")
        print("=" * 50)
 
        if result['is_deepfake']:
            print(f"\n⚠️  This {print_type.lower()} is likely a DEEPFAKE (confidence: {result['confidence_score']:.2%})")
        else:
            print(f"\n✓ This {print_type.lower()} appears to be REAL (confidence: {1 - result['confidence_score']:.2%})")
 
    except Exception as e:
        print(f"Error during detection: {e}")