import torch
from torch.utils.data import Dataset, DataLoader
import os
from feature_extractor import DeepfakeImagePreprocessor, train_model
import json
from dotenv import load_dotenv
load_dotenv()
google_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
dataset_dir = os.getenv("DATASET_DIR")

class DeepfakeDataset(Dataset):
    
    # Custom Dataset for deepfake detection
    
    def __init__(self, image_paths, labels, preprocessor):
        self.image_paths = image_paths
        self.labels = labels
        self.preprocessor = preprocessor
    
    def __len__(self):
        return len(self.image_paths)
    
    def __getitem__(self, idx):
        try:
            # Process image
            result = self.preprocessor.process_image(self.image_paths[idx])
            
            # Remove batch dimension from image tensor
            image_tensor = result['image_tensor'].squeeze(0)
            
            # Convert feature vector to tensor
            vision_features = torch.tensor(result['feature_vector'])
            
            # Get label
            label = self.labels[idx]
            
            return image_tensor, vision_features, label
        except Exception as e:
            print(f"Error processing {self.image_paths[idx]}: {e}")
            # Return dummy data in case of error
            image_tensor = torch.zeros(3, 224, 224)
            vision_features = torch.zeros(5)
            label = 0
            return image_tensor, vision_features, label


def load_dataset_from_directory(dataset_dir, real_subdir='real', fake_subdir='fake'):
    
    # Load image paths and labels from directory structure
    
    image_paths = []
    labels = []
    
    # Load real images
    real_dir = os.path.join(dataset_dir, real_subdir)
    if os.path.exists(real_dir):
        for filename in os.listdir(real_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_paths.append(os.path.join(real_dir, filename))
                labels.append(0)  # Real = 0
        print(f"Loaded {len([l for l in labels if l == 0])} real images")
    
    # Load fake images
    fake_dir = os.path.join(dataset_dir, fake_subdir)
    if os.path.exists(fake_dir):
        for filename in os.listdir(fake_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_paths.append(os.path.join(fake_dir, filename))
                labels.append(1)  # Fake = 1
        print(f"Loaded {len([l for l in labels if l == 1])} fake images")
    
    return image_paths, labels


def split_dataset(image_paths, labels, train_ratio=0.8):
    
    # Split dataset into train and validation sets
    
    import random
    
    # Create indices and shuffle
    indices = list(range(len(image_paths)))
    random.shuffle(indices)
    
    # Split indices
    split_idx = int(len(indices) * train_ratio)
    train_indices = indices[:split_idx]
    val_indices = indices[split_idx:]
    
    # Create train and val sets
    train_paths = [image_paths[i] for i in train_indices]
    train_labels = [labels[i] for i in train_indices]
    val_paths = [image_paths[i] for i in val_indices]
    val_labels = [labels[i] for i in val_indices]
    
    return train_paths, train_labels, val_paths, val_labels


def main():
    # Configuration
    CONFIG = {
        'dataset_dir': dataset_dir,  # CHANGE THIS
        'credentials_path': google_credentials_path,  # CHANGE THIS
        'batch_size': 16,
        'num_epochs': 1,
        'learning_rate': 0.0001,
        'train_ratio': 0.8,
        'save_path': 'deepfake_model.pth'
    }
    
    print("="*60)
    print("DEEPFAKE DETECTION MODEL TRAINING")
    print("="*60)
    print(f"Configuration:")
    for key, value in CONFIG.items():
        print(f"  {key}: {value}")
    print("="*60)
    
    # Initialize preprocessor
    print("\n[1/5] Initializing preprocessor...")
    preprocessor = DeepfakeImagePreprocessor(CONFIG['credentials_path'])
    
    # Load dataset
    print("\n[2/5] Loading dataset...")
    image_paths, labels = load_dataset_from_directory(CONFIG['dataset_dir'])
    print(f"Total images: {len(image_paths)}")
    print(f"Real images: {sum(1 for l in labels if l == 0)}")
    print(f"Fake images: {sum(1 for l in labels if l == 1)}")
    
    # Split dataset
    print("\n[3/5] Splitting dataset...")
    train_paths, train_labels, val_paths, val_labels = split_dataset(
        image_paths, labels, CONFIG['train_ratio']
    )
    print(f"Training set: {len(train_paths)} images")
    print(f"Validation set: {len(val_paths)} images")
    
    # Create datasets and dataloaders
    print("\n[4/5] Creating dataloaders...")
    train_dataset = DeepfakeDataset(train_paths, train_labels, preprocessor)
    val_dataset = DeepfakeDataset(val_paths, val_labels, preprocessor)
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=CONFIG['batch_size'],
        shuffle=True,
        num_workers=0  # Set to 0 to avoid multiprocessing issues with Vision API
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=CONFIG['batch_size'],
        shuffle=False,
        num_workers=0
    )
    
    # Train model
    print("\n[5/5] Training model...")
    print("="*60)
    model = train_model(
        train_data_loader=train_loader,
        val_data_loader=val_loader,
        num_epochs=CONFIG['num_epochs'],
        learning_rate=CONFIG['learning_rate'],
        save_path=CONFIG['save_path']
    )
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE!")
    print(f"Model saved to: {CONFIG['save_path']}")
    print("="*60)


if __name__ == "__main__":
    # Example usage with custom parameters
    import argparse
    
    parser = argparse.ArgumentParser(description="Train deepfake detection model")
    parser.add_argument("--dataset", type=str, required=True, help="Path to dataset directory")
    parser.add_argument("--credentials", type=str, default="credentials.json", help="Path to Google Cloud credentials")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--epochs", type=int, default=1, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=0.0001, help="Learning rate")
    parser.add_argument("--output", type=str, default="deepfake_model.pth", help="Output model path")
    
    args = parser.parse_args()
    
    # Update config with command line arguments
    CONFIG = {
        'dataset_dir': args.dataset,
        'credentials_path': args.credentials,
        'batch_size': args.batch_size,
        'num_epochs': args.epochs,
        'learning_rate': args.lr,
        'train_ratio': 0.8,
        'save_path': args.output
    }
    
    print("="*60)
    print("DEEPFAKE DETECTION MODEL TRAINING")
    print("="*60)
    print(f"Configuration:")
    for key, value in CONFIG.items():
        print(f"  {key}: {value}")
    print("="*60)
    
    # Initialize preprocessor
    print("\n[1/5] Initializing preprocessor...")
    preprocessor = DeepfakeImagePreprocessor(CONFIG['credentials_path'])
    
    # Load dataset
    print("\n[2/5] Loading dataset...")
    image_paths, labels = load_dataset_from_directory(CONFIG['dataset_dir'])
    print(f"Total images: {len(image_paths)}")
    print(f"Real images: {sum(1 for l in labels if l == 0)}")
    print(f"Fake images: {sum(1 for l in labels if l == 1)}")
    
    # Split dataset
    print("\n[3/5] Splitting dataset...")
    train_paths, train_labels, val_paths, val_labels = split_dataset(
        image_paths, labels, CONFIG['train_ratio']
    )
    print(f"Training set: {len(train_paths)} images")
    print(f"Validation set: {len(val_paths)} images")
    
    # Create datasets and dataloaders
    print("\n[4/5] Creating dataloaders...")
    train_dataset = DeepfakeDataset(train_paths, train_labels, preprocessor)
    val_dataset = DeepfakeDataset(val_paths, val_labels, preprocessor)
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=CONFIG['batch_size'],
        shuffle=True,
        num_workers=0
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=CONFIG['batch_size'],
        shuffle=False,
        num_workers=0
    )
    
    # Train model
    print("\n[5/5] Training model...")
    print("="*60)
    model = train_model(
        train_data_loader=train_loader,
        val_data_loader=val_loader,
        num_epochs=CONFIG['num_epochs'],
        learning_rate=CONFIG['learning_rate'],
        save_path=CONFIG['save_path']
    )
    
    print("\n" + "="*60)
    print("TRAINING COMPLETE!")
    print(f"Model saved to: {CONFIG['save_path']}")
    print("="*60)