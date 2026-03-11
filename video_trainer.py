import torch
from torch.utils.data import Dataset, DataLoader
import os
import argparse
from main import DeepfakeImagePreprocessor
import torch.nn as nn
import numpy as np
from main import VideoDeepfakeDetector

class VideoDataset(Dataset):
    """Custom Dataset for video-based deepfake detection."""

    def __init__(self, video_paths, labels, preprocessor, num_frames=10, target_size=(224, 224)):
        self.video_paths = video_paths
        self.labels = labels
        self.preprocessor = preprocessor
        self.num_frames = num_frames
        self.target_size = target_size

    def __len__(self):
        return len(self.video_paths)

    def __getitem__(self, idx):
        try:
            results = self.preprocessor.process_video(
                self.video_paths[idx],
                num_frames=self.num_frames,
                target_size=self.target_size,
            )

            # remove the batch dimension that process_video adds
            image_seq = results['image_tensor_seq'].squeeze(0)  # (seq, 3, H, W)
            vision_seq = results['feature_vector_seq'].squeeze(0)  # (seq, features)
            label = self.labels[idx]

            return image_seq, vision_seq, label
        except Exception as e:
            print(f"Error processing {self.video_paths[idx]}: {e}")
            # return a dummy sequence so dataloader doesn't blow up
            seq = torch.zeros(self.num_frames, 3, self.target_size[0], self.target_size[1])
            vision = torch.zeros(self.num_frames, 5)
            label = 0
            return seq, vision, label


def load_video_dataset_from_directory(dataset_dir, real_subdir='real', fake_subdir='fake'):
    """Walks a directory structure and returns lists of paths/labels."""

    video_paths = []
    labels = []

    real_dir = os.path.join(dataset_dir, real_subdir)
    if os.path.exists(real_dir):
        for filename in os.listdir(real_dir):
            if filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                video_paths.append(os.path.join(real_dir, filename))
                labels.append(0)  # real
        print(f"Loaded {len([l for l in labels if l == 0])} real videos")

    fake_dir = os.path.join(dataset_dir, fake_subdir)
    if os.path.exists(fake_dir):
        for filename in os.listdir(fake_dir):
            if filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                video_paths.append(os.path.join(fake_dir, filename))
                labels.append(1)  # fake
        print(f"Loaded {len([l for l in labels if l == 1])} fake videos")

    return video_paths, labels


def split_dataset(video_paths, labels, train_ratio=0.8):
    """Shuffle and split into training/validation sets."""
    import random

    indices = list(range(len(video_paths)))
    random.shuffle(indices)

    split_idx = int(len(indices) * train_ratio)
    train_indices = indices[:split_idx]
    val_indices = indices[split_idx:]

    train_paths = [video_paths[i] for i in train_indices]
    train_labels = [labels[i] for i in train_indices]
    val_paths = [video_paths[i] for i in val_indices]
    val_labels = [labels[i] for i in val_indices]

    return train_paths, train_labels, val_paths, val_labels

def train_video_model(train_loader, val_loader, num_epochs=5, learning_rate=1e-4, save_path="video_model.pth"):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = VideoDeepfakeDetector().to(device)

    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        for image_seqs, vision_seqs, labels in train_loader:
            image_seqs = image_seqs.to(device)
            vision_seqs = vision_seqs.to(device)
            labels = labels.float().unsqueeze(1).to(device)

            optimizer.zero_grad()
            outputs = model(image_seqs, vision_seqs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()

        model.eval()
        val_loss = 0.0
        correct = 0
        total = 0
        with torch.no_grad():
            for image_seqs, vision_seqs, labels in val_loader:
                image_seqs = image_seqs.to(device)
                vision_seqs = vision_seqs.to(device)
                labels = labels.float().unsqueeze(1).to(device)

                outputs = model(image_seqs, vision_seqs)
                val_loss += criterion(outputs, labels).item()
                predicted = (outputs > 0.5).float()
                correct += (predicted == labels).sum().item()
                total += labels.size(0)

        print(
            f"Epoch [{epoch+1}/{num_epochs}] "
            f"Train Loss: {train_loss/len(train_loader):.4f} | "
            f"Val Loss: {val_loss/len(val_loader):.4f} | "
            f"Val Acc: {100 * correct / total:.2f}%"
        )

    torch.save(model.state_dict(), save_path)
    print(f"Model saved to {save_path}")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train deepfake detection on video dataset")
    parser.add_argument("--dataset", type=str, required=True, help="Path to video dataset directory")
    parser.add_argument("--credentials", type=str, default="", help="Google Cloud credentials")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size for training (videos are heavy)")
    parser.add_argument("--epochs", type=int, default=1, help="Number of epochs")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--frames", type=int, default=10, help="Number of frames to sample per video")
    parser.add_argument("--output", type=str, default="video_model.pth", help="Path to save trained model")

    args = parser.parse_args()

    print("=" * 60)
    print("VIDEO DEEPFAKE DETECTION TRAINING")
    print("=" * 60)
    print("Configuration:")
    for k, v in vars(args).items():
        print(f"  {k}: {v}")
    print("=" * 60)

    preprocessor = DeepfakeImagePreprocessor(args.credentials)

    print("\n[1/4] Loading dataset...")
    video_paths, labels = load_video_dataset_from_directory(args.dataset)
    print(f"Total videos: {len(video_paths)}")
    print(f"Real: {sum(1 for l in labels if l == 0)}")
    print(f"Fake: {sum(1 for l in labels if l == 1)}")

    print("\n[2/4] Splitting dataset...")
    train_paths, train_labels, val_paths, val_labels = split_dataset(
        video_paths, labels, train_ratio=0.8
    )
    print(f"Training videos: {len(train_paths)}")
    print(f"Validation videos: {len(val_paths)}")

    print("\n[3/4] Creating dataloaders...")
    train_dataset = VideoDataset(train_paths, train_labels, preprocessor, num_frames=args.frames)
    val_dataset = VideoDataset(val_paths, val_labels, preprocessor, num_frames=args.frames)
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )

    print("\n[4/4] Training model...")
    model = train_video_model(
        train_loader,
        val_loader,
        num_epochs=args.epochs,
        learning_rate=args.lr,
        save_path=args.output,
    )

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print(f"Model saved to: {args.output}")
    print("=" * 60)
