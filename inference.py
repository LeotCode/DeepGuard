import os
import numpy as np
from PIL import Image
import tensorflow as tf
from google.cloud import vision
from tensorflow.keras.applications.resnet_v2 import preprocess_input

# ------------------------------------------------
# 1) SET GOOGLE VISION KEY
# ------------------------------------------------
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "vision_key/deepguard-project-5bab4149d7ae.json"

# ------------------------------------------------
# 2) LOAD TRAINED MODEL (NOT building base model)
# ------------------------------------------------
MODEL_PATH = "models/best_model.keras"
model = tf.keras.models.load_model(MODEL_PATH)
print("Loaded trained model:", MODEL_PATH)

# IMPORTANT:
# During training we set:
# CLASS_NAMES = ["Fake", "Real"]
# So sigmoid output = P(Real)
# Therefore fake probability = 1 - score
def score_to_fake_prob(score: float) -> float:
    return 1.0 - score

# ------------------------------------------------
# 3) CREATE GOOGLE VISION CLIENT
# ------------------------------------------------
vision_client = vision.ImageAnnotatorClient()

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
# 6) RUN PREDICTION
# ------------------------------------------------
def run_on_image(image_path):
    faces = analyze_image(image_path)

    if not faces:
        print("No faces detected.")
        return

    for i, face in enumerate(faces):
        x = preprocess_face(face)

        score = float(model.predict(x, verbose=0)[0][0])  # P(Real)
        fake_prob = score_to_fake_prob(score)

        print(f"\n--- Face {i+1} ---")
        print(f"Fake probability: {fake_prob:.4f}")
        print("Prediction:", "DEEPFAKE" if fake_prob >= 0.5 else "REAL")

# ------------------------------------------------
# 7) ASK FOR IMAGE PATH AT RUNTIME
# ------------------------------------------------
if __name__ == "__main__":
    while True:
        image_path = input("\nEnter image path to test (or 'q' to quit): ").strip().strip('"').strip("'")
        if image_path.lower() in {"q", "quit", "exit"}:
            break

        if not os.path.isfile(image_path):
            print("File not found. Try again.")
            continue

        run_on_image(image_path)