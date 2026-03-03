import io
import cv2
import numpy as np
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from google.cloud import vision
from PIL import Image
import argparse
from torchvision import models
import os
import mimetypes
#from video_trainer import VideoDeepfakeDetectionPipeline
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

class DeepfakeImagePreprocessor:
    
    # Preprocesses images using Google Cloud Vision API and converts to tensors
    
    def __init__(self, credentials_path=GOOGLE_APPLICATION_CREDENTIALS): # Provide path to credentials
        
        if credentials_path:
            self.client = vision.ImageAnnotatorClient.from_service_account_file(
                credentials_path
            )
        else:
            # Uses default credentials from environment
            self.client = vision.ImageAnnotatorClient()
    
    def load_image(self, image_path):
       
       # Load image from file path
        with io.open(image_path, 'rb') as image_file:
            content = image_file.read()
        
        pil_image = Image.open(image_path)
        return pil_image, content
    
    def extract_vision_features(self, image_content):
        
        # Use Google Cloud Vision API to extract features from the image
        
        image = vision.Image(content=image_content)
        
        # Extract multiple features that could help detect deepfakes
        features = {}
        
        # Face detection - important for facial deepfakes
        face_response = self.client.face_detection(image=image)
        faces = face_response.face_annotations
        features['faces'] = []
        
        for face in faces:
            face_data = {
                'detection_confidence': face.detection_confidence,
                'joy_likelihood': face.joy_likelihood,
                'sorrow_likelihood': face.sorrow_likelihood,
                'anger_likelihood': face.anger_likelihood,
                'surprise_likelihood': face.surprise_likelihood,
                'under_exposed_likelihood': face.under_exposed_likelihood,
                'blurred_likelihood': face.blurred_likelihood,
                'headwear_likelihood': face.headwear_likelihood,
                'landmarks': len(face.landmarks),
                'bounding_poly_vertices': len(face.bounding_poly.vertices)
            }
            features['faces'].append(face_data)
        
        # Image properties - can help detect artifacts
        properties_response = self.client.image_properties(image=image)
        props = properties_response.image_properties_annotation
        features['dominant_colors'] = len(props.dominant_colors.colors) if props.dominant_colors else 0
        
        # Safe search detection - sometimes deepfakes violate content policies
        safe_search_response = self.client.safe_search_detection(image=image)
        safe = safe_search_response.safe_search_annotation
        features['safe_search'] = {
            'adult': safe.adult,
            'spoof': safe.spoof,
            'medical': safe.medical,
            'violence': safe.violence,
            'racy': safe.racy
        }
        
        return features
    
    def preprocess_image_to_tensor(self, pil_image, target_size=(224, 224), normalize=True):
        
        # Convert PIL Image to tensor format suitable for ML models
        
        # Convert to RGB if not already
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        # Define transformation pipeline
        transform_list = [
            transforms.Resize(target_size),
            transforms.ToTensor(),  # Converts to tensor and scales to [0, 1]
        ]
        
        if normalize:
            # Standard ImageNet normalization (commonly used in pretrained models)
            transform_list.append(
                transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                   std=[0.229, 0.224, 0.225])
            )
        
        transform = transforms.Compose(transform_list)
        
        # Apply transformations and add batch dimension
        tensor = transform(pil_image)
        tensor = tensor.unsqueeze(0)  # Shape: (1, 3, height, width)
        
        return tensor
    
    def create_feature_vector(self, vision_features):
        
        # Convert Vision API features to a numerical feature vector
        
        feature_list = []
        
        # Number of faces detected
        feature_list.append(len(vision_features['faces']))
        
        # Average face detection confidence
        if vision_features['faces']:
            avg_confidence = np.mean([f['detection_confidence'] for f in vision_features['faces']])
            feature_list.append(avg_confidence)
            
            # Average number of landmarks (can indicate face quality)
            avg_landmarks = np.mean([f['landmarks'] for f in vision_features['faces']])
            feature_list.append(avg_landmarks)
        else:
            feature_list.extend([0.0, 0.0])
        
        # Color diversity
        feature_list.append(vision_features['dominant_colors'])
        
        # Spoof likelihood
        spoof_value = vision_features['safe_search']['spoof']
        feature_list.append(float(spoof_value))
        
        return np.array(feature_list, dtype=np.float32)
    
    def process_image(self, image_path, target_size=(224, 224)):
        
        # Complete pipeline: load image, extract features, create tensor
        
        # Load image
        pil_image, image_content = self.load_image(image_path)
        
        # Extract Vision API features
        vision_features = self.extract_vision_features(image_content)
        
        # Convert image to tensor
        image_tensor = self.preprocess_image_to_tensor(pil_image, target_size)
        
        # Create feature vector from Vision API results
        feature_vector = self.create_feature_vector(vision_features)
        
        return {
            'image_tensor': image_tensor,
            'vision_features': vision_features,
            'feature_vector': feature_vector,
            'original_size': pil_image.size
        }

    def extract_frames(self, video_path, num_frames=10):
        # Extracts evenly spaced frames from a video
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if total_frames == 0:
            raise ValueError("Could not read video or video has no frames.")
            
        # Calculate indices for evenly spaced frames
        frame_indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
        
        frames = []
        for idx in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                # Convert BGR (OpenCV) to RGB (PIL)
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                
                # Convert PIL back to raw bytes for Google Vision API
                img_byte_arr = io.BytesIO()
                pil_image.save(img_byte_arr, format='JPEG')
                img_bytes = img_byte_arr.getvalue()
                
                frames.append((pil_image, img_bytes))
        
        cap.release()
        return frames

    def process_video(self, video_path, num_frames=10, target_size=(224, 224)):
        # Processes a video and returns sequences of tensors and features for the LSTM
        frames = self.extract_frames(video_path, num_frames)
        
        image_tensors = []
        feature_vectors = []
        
        print(f"Processing {len(frames)} frames through Vision API (Watch your API quota!)...")
        for pil_image, img_bytes in frames:
            # Extract features and process exactly like a single image
            vision_features = self.extract_vision_features(img_bytes)
            image_tensor = self.preprocess_image_to_tensor(pil_image, target_size)
            feature_vector = self.create_feature_vector(vision_features)
            
            image_tensors.append(image_tensor)
            feature_vectors.append(torch.tensor(feature_vector))
            
        # Concatenate lists into sequential tensors for the LSTM
        # Shape becomes: (Batch=1, Seq_Len=10, Channels=3, H=224, W=224)
        seq_image_tensors = torch.cat(image_tensors, dim=0).unsqueeze(0) 
        
        # Shape becomes: (Batch=1, Seq_Len=10, Features=5)
        seq_feature_vectors = torch.stack(feature_vectors, dim=0).unsqueeze(0)
        
        return {
            'image_tensor_seq': seq_image_tensors,
            'feature_vector_seq': seq_feature_vectors,
            'num_frames_processed': len(frames)
        }

class DeepfakeDetector(nn.Module):
    
    # Deepfake detection model using pre-trained EfficientNet.
    
    def __init__(self, num_vision_features=5, dropout_rate=0.3):
        super(DeepfakeDetector, self).__init__()
        
        # Load pre-trained EfficientNet-B0
        self.efficientnet = models.efficientnet_b0(pretrained=True)
        
        # Get the number of features from the classifier
        num_efficientnet_features = self.efficientnet.classifier[1].in_features
        
        # Replace the classifier to output features instead of classes
        self.efficientnet.classifier = nn.Identity()
        
        # Fusion layer to combine EfficientNet features with Vision API features
        self.fusion_layer = nn.Sequential(
            nn.Linear(num_efficientnet_features + num_vision_features, 512),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(256, 1),  # Binary classification: real (0) or fake (1)
            nn.Sigmoid()  # Output confidence score between 0 and 1
        )
    
    def forward(self, image_tensor, vision_feature_vector):
        
        # Forward pass through the network
        
        # Extract features from image using EfficientNet
        image_features = self.efficientnet(image_tensor)
        
        # Concatenate image features with Vision API features
        combined_features = torch.cat([image_features, vision_feature_vector], dim=1)
        
        # Pass through fusion layer to get final confidence score
        confidence = self.fusion_layer(combined_features)
        
        return confidence


class DeepfakeDetectionPipeline:
    
    # Complete pipeline for deepfake detection that combines preprocessing and model inference
    
    def __init__(self, credentials_path="", model_path=None, device=None):
        
        # Initialize the detection pipeline
        
        self.preprocessor = DeepfakeImagePreprocessor(credentials_path)
        
        # Set device
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = device
        
        # Initialize model
        self.model = DeepfakeDetector()
        
        # Load trained weights if provided
        if model_path:
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            print(f"Loaded model weights from {model_path}")
        else:
            print("Warning: No model weights provided. Using randomly initialized weights.")
            print("For production use, you should train the model on a deepfake dataset.")
        
        self.model.to(self.device)
        self.model.eval()  # Set to evaluation mode
    
    def predict(self, image_path, threshold=0.5):
        
        # Predict whether an image is a deepfake
        
        # Preprocess image
        preprocessed = self.preprocessor.process_image(image_path)
        
        # Convert to tensors and move to device
        image_tensor = preprocessed['image_tensor'].to(self.device)
        feature_vector = torch.tensor(preprocessed['feature_vector']).unsqueeze(0).to(self.device)
        
        # Run inference
        with torch.no_grad():
            confidence = self.model(image_tensor, feature_vector)
            confidence_score = confidence.item()
        
        # Determine classification
        is_deepfake = confidence_score > threshold
        
        return {
            'confidence_score': confidence_score,
            'is_deepfake': is_deepfake,
            'classification': 'DEEPFAKE' if is_deepfake else 'REAL',
            'threshold': threshold,
            'num_faces_detected': len(preprocessed['vision_features']['faces']),
            'original_size': preprocessed['original_size']
        }
    
def train_model(train_data_loader, val_data_loader, num_epochs=10, learning_rate=0.0001, save_path="deepfake_model.pth"):
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = DeepfakeDetector().to(device)
    
        criterion = nn.BCELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    
        for epoch in range(num_epochs):
            # --- Training phase ---
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
        
            # --- Validation phase ---
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
    parser = argparse.ArgumentParser(description="Deepfake detection using pre-trained model")  
    parser.add_argument("file_path", type=str, help="Path to the input image")
    parser.add_argument("--credentials", type=str, default="", help="Path to Google Cloud credentials")
    parser.add_argument("--model", type=str, default=None, help="Path to trained model weights")
    parser.add_argument("--threshold", type=float, default=0.5, help="Classification threshold (0-1)")
    args = parser.parse_args()
    
    # Check if the file is an image or a video
    mime_type, _ = mimetypes.guess_type(args.file_path)
    is_video = mime_type and mime_type.startswith('video')
    
    try:
        if is_video:
            print("\n🎥 Video file detected. Initializing LSTM Video Pipeline...")
            pipeline = VideoDeepfakeDetectionPipeline(
                credentials_path=args.credentials,
                model_path=args.video_model
            )
            result = pipeline.predict(args.file_path, threshold=args.threshold, num_frames=args.frames)
            print_type = "Video"
        else:
            print("\n🖼️ Image file detected. Initializing Image Pipeline...")
            pipeline = DeepfakeDetectionPipeline(
                credentials_path=args.credentials,
                model_path=args.model
            )
            result = pipeline.predict(args.file_path, threshold=args.threshold)
            print_type = "Image"
            
        print("\n" + "="*50)
        print("DEEPFAKE DETECTION RESULTS")
        print("="*50)
        print(f"File: {args.file_path} ({print_type})")
        print(f"Classification: {result['classification']}")
        print(f"Confidence Score: {result['confidence_score']:.4f}")
        print(f"Faces Detected: {result['num_faces_detected']}")
        print(f"Original Size: {result['original_size']}")
        
        if is_video:
            print(f"Frames Analyzed: {result['frames_analyzed']}")
            
        print("="*50)
        
        if result['is_deepfake']:
            print(f"\n⚠️  This {print_type.lower()} is likely a DEEPFAKE (confidence: {result['confidence_score']:.2%})")
        else:
            print(f"\n✓ This {print_type.lower()} appears to be REAL (confidence: {1-result['confidence_score']:.2%})")
            
    except Exception as e:
        print(f"Error during detection: {e}")