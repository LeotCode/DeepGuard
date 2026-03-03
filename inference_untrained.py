import os
import certifi
import numpy as np
from PIL import Image
import tensorflow as tf
from google.cloud import vision
from tensorflow.keras.applications import ResNet50V2
from tensorflow.keras.applications.resnet_v2 import preprocess_input

os.environ["SSL_CERT_FILE"] = certifi.where()

# ------------------------------------------------
# 1) SET GOOGLE VISION KEY
# ------------------------------------------------
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "vision_key/deepguard-project-5bab4149d7ae.json"

# ------------------------------------------------
# 2) CREATE GOOGLE VISION CLIENT
# ------------------------------------------------
vision_client = vision.ImageAnnotatorClient()

# ------------------------------------------------
# 3) BUILD RESNET50V2 MODEL (UNTRAINED)
# ------------------------------------------------
def build_model():
    base = ResNet50V2(weights="imagenet", include_top=False, input_shape=(224, 224, 3))
    base.trainable = False

    x = tf.keras.layers.GlobalAveragePooling2D()(base.output)
    x = tf.keras.layers.Dense(1024, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    output = tf.keras.layers.Dense(1, activation="sigmoid")(x)

    return tf.keras.Model(inputs=base.input, outputs=output)

model = build_model()

# ------------------------------------------------
# 4) PREPROCESS FACE FOR RESNET50V2
# ------------------------------------------------
def preprocess_face(pil_img):
    pil_img = pil_img.convert("RGB").resize((224, 224))
    x = np.array(pil_img).astype(np.float32)
    x = preprocess_input(x)  # converts to [-1, 1]
    x = np.expand_dims(x, axis=0)
    return x

# ------------------------------------------------
# 5) FACE DETECTION USING GOOGLE VISION
# ------------------------------------------------
def analyze_image(image_path):
    with open(image_path, "rb") as f:
        content = f.read()

    image = vision.Image(content=content)
    response = vision_client.face_detection(image=image)
    faces = response.face_annotations or []

    print(f"Found {len(faces)} face(s)")

    img = Image.open(image_path).convert("RGB")
    w, h = img.size

    cropped_faces = []

    for face in faces:
        vertices = face.bounding_poly.vertices
        xs = [v.x if v.x is not None else 0 for v in vertices]
        ys = [v.y if v.y is not None else 0 for v in vertices]

        left = max(0, min(xs))
        top = max(0, min(ys))
        right = min(w, max(xs))
        bottom = min(h, max(ys))

        if right - left < 20 or bottom - top < 20:
            continue

        crop = img.crop((left, top, right, bottom))
        cropped_faces.append(crop)

    return cropped_faces

# ------------------------------------------------
# 6) RUN ON TEST IMAGE
# ------------------------------------------------
def run_on_image(image_path):
    faces = analyze_image(image_path)

    if not faces:
        print("No faces detected.")
        return

    for i, face in enumerate(faces):
        x = preprocess_face(face)
        score = float(model.predict(x, verbose=0)[0][0])

        print(f"\nFace {i+1}")
        print(f"Score: {score:.4f}")
        print("Prediction:", "DEEPFAKE" if score >= 0.5 else "REAL")

if __name__ == "__main__":
    run_on_image("test_images/leo.png")