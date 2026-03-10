import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
import predict
from training import datasets, train
import tensorflow as tf
from dotenv import load_dotenv





load_dotenv()  # Load environment variables from .env file

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Train and save the model
    print('****************************************************************************')
    print("Training model...")
    print('****************************************************************************')
    # Preprocess and save cropped faces for the training and validation sets
    datasets.preprocess_and_save_cropped_faces("Train")
    train_ds, val_ds = datasets.prepare_train_val_ds()
    model = train.model_train(train_ds, val_ds)

    

    # Evaluate the model on unseen test data, and demonstrate the performance 
    # of the model by printing the F-1, precision, recall and accuracy scores
    # print('****************************************************************************')
    # print("Welcome to DeepGuard - A Deepfake Detection System")
    # print("We are using an Xception backbone trained on ImageNet with custom classifiers")
    # print('****************************************************************************')
    # print("Evaluating the model on unseen test data...")
    # print()
    # # Preprocess and save cropped faces for the test set
    # datasets.preprocess_and_save_cropped_faces("Test") 
    # test_ds = datasets.prepare_test_ds()
    # # The .h5 file contains the model architecture and weights
    # model_path = os.path.join(ROOT, 'data', 'model.h5')
    # model = tf_keras.models.load_model(model_path, compile=False)
    # y_true, y_pred = predict.predict_test_ds(model, test_ds)

    # # Model Evaluation complete!!
    # print("Model evaluation complete!!")
    # print()
    # # Demonstrate the performance of the model by making predictions on a single image
    # print("Testing the model on a single image...")
    # img_path = os.path.join(ROOT, 'data', 'sample_image.jpg')  # Path to a sample image for testing
    # predict.predict_single_image(model, img_path)

    # # Model demonstration complete!!
    # print("Model demonstration complete!!")