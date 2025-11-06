# 🤟 Signify AI — Real-Time Sign-Language Translator

Signify AI transforms how the hearing and deaf communities communicate.
It recognizes **hand gestures in real time** through **MediaPipe Vision Tasks** and interprets them into **human-friendly language using Gemini 1.5 Flash**, all hosted seamlessly on **Google Cloud Run**.


## 🚀 Live Deployment

* **Backend (FastAPI on Cloud Run):** [https://signify-backend-532930094893.asia-south1.run.app](https://signify-backend-532930094893.asia-south1.run.app)
* **Frontend (Local Demo):** HTML + CSS + JS + MediaPipe (camera-based gesture capture)


## 💡 Vision

Bridging accessibility with AI — enabling anyone, anywhere, to communicate through sign language effortlessly and inclusively.


## 🧠 System Overview

| Layer                   | Role                                              | Technology                  |
| ----------------------- | ------------------------------------------------- | --------------------------- |
| **Gesture Capture**     | Detects real-time hand movements from webcam feed | MediaPipe Tasks Vision      |
| **Frontend Processing** | Classifies gesture + sends API request            | HTML / CSS / JS             |
| **Backend API**         | Processes request & queries Gemini AI             | FastAPI on Google Cloud Run |
| **Language Model**      | Generates natural translation + emoji             | Gemini 1.5 Flash (Latest)   |
| **Response Delivery**   | Returns friendly JSON → Text + Emoji              | HTTPS (JSON API)            |


## 🏗️ Architecture

```plaintext
User Gesture  →  MediaPipe Detection  →  JS Frontend
        ↓                         ↑
     FastAPI Backend  ←→  Gemini 1.5 Flash Model
        ↓
   JSON → { "text": "...", "emoji": "..." }
```

---

## 🧩 Tech Stack

**Frontend:** HTML • CSS • JavaScript • MediaPipe
**Backend:** Python • FastAPI • Uvicorn
**AI:** Google Gemini 1.5 Flash (Latest Model)
**Infrastructure:** Docker • Google Cloud Run • Artifact Registry • Cloud Build


## ⚙️ Local Setup

```bash
# Clone repository
git clone https://github.com/yourusername/Signify-AI.git
cd Signify-AI/backend

# Install dependencies
pip install -r requirements.txt

# Run server locally
uvicorn main:app --reload --port 8080
```

Frontend:

```bash
cd ../frontend
open index.html   # or simply drag into Chrome
```


## ☁️ Cloud Deployment

```bash
gcloud run deploy signify-backend \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY="YOUR_KEY" \
  --port 8080
```


## 🧪 API Endpoints

| Method | Endpoint     | Description                                 |
| ------ | ------------ | ------------------------------------------- |
| `GET`  | `/`          | Health check                                |
| `GET`  | `/health`    | Returns service status                      |
| `POST` | `/translate` | Accepts gesture JSON → returns text + emoji |

**Example:**

```bash
curl -X POST https://signify-backend-532930094893.asia-south1.run.app/translate \
  -H "Content-Type: application/json" \
  -d '{"gesture": "love"}'
```

**Response:**

```json
{
  "text": "Love means a deep feeling of affection or care for someone 💖",
  "emoji": "🤟"
}
```


## 🌍 Impact

* **Accessibility:** Empowers millions of sign-language users worldwide
* **Education:** Enables interactive learning for sign interpretation
* **Healthcare & Public Services:** Facilitates inclusive, barrier-free communication


## 🤝 Acknowledgments

* Google Cloud Run Team
* MediaPipe Developers
* Gemini AI Research Team

