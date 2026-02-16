import io
import numpy as np
import torchvision.transforms as transforms
from google.cloud import vision
from PIL import Image
import argparse


class DeepfakeImagePreprocessor:
    
    # Preprocesses images using Google Cloud Vision API and converts to tensors
    
    def __init__(self, credentials_path=""): # Provide path to credentials
        
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Preprocess an image for deepfake detection")  
    parser.add_argument("image_path", type=str, help="Path to the input image")
    args = parser.parse_args()
    
    preprocessor = DeepfakeImagePreprocessor()
    
    try:
        result = preprocessor.process_image(args.image_path)
        
        print(f"Image processed successfully!")
        print(f"Original size: {result['original_size']}")
        print(f"Tensor shape: {result['image_tensor'].shape}")
        print(f"Number of faces detected: {len(result['vision_features']['faces'])}")
        print(f"Feature vector shape: {result['feature_vector'].shape}")
        print(f"Feature vector: {result['feature_vector']}")
    except Exception as e:
        print(f"Error processing image: {e}")