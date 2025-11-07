// ===== SIGNIFY MAIN.JS =====

// --- Theme & Config ---
const defaultConfig = {
  background_color: "#000000",
  accent_color: "#00FFF0",
  secondary_color: "#8B5CF6",
  text_color: "#FFFFFF",
  surface_color: "#0a0a0a",
  font_family: "Inter",
  font_size: 16,
  hero_headline: "Bridging Silence with AI Revolution",
  hero_subheadline:
    "Transform sign language into universal communication with cutting-edge AI powered by Google Gemini, MediaPipe, and Cloud Run.",
  cta_primary_text: "Experience the Magic",
  nav_logo: "Signify",
  footer_text: "© 2025 Signify — Revolutionizing Communication with AI",
};

const config = window.elementSdk ? window.elementSdk.config : defaultConfig;

// --- Particles Background ---
function createParticles() {
  const particlesContainer = document.getElementById("particles");
  if (!particlesContainer) return;
  for (let i = 0; i < 50; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 15 + "s";
    p.style.animationDuration = Math.random() * 10 + 10 + "s";
    particlesContainer.appendChild(p);
  }
}

// --- Globals ---
let cameraActive = false;
let videoElement, canvasElement, canvasCtx;
let backendURL =
  "https://signify-backend-532930094893.asia-south1.run.app/translate";

const demoButton = document.getElementById("demoButton");
const gestureOutput = document.getElementById("result1");

// --- Debounce backend calls (avoid spamming) ---
let lastSent = 0;
const SEND_INTERVAL_MS = 700;

// --- FIXED: MediaPipe Hands initialization with CDN model path ---
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

// Initialize and confirm load
(async () => {
  console.log("🧠 Loading MediaPipe Hands model...");
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log("✅ Hands model loaded");
})();

// --- Simple Rule-Based Gesture Classifier ---
function classifyGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return "unknown";

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const aboveWrist = (pt) => pt.y < wrist.y;

  const fingersUp =
    [indexTip, middleTip, ringTip, pinkyTip].filter(aboveWrist).length >= 3;
  if (fingersUp) return "hello";

  const dist =
    Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) +
    Math.abs(indexTip.z - thumbTip.z);
  if (dist < 0.08) return "ok";

  if (thumbTip.x < wrist.x && indexTip.x < wrist.x) return "love";

  return "unknown";
}

// --- Handle Detection Results ---
hands.onResults(async (results) => {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  const count = results.multiHandLandmarks?.length || 0;
  console.log("🔍 Frame hands:", count);

  if (count > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00fff0",
        lineWidth: 3,
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#8B5CF6", lineWidth: 1 });

      const gesture = classifyGesture(landmarks);
      console.log("🖐 Gesture:", gesture);

      if (gesture !== "unknown") {
        updateGestureUI(gesture);

        const now = Date.now();
        if (now - lastSent > SEND_INTERVAL_MS) {
          lastSent = now;
          await sendGestureToBackend(gesture);
        }
      }
    }
  } else {
    gestureOutput.querySelector(".result-gesture").innerText = "…";
    gestureOutput.querySelector(".result-meaning").innerText =
      "Show your hand to the camera";
    gestureOutput.querySelector(".result-emoji").innerText = "🖐️";
  }
  canvasCtx.restore();
});

// --- Camera Setup ---
async function startCamera() {
  videoElement = document.createElement("video");
  videoElement.width = 640;
  videoElement.height = 480;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.muted = true;

  canvasElement = document.createElement("canvas");
  canvasElement.width = 640;
  canvasElement.height = 480;
  canvasCtx = canvasElement.getContext("2d");

  const cameraDiv = document.querySelector(".camera-frame");
  cameraDiv.innerHTML = "";
  cameraDiv.appendChild(canvasElement);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
      audio: false,
    });
    videoElement.srcObject = stream;

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480,
    });

    await camera.start();
    cameraActive = true;
    console.log("✅ Camera started");
  } catch (err) {
    console.error("Camera error:", err);
    alert("Please allow camera access to continue the demo.");
  }
}

// --- UI Helpers ---
function updateGestureUI(gesture) {
  gestureOutput.querySelector(".result-gesture").innerText =
    gesture.toUpperCase();
  gestureOutput.querySelector(".result-meaning").innerText = "Recognizing...";
}

function displayGeminiResponse(data) {
  if (data && data.text) {
    gestureOutput.querySelector(".result-meaning").innerText = data.text;
    gestureOutput.querySelector(".result-emoji").innerText = data.emoji || "🤖";
  } else {
    gestureOutput.querySelector(".result-meaning").innerText =
      "No response from AI.";
    gestureOutput.querySelector(".result-emoji").innerText = "🤖";
  }
}

// --- Backend ---
async function sendGestureToBackend(gesture) {
  try {
    const res = await fetch(backendURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gesture }),
    });
    const data = await res.json();
    console.log("Gemini:", data);
    displayGeminiResponse(data);
  } catch (err) {
    console.error("Backend error:", err);
    gestureOutput.querySelector(".result-meaning").innerText =
      "⚠️ Unable to reach backend. Check Cloud Run URL.";
  }
}

// --- Button Logic ---
demoButton.addEventListener("click", () => {
  if (!cameraActive) {
    startCamera();
    demoButton.textContent = "Stop Recognition";
    demoButton.classList.add("active");
  } else {
    location.reload();
  }
});

// --- Smooth Scroll ---
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});

// --- Scroll Animations ---
const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

document.querySelectorAll(".feature-card, .stat-item").forEach((el) => {
  el.style.opacity = "0";
  el.style.transform = "translateY(30px)";
  el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  observer.observe(el);
});

// --- Init ---
createParticles();
onConfigChange(config);

// --- Dynamic Style Binding ---
function onConfigChange(cfg) {
  document.body.style.background = cfg.background_color;
  document.body.style.color = cfg.text_color;
  document.body.style.fontFamily = `${cfg.font_family}, sans-serif`;
  document.body.style.fontSize = `${cfg.font_size}px`;

  const logo = document.getElementById("nav-logo");
  const headline = document.getElementById("hero-headline");
  const subheadline = document.getElementById("hero-subheadline");
  const cta = document.getElementById("cta-primary");
  const footer = document.getElementById("footer-text");

  if (logo) logo.textContent = cfg.nav_logo;
  if (headline) headline.textContent = cfg.hero_headline;
  if (subheadline) subheadline.textContent = cfg.hero_subheadline;
  if (cta) cta.textContent = cfg.cta_primary_text;
  if (footer) footer.textContent = cfg.footer_text;
}
