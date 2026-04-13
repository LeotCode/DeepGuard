import torch
from torch.utils.data import Dataset, DataLoader
import os
import argparse
from main import AudioPreprocessor
import torch.nn as nn
from main import AudioDeepfakeDetector

class AudioDeepfakeDataset(Dataset):
    """Custom Dataset for audio-based deepfake detection."""

    SUPPORTED_EXTENSIONS = ('.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac')

    def __init__(self, audio_paths: list[str], labels: list[int]):
        self.audio_paths = audio_paths
        self.labels = labels
        self._preprocessor = None  # lazy-init per DataLoader worker

    def _get_preprocessor(self) -> "AudioPreprocessor":
        if self._preprocessor is None:
            self._preprocessor = AudioPreprocessor()
        return self._preprocessor

    def __len__(self) -> int:
        return len(self.audio_paths)

    def __getitem__(self, idx: int):
        try:
            preprocessor = self._get_preprocessor()
            result = preprocessor.process_audio(self.audio_paths[idx])

            # mel_tensor: (1, n_mels, time_frames) → squeeze batch dim → (1, n_mels, T)
            mel_tensor = result['mel_tensor'].squeeze(0)

            # feature_vector already a 1-D numpy array; convert to tensor
            feature_vector = torch.tensor(result['feature_vector'])

            label = self.labels[idx]
            return mel_tensor, feature_vector, label

        except Exception as exc:
            print(f"[AudioDeepfakeDataset] Error processing {self.audio_paths[idx]}: {exc}")
            # Return zero tensors so the DataLoader does not crash
            mel_tensor = torch.zeros(1, 128, 128)
            feature_vector = torch.zeros(13)
            return mel_tensor, feature_vector, 0


def load_audio_dataset_from_directory(dataset_dir: str, real_subdir: str = 'real', fake_subdir: str = 'fake',) -> tuple[list[str], list[int]]:
    """Walk *dataset_dir* and return (audio_paths, labels)."""

    audio_paths: list[str] = []
    labels: list[int] = []

    supported = AudioDeepfakeDataset.SUPPORTED_EXTENSIONS

    real_dir = os.path.join(dataset_dir, real_subdir)
    if os.path.exists(real_dir):
        for fname in os.listdir(real_dir):
            if fname.lower().endswith(supported):
                audio_paths.append(os.path.join(real_dir, fname))
                labels.append(0)
        print(f"Loaded {sum(1 for l in labels if l == 0)} real audio clips")
    else:
        print(f"Warning: real directory not found at {real_dir}")

    fake_dir = os.path.join(dataset_dir, fake_subdir)
    if os.path.exists(fake_dir):
        before = len(audio_paths)
        for fname in os.listdir(fake_dir):
            if fname.lower().endswith(supported):
                audio_paths.append(os.path.join(fake_dir, fname))
                labels.append(1)
        print(f"Loaded {len(audio_paths) - before} fake audio clips")
    else:
        print(f"Warning: fake directory not found at {fake_dir}")

    return audio_paths, labels


def split_dataset(audio_paths: list[str], labels: list[int], train_ratio: float = 0.8,) -> tuple[list, list, list, list]:
    """Shuffle then split into training and validation sets."""
    import random

    indices = list(range(len(audio_paths)))
    random.shuffle(indices)

    split_idx = int(len(indices) * train_ratio)
    train_idx = indices[:split_idx]
    val_idx = indices[split_idx:]

    train_paths  = [audio_paths[i] for i in train_idx]
    train_labels = [labels[i]      for i in train_idx]
    val_paths    = [audio_paths[i] for i in val_idx]
    val_labels   = [labels[i]      for i in val_idx]

    return train_paths, train_labels, val_paths, val_labels

def train_audio_model(train_data_loader, val_data_loader, num_epochs: int = 1, learning_rate: float = 1e-4, save_path: str = "audio_model.pth",) -> AudioDeepfakeDetector:
    """Train an AudioDeepfakeDetector and save the best weights."""
 
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model  = AudioDeepfakeDetector().to(device)
 
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', patience=2, factor=0.5, verbose=True
    )
 
    best_val_loss = float('inf')
 
    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        for mel_tensors, audio_features, labels in train_data_loader:
            mel_tensors    = mel_tensors.to(device)
            audio_features = audio_features.to(device)
            labels         = labels.float().unsqueeze(1).to(device)
 
            optimizer.zero_grad()
            outputs = model(mel_tensors, audio_features)
            loss    = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
 
        avg_train_loss = train_loss / len(train_data_loader)
 
        model.eval()
        val_loss = 0.0
        correct  = 0
        total    = 0
        with torch.no_grad():
            for mel_tensors, audio_features, labels in val_data_loader:
                mel_tensors = mel_tensors.to(device)
                audio_features = audio_features.to(device)
                labels = labels.float().unsqueeze(1).to(device)
 
                outputs = model(mel_tensors, audio_features)
                val_loss += criterion(outputs, labels).item()
                predicted = (outputs > 0.5).float()
                correct += (predicted == labels).sum().item()
                total += labels.size(0)
 
        avg_val_loss = val_loss / len(val_data_loader)
        val_accuracy = 100.0 * correct / total if total > 0 else 0.0
 
        print(
            f"Epoch [{epoch+1}/{num_epochs}] "
            f"Train Loss: {avg_train_loss:.4f} | "
            f"Val Loss: {avg_val_loss:.4f} | "
            f"Val Accuracy: {val_accuracy:.2f}%"
        )
 
        # Save best model weights
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            torch.save(model.state_dict(), save_path)
            print(f"  ✓ New best model saved to {save_path} (val loss {best_val_loss:.4f})")
 
        scheduler.step(avg_val_loss)
 
    print(f"\nTraining complete. Best model saved to {save_path}")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train an audio deepfake detection model")
    parser.add_argument("--dataset", type=str, required=True, help="Path to dataset directory (must contain 'real/' and 'fake/' sub-dirs)")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--epochs", type=int, default=1, help="Number of epochs")
    parser.add_argument("--lr", type=float, default=0.0001, help="Learning rate")
    parser.add_argument("--output", type=str, default="audio_model.pth", help="Output path for the trained model weights")
    parser.add_argument("--workers", type=int, default=2, help="Number of DataLoader worker processes")
    
    args = parser.parse_args()

    print("=" * 60)
    print("AUDIO DEEPFAKE DETECTION MODEL TRAINING")
    print("=" * 60)
    print("Configuration:")
    for k, v in vars(args).items():
        print(f"  {k}: {v}")
    print("=" * 60)

    print("\n[1/4] Loading dataset...")
    audio_paths, labels = load_audio_dataset_from_directory(args.dataset)
    if len(audio_paths) == 0:
        raise RuntimeError(
            f"No audio files found in {args.dataset}. "
            "Ensure the directory contains 'real/' and 'fake/' sub-folders "
            f"with files ending in {AudioDeepfakeDataset.SUPPORTED_EXTENSIONS}."
        )
    print(f"Total clips : {len(audio_paths)}")
    print(f"Real clips  : {sum(1 for l in labels if l == 0)}")
    print(f"Fake clips  : {sum(1 for l in labels if l == 1)}")

    print("\n[2/4] Splitting dataset...")
    train_paths, train_labels, val_paths, val_labels = split_dataset(
        audio_paths, labels, train_ratio=0.8
    )
    print(f"Training set   : {len(train_paths)} clips")
    print(f"Validation set : {len(val_paths)} clips")

    print("\n[3/4] Creating dataloaders...")
    train_dataset = AudioDeepfakeDataset(train_paths, train_labels)
    val_dataset   = AudioDeepfakeDataset(val_paths,   val_labels)

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.workers,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.workers,
    )

    print("\n[4/4] Training model...")
    print("=" * 60)
    train_audio_model(
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