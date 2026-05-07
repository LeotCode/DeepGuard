# DeepGuard Cloud Run Deployment

DeepGuard deploys as two Cloud Run services:

- `deepguard-backend`: FastAPI inference API on port `8080`
- `deepguard-frontend`: Next.js web app on port `8080`

## What Changed For Cloud Run

- Backend now listens on Cloud Run's `PORT` environment variable.
- Frontend now starts on Cloud Run's `PORT` environment variable.
- Backend image includes `backend/models/` because Cloud Run does not use the local Docker Compose model volume.
- Firebase Admin can use Application Default Credentials, so Cloud Run can use its service account instead of a mounted JSON key.
- Frontend public env vars are accepted as Docker build args because `NEXT_PUBLIC_*` values are compiled into the browser bundle.

## Prerequisites

Install and authenticate the Google Cloud CLI:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project PROJECT_ID
```

Enable required APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com
```

Create an Artifact Registry Docker repository:

```bash
gcloud artifacts repositories create deepguard --repository-format=docker --location=us-central1 --description="DeepGuard containers"
```

Grant Firestore access to the Cloud Run runtime service account. Replace `PROJECT_NUMBER` and `PROJECT_ID`:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" --role="roles/datastore.user"
```

If you use Groq summaries, store the key in Secret Manager:

```bash
printf "YOUR_GROQ_KEY" | gcloud secrets create groq-api-key --data-file=-
```

## Build And Deploy Backend First

Build the backend image:

```bash
gcloud builds submit backend --tag us-central1-docker.pkg.dev/PROJECT_ID/deepguard/deepguard-backend:latest
```

Deploy the backend:

```bash
gcloud run deploy deepguard-backend \
  --image us-central1-docker.pkg.dev/PROJECT_ID/deepguard/deepguard-backend:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900 \
  --concurrency 1 \
  --set-env-vars FIREBASE_PROJECT_ID=PROJECT_ID,FIRESTORE_DATABASE_ID=deepguard
```

If Groq is configured:

```bash
gcloud run services update deepguard-backend \
  --region us-central1 \
  --set-secrets GROQ_API_KEY=groq-api-key:latest
```

Get the backend URL:

```bash
gcloud run services describe deepguard-backend --region us-central1 --format="value(status.url)"
```

## Build And Deploy Frontend

Build the frontend image with `cloudbuild.yaml` so Docker build args are passed correctly:

```bash
gcloud builds submit . --config cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_API_URL=BACKEND_URL,_NEXT_PUBLIC_FIREBASE_API_KEY=FIREBASE_API_KEY,_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN,_NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID,_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=FIREBASE_STORAGE_BUCKET,_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=FIREBASE_MESSAGING_SENDER_ID,_NEXT_PUBLIC_FIREBASE_APP_ID=FIREBASE_APP_ID
```

For local Docker builds, pass the same values as build args:

```bash
docker build frontend \
  --build-arg NEXT_PUBLIC_API_URL=BACKEND_URL \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=FIREBASE_API_KEY \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=FIREBASE_STORAGE_BUCKET \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=FIREBASE_MESSAGING_SENDER_ID \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=FIREBASE_APP_ID \
  -t deepguard-frontend
```

If you build locally, push the image before deploy:

```bash
docker tag deepguard-frontend us-central1-docker.pkg.dev/PROJECT_ID/deepguard/deepguard-frontend:latest
docker push us-central1-docker.pkg.dev/PROJECT_ID/deepguard/deepguard-frontend:latest
```

Deploy the frontend after the image exists in Artifact Registry:

```bash
gcloud run deploy deepguard-frontend \
  --image us-central1-docker.pkg.dev/PROJECT_ID/deepguard/deepguard-frontend:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1
```

## One-Command Cloud Build Option

After the backend URL is known, `cloudbuild.yaml` can build and deploy both services:

```bash
gcloud builds submit . --config cloudbuild.yaml --substitutions=_NEXT_PUBLIC_API_URL=BACKEND_URL,_NEXT_PUBLIC_FIREBASE_API_KEY=FIREBASE_API_KEY,_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN,_NEXT_PUBLIC_FIREBASE_PROJECT_ID=PROJECT_ID,_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=FIREBASE_STORAGE_BUCKET,_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=FIREBASE_MESSAGING_SENDER_ID,_NEXT_PUBLIC_FIREBASE_APP_ID=FIREBASE_APP_ID
```

## Verify

Check backend health:

```bash
curl BACKEND_URL/health
```

Check Cloud Run logs:

```bash
gcloud run services logs read deepguard-backend --region us-central1 --limit 100
gcloud run services logs read deepguard-frontend --region us-central1 --limit 100
```

## Production Notes

- Keep `backend/secrets/` out of images. Use Cloud Run IAM and Secret Manager.
- Backend model files are currently baked into the image. For larger models, move them to Cloud Storage and download them at startup or during image build.
- The backend allows all CORS origins today. Restrict `allow_origins` to the deployed frontend URL before public production use.
- Inference is CPU-only in this Dockerfile. Use higher CPU/memory settings or split heavier model work into separate services if latency is too high.
