import os
from google.cloud import vision
from PIL import Image
from dotenv import load_dotenv


load_dotenv('myEnv.env')  

# point to the service account file

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_PATH')

def analyze_image(image_path):
    # Initialize the client
    client = vision.ImageAnnotatorClient()
    # Open and store the image to be processed
    with open(image_path, 'rb') as image_file:
        content = image_file.read()
    image = vision.Image(content=content)

    # Detetct and crop face from image and store it in a folder
    response = client.face_detection(image=image)
    faces = response.face_annotations

    #open the image
    img = Image.open(image_path)

    #crop the face
    cropped_faces_list = [] # New list to store PIL Image objects

    for i, face in enumerate(faces):
        # Get the bounding box coordinates
        vertices = face.bounding_poly.vertices
        left = min([v.x for v in vertices])
        top = min([v.y for v in vertices])
        right = max([v.x for v in vertices])
        bottom = max([v.y for v in vertices])

        #Expand slightly to avoid tight crops
        padding = 20
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(img.width, right + padding)
        bottom = min(img.height, bottom + padding)

        # Crop the face

        cropped_face = img.crop((left, top, right, bottom))
        cropped_faces_list.append(cropped_face) # Add to the list

    return cropped_faces_list # Return the list of cropped PIL Image objects




