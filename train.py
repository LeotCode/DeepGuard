import tensorflow as tf
from tensorflow.keras.applications import ResNet50V2
from tensorflow.keras.applications.resnet_v2 import preprocess_input
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, ReduceLROnPlateau, EarlyStopping

# ===============================
# CONFIG
# ===============================

IMG_SIZE = 224
BATCH_SIZE = 32  # M1 works well at 32
STAGE1_EPOCHS = 40
STAGE2_EPOCHS = 40

TRAIN_DIR = "datasets/140k real vs fake faces subset/real_vs_fake/train"
VAL_DIR = "datasets/140k real vs fake faces subset/real_vs_fake/valid"

MODEL_PATH = "models/best_model.keras"

print("TensorFlow version:", tf.__version__)
print("GPU Available:", tf.config.list_physical_devices("GPU"))

# ===============================
# DATA GENERATORS (FIXED)
# ===============================

train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=10,
    width_shift_range=0.05,
    height_shift_range=0.05,
    zoom_range=0.15,
    horizontal_flip=True,
    brightness_range=[0.9, 1.1],
)

val_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input
)

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="binary"
)

val_generator = val_datagen.flow_from_directory(
    VAL_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="binary"
)

# ===============================
# MODEL
# ===============================

base_model = ResNet50V2(
    weights="imagenet",
    include_top=False,
    input_shape=(IMG_SIZE, IMG_SIZE, 3)
)

x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(256, activation="relu")(x)
x = Dropout(0.4)(x)
output = Dense(1, activation="sigmoid")(x)

model = Model(inputs=base_model.input, outputs=output)

# ===============================
# LOSS (Removed Label Smoothing)
# ===============================

loss_fn = tf.keras.losses.BinaryCrossentropy()

# ===============================
# CALLBACKS (Improved)
# ===============================

callbacks = [
    ModelCheckpoint(
        MODEL_PATH,
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1
    ),
    ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.3,
        patience=3,
        verbose=1
    ),
    EarlyStopping(
        monitor="val_loss",
        patience=9,
        restore_best_weights=True
    )
]

# ===============================
# STAGE 1 — TRAIN HEAD
# ===============================

print("\n===== STAGE 1: Training classifier head =====")

base_model.trainable = False

model.compile(
    optimizer=Adam(learning_rate=3e-4),
    loss=loss_fn,
    metrics=["accuracy"]
)

model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=STAGE1_EPOCHS,
    callbacks=callbacks
)

# ===============================
# STAGE 2 — FINE TUNE
# ===============================

print("\n===== STAGE 2: Fine tuning =====")

base_model.trainable = True

# Unfreeze last 50 layers (better for deepfake detection)
for layer in base_model.layers[:-50]:
    layer.trainable = False

model.compile(
    optimizer=Adam(learning_rate=1e-5),
    loss=loss_fn,
    metrics=["accuracy"]
)

model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=STAGE2_EPOCHS,
    callbacks=callbacks
)

# ===============================
# SAVE FINAL MODEL
# ===============================

model.save("models/final_model.keras")

print("\n✅ Training complete.")