from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import vertexai
from vertexai.generative_models import GenerativeModel
import os, json

# Initialize FastAPI app
app = FastAPI()

# Allow CORS so your frontend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Gemini model (Vertex AI)
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "signify-ai")
vertexai.init(project=PROJECT_ID, location="us-central1")
model = GenerativeModel("gemini-1.5-flash")

@app.get("/")
def home():
    return {"message": "✅ Signify backend running on Cloud Run!"}

@app.post("/translate")
async def translate(request: Request):
    """Receives a gesture label and returns Gemini’s explanation + emoji."""
    data = await request.json()
    gesture = data.get("gesture", "").strip()

    if not gesture:
        return {"error": "Gesture not provided."}

    prompt = f"""
    You are Signify AI — a friendly sign-language translator.
    The recognized gesture is: {gesture}.
    Return only valid JSON in this exact format:
    {{ "text": "translated meaning", "emoji": "appropriate emoji" }}
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Try to parse JSON cleanly
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = {"text": text, "emoji": "🤖"}

        return parsed

    except Exception as e:
        return {"error": str(e)}
