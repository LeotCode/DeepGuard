import torch
from torch.utils.data import Dataset, DataLoader
import os
from main import DeepfakeImagePreprocessor, train_model
import argparse


class DeepfakeDataset(Dataset):
    """Custom Dataset for image-based deepfake detection.

    The preprocessor is intentionally NOT stored as a constructor argument.
    DataLoader workers pickle the Dataset object before spawning, and
    cv2.CascadeClassifier cannot be pickled. Instead, each worker creates its
    own DeepfakeImagePreprocessor on first use via lazy initialisation.
    """

    def __init__(self, image_paths, labels):
        self.image_paths = image_paths
        self.labels = labels
        self._preprocessor = None  # initialised lazily inside each worker

    def _get_preprocessor(self):
        """Return the worker-local preprocessor, creating it if needed."""
        if self._preprocessor is None:
            self._preprocessor = DeepfakeImagePreprocessor()
        return self._preprocessor

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        try:
            preprocessor = self._get_preprocessor()
            result = preprocessor.process_image(self.image_paths[idx])

            # Remove batch dimension from image tensor
            image_tensor = result['image_tensor'].squeeze(0)

            # Convert feature vector to tensor
            vision_features = torch.tensor(result['feature_vector'])

            label = self.labels[idx]

            return image_tensor, vision_features, label
        except Exception as e:
            print(f"Error processing {self.image_paths[idx]}: {e}")
            # Return zeros so the DataLoader doesn't crash
            image_tensor = torch.zeros(3, 224, 224)
            vision_features = torch.zeros(5)
            return image_tensor, vision_features, 0


def load_dataset_from_directory(dataset_dir, real_subdir='real', fake_subdir='fake'):
    """Walks a directory structure and returns lists of paths/labels."""
    image_paths = []
    labels = []

    real_dir = os.path.join(dataset_dir, real_subdir)
    if os.path.exists(real_dir):
        for filename in os.listdir(real_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_paths.append(os.path.join(real_dir, filename))
                labels.append(0)  # real
        print(f"Loaded {len([l for l in labels if l == 0])} real images")

    fake_dir = os.path.join(dataset_dir, fake_subdir)
    if os.path.exists(fake_dir):
        for filename in os.listdir(fake_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_paths.append(os.path.join(fake_dir, filename))
                labels.append(1)  # fake
        print(f"Loaded {len([l for l in labels if l == 1])} fake images")

    return image_paths, labels


def split_dataset(image_paths, labels, train_ratio=0.8):
    """Shuffle and split into training/validation sets."""
    import random

    indices = list(range(len(image_paths)))
    random.shuffle(indices)

    split_idx = int(len(indices) * train_ratio)
    train_indices = indices[:split_idx]
    val_indices = indices[split_idx:]

    train_paths = [image_paths[i] for i in train_indices]
    train_labels = [labels[i] for i in train_indices]
    val_paths = [image_paths[i] for i in val_indices]
    val_labels = [labels[i] for i in val_indices]

    return train_paths, train_labels, val_paths, val_labels


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train deepfake detection model on images")
    parser.add_argument("--dataset", type=str, required=True, help="Path to dataset directory")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--epochs", type=int, default=1, help="Number of training epochs")
    parser.add_argument("--lr", type=float, default=0.0001, help="Learning rate")
    parser.add_argument("--output", type=str, default="image_model.pth", help="Output model path")

    args = parser.parse_args()

    print("=" * 60)
    print("DEEPFAKE DETECTION MODEL TRAINING")
    print("=" * 60)
    print("Configuration:")
    for k, v in vars(args).items():
        print(f"  {k}: {v}")
    print("=" * 60)

    print("\n[1/4] Loading dataset...")
    image_paths, labels = load_dataset_from_directory(args.dataset)
    print(f"Total images: {len(image_paths)}")
    print(f"Real images: {sum(1 for l in labels if l == 0)}")
    print(f"Fake images: {sum(1 for l in labels if l == 1)}")

    print("\n[2/4] Splitting dataset...")
    train_paths, train_labels, val_paths, val_labels = split_dataset(
        image_paths, labels, train_ratio=0.8
    )
    print(f"Training set: {len(train_paths)} images")
    print(f"Validation set: {len(val_paths)} images")

    print("\n[3/4] Creating dataloaders...")
    train_dataset = DeepfakeDataset(train_paths, train_labels)
    val_dataset = DeepfakeDataset(val_paths, val_labels)

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=2,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=2,
    )

    print("\n[4/4] Training model...")
    print("=" * 60)
    model = train_model(
        train_data_loader=train_loader,
        val_data_loader=val_loader,
        num_epochs=args.epochs,
        learning_rate=args.lr,
        save_path=args.output,
    )

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE!")
    print(f"Model saved to: {args.output}")
    print("=" * 60)