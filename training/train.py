import tensorflow as tf
from tensorflow.keras.applications import Xception
from tensorflow.keras.applications.xception import preprocess_input


def model_train(train_ds, val_ds):
     
    #Load the pretrained Xception model backbone, remove imageNet classification head
    base_model = Xception(weights='imagenet', include_top=False, input_shape=(299, 299, 3))

    #Add own deepfake classifier with 3 layers
    x = tf.keras.layers.GlobalAveragePooling2D()(base_model.output)
    x = tf.keras.layers.Dense(1024, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    output = tf.keras.layers.Dense(1, activation='sigmoid')(x)

    model = tf.keras.Model(inputs = base_model.input, outputs = output)

    #Freeze the base model (Xception) backbone to retain the learned features 
    base_model.trainable = False

    #Compile the model with binary cross-entropy loss and Adam optimizer
    model.compile(
        optimizer = tf.keras.optimizers.Adam(learning_rate = 1e-4),
        loss = 'binary_crossentropy',
        metrics = ['accuracy'])

    history = model.fit(
        train_ds,
        validation_data = val_ds,
        epochs = 10
    )

    #unfreeze backbone
    base_model.trainable = True

    #recompile
    model.compile(
        optimizer = tf.keras.optimizers.Adam(learning_rate = 1e-5),
        loss = 'binary_crossentropy',
        metrics = ['accuracy'])

    #retrain
    history = model.fit(
        train_ds,
        validation_data = val_ds,
        epochs = 3)
        
    # Save the trained model
    model.save('models/xception_deepfake_classifier.keras')
    
    return model
