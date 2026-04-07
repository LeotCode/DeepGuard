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

class DeepfakeDetector(nn.Module):
 
    # Deepfake detection model using pre-trained EfficientNet.
 
    def __init__(self, num_vision_features=5, dropout_rate=0.3):
        super(DeepfakeDetector, self).__init__()
 
        self.efficientnet = models.efficientnet_b0(pretrained=True)
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
 
 
def train_model(train_data_loader, val_data_loader, num_epochs=10, learning_rate=0.0001, save_path="image_model.pth"):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = DeepfakeDetector().to(device)
 
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
 
    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        for image_tensors, vision_features, labels in train_data_loader:
            image_tensors = image_tensors.to(device)
            vision_features = vision_features.to(device)
            labels = labels.float().unsqueeze(1).to(device)
 
            optimizer.zero_grad()
            outputs = model(image_tensors, vision_features)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
 
        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        with torch.no_grad():
            for image_tensors, vision_features, labels in val_data_loader:
                image_tensors = image_tensors.to(device)
                vision_features = vision_features.to(device)
                labels = labels.float().unsqueeze(1).to(device)
 
                outputs = model(image_tensors, vision_features)
                val_loss += criterion(outputs, labels).item()
                predicted = (outputs > 0.5).float()
                correct += (predicted == labels).sum().item()
                total += labels.size(0)
 
        print(f"Epoch [{epoch+1}/{num_epochs}] "
              f"Train Loss: {train_loss/len(train_data_loader):.4f} | "
              f"Val Loss: {val_loss/len(val_data_loader):.4f} | "
              f"Val Accuracy: {100*correct/total:.2f}%")
 
    torch.save(model.state_dict(), save_path)
    print(f"Model saved to {save_path}")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deepfake detection using local OpenCV preprocessing")
    parser.add_argument("file_path", type=str, help="Path to the input file (image or video)")
    parser.add_argument("--model", type=str, default=None, help="Path to trained model weights")
    parser.add_argument("--threshold", type=float, default=0.5, help="Classification threshold (0-1)")
    parser.add_argument("--frames", type=int, default=10, help="Number of frames to sample if input is a video")
    args = parser.parse_args()
 
    mime_type, _ = mimetypes.guess_type(args.file_path)
    is_video = mime_type and mime_type.startswith('video')
 
    try:
        if is_video:
            print("\n🎥 Video file detected. Initialising LSTM Video Pipeline...")
            pipeline = VideoDeepfakeDetectionPipeline(model_path=args.model)
            result = pipeline.predict(args.file_path, threshold=args.threshold, num_frames=args.frames)
            print_type = "Video"
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
        if not is_video:
            print(f"Faces Detected: {result['num_faces_detected']}")
            print(f"Original Size: {result['original_size']}")
        else:
            print(f"Frames Analysed: {result['frames_analyzed']}")
        print("=" * 50)
 
        if result['is_deepfake']:
            print(f"\n⚠️  This {print_type.lower()} is likely a DEEPFAKE (confidence: {result['confidence_score']:.2%})")
        else:
            print(f"\n✓ This {print_type.lower()} appears to be REAL (confidence: {1 - result['confidence_score']:.2%})")
 
    except Exception as e:
        print(f"Error during detection: {e}")