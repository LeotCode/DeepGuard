import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__)))
from app.data_processing import analyze_image
import tensorflow as tf
from tensorflow.keras.applications import Xception
from tensorflow.keras.applications.xception import preprocess_input
import os
from PIL import Image


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def preprocess_and_save_cropped_faces(split):
    input_base = os.path.join(ROOT, 'data', split)
    output_base = os.path.join(ROOT, 'data', 'dataset_faces', split)

    for class_name in ["Real", "Fake"]:
        input_folder = os.path.join(input_base, class_name)
        output_folder = os.path.join(output_base, class_name)

        os.makedirs(output_folder, exist_ok=True)

        for file in os.listdir(input_folder):
            image_path = os.path.join(input_folder, file)

            faces = analyze_image(image_path)

            for i, face in enumerate(faces):
                if face.mode != 'RGB':
                    face = face.convert('RGB')

                face = face.resize((299, 299))

                face.save(
                    os.path.join(output_folder, f"{os.path.splitext(file)[0]}_face{i}.jpg")
                )

    return 0


def prepare_train_val_ds():
    #Split the face crop dataset into training and validation set (80/20)

    img_size = (299, 299)
    batch_size = 32

    train_ds = tf.keras.utils.image_dataset_from_directory(
        os.path.join(ROOT, 'data', 'dataset_faces', 'Train'),
        validation_split=0.2,
        subset="training",
        seed=42,
        image_size=img_size,
        batch_size=batch_size,
        label_mode="binary"
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        os.path.join(ROOT, 'data', 'dataset_faces', 'Train'),
        validation_split=0.2,
        subset="validation",
        seed=42,
        image_size=img_size,
        batch_size=batch_size,
        label_mode="binary"
    )

    #Apply the necessary preprocessing of the face dataset for Xception
    train_ds = train_ds.map(lambda x, y: (preprocess_input(x), y))
    val_ds = val_ds.map(lambda x, y: (preprocess_input(x), y))

    train_ds = train_ds.prefetch(tf.data.AUTOTUNE)
    val_ds = val_ds.prefetch(tf.data.AUTOTUNE)

    return train_ds, val_ds


def prepare_test_ds():
    img_size = (299, 299)
    batch_size = 32
    test_ds = tf.keras.utils.image_dataset_from_directory(
        os.path.join(ROOT, 'data', 'dataset_faces', 'Test'),
        image_size=img_size,
        batch_size=batch_size,
        label_mode="binary",
        shuffle=False   # IMPORTANT for evaluation
    )

    # Apply preprocess_input required for Xception model
    test_ds = test_ds.map(lambda x, y: (preprocess_input(x), y))

    test_ds = test_ds.prefetch(tf.data.AUTOTUNE)

    return test_ds
