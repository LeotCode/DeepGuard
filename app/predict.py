import tensorflow as tf
from data_processing import analyze_image
from tensorflow.keras.applications.xception import preprocess_input
from tensorflow.keras.applications import Xception
from sklearn.metrics import classification_report, accuracy_score
import numpy as np
import os
from PIL import Image

def predict_test_ds(model, test_ds):

    # Collect true labels
    y_true = np.concatenate([y.numpy() for x, y in test_ds], axis=0).astype(int)

    # Predict probabilities
    y_pred_probs = model.predict(test_ds)

    # Convert to binary predictions
    y_pred = (y_pred_probs > 0.5).astype(int).flatten()

    # Accuracy
    acc = accuracy_score(y_true, y_pred)

    print("Accuracy:", acc)
    print()
    print(classification_report(y_true, y_pred, target_names=["real", "fake"]))

    return y_true, y_pred


def predict_single_image(model, img_path):

    cropped_faces = analyze_image(img_path)

    if not cropped_faces:
        print("No faces detected.")
        return

    # Loop through the cropped faces and make predictions
    for i, face_img in enumerate(cropped_faces):

        face_img_resized = face_img.resize((299, 299))
        face_array = np.array(face_img_resized)

        face_array = np.expand_dims(face_array, axis=0)
        processed_face = preprocess_input(face_array)

        pred = model.predict(processed_face)

        label = "fake" if pred[0][0] > 0.5 else "real"
        confidence = pred[0][0] if pred[0][0] > 0.5 else (1 - pred[0][0])

        print(f"Face {i+1}: {label.upper()} (Confidence: {confidence:.2f})")

    return 0