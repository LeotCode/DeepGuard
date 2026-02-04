import cv2 # OpenCV
import torch # PyTorch
from facenet_pytorch import MTCNN

class FacePreprocessor:
    def __init__(self, device='cpu'):
        # MTCNN is a pre-trained face detector
        self.mtcnn = MTCNN(
            image_size=224, margin=20, 
            keep_all=False, select_largest=True, 
            device=device
        )

    def process_image(self, image_path):
        """
        Reads an image, detects the face, crops it, and returns a tensor.
        """
        # Load Image using OpenCV
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        # Convert BGR (OpenCV standard) to RGB (Model standard)
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Detect, Crop, and turn into Tensor
        # MTCNN does all this in one step
        # Returns a tensor of shape (3, 224, 224) normalized to [-1, 1] usually
        face_tensor = self.mtcnn(img_rgb)

        return face_tensor

if __name__ == "__main__":
    processor = FacePreprocessor()
    # Replace with your image
    tensor = processor.process_image("ManFace.jpeg")
    
    if tensor is not None:
        print(f"Success! Tensor shape: {tensor.shape}") # Should be torch.Size([3, 224, 224])
    else:
        print("No face detected.")