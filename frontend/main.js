// ===== SIGNIFY MAIN.JS (fast, robust, production-safe) =====
import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// --- Theme & Config (unchanged) ---
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

// --- Particles (unchanged) ---
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
let videoEl, canvasEl, ctx, drawingUtils, handLandmarker;
let backendURL =
  "https://signify-backend-532930094893.asia-south1.run.app/translate";

const demoButton = document.getElementById("demoButton");
const gestureOutput = document.getElementById("result1");

// --- Backend throttling & cooldowns ---
let lastSent = 0;
let lastGesture = "";
let cooldownUntil = 0;
const SEND_INTERVAL_MS = 900;         // backend debounce
const RATE_LIMIT_COOLDOWN_MS = 60000; // pause 60s after 429

// --- Inference throttle (fixes lag) ---
let lastPredictionTime = 0;
const PREDICTION_INTERVAL = 80; // ~12–15 FPS, smooth + low CPU

// --- Init HandLandmarker (fast WASM) ---
async function initHandTracking() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      // official hosted .task model (float16 is lighter/faster)
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });

  // Canvas & video setup
  videoEl = document.createElement("video");
  videoEl.playsInline = true;
  videoEl.muted = true;
  videoEl.autoplay = true;

  canvasEl = document.createElement("canvas");
  ctx = canvasEl.getContext("2d", { alpha: false });
  drawingUtils = new DrawingUtils(ctx);

  const cameraDiv = document.querySelector(".camera-frame");
  cameraDiv.innerHTML = "";
  cameraDiv.appendChild(canvasEl);

  console.log("✅ HandLandmarker ready");
}

// --- Classification (more robust) ---
function classifyGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return "unknown";

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const above = (p) => p.y < wrist.y;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const fingersUpCount = [indexTip, middleTip, ringTip, pinkyTip].filter(above).length;

  // HELLO: open palm (≥4 fingers up, thumb not pinching)
  if (fingersUpCount >= 4 && dist(thumbTip, indexTip) > 0.09) return "hello";

  // LOVE (🤟): index & pinky up, middle down
  const indexUp = above(indexTip);
  const pinkyUp = above(pinkyTip);
  const middleDown = !above(middleTip);
  if (indexUp && pinkyUp && middleDown) return "love";

  // OK: thumb touching index (loose threshold)
  if (dist(thumbTip, indexTip) < 0.055) return "ok";

  return "unknown";
}

// --- UI helpers ---
function updateGestureUI(gesture) {
  const g = gesture.toUpperCase();
  gestureOutput.querySelector(".result-gesture").innerText = g;
  gestureOutput.querySelector(".result-meaning").innerText = "Recognizing...";
  gestureOutput.querySelector(".result-emoji").innerText =
    gesture === "hello" ? "👋" : gesture === "love" ? "🤟" : gesture === "ok" ? "👌" : "🤖";
}
function setIdleUI() {
  gestureOutput.querySelector(".result-gesture").innerText = "…";
  gestureOutput.querySelector(".result-meaning").innerText =
    "Show your hand to the camera";
  gestureOutput.querySelector(".result-emoji").innerText = "🖐️";
}
function displayGeminiResponse(data) {
  const meaning = gestureOutput.querySelector(".result-meaning");
  const emojiBox = gestureOutput.querySelector(".result-emoji");

  if (data?.error) {
    meaning.innerText = "⚠️ Rate limit — AI paused for 60s";
    emojiBox.innerText = "🤖";
    cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    return;
  }
  if (data?.text) {
    meaning.innerText = data.text;
    emojiBox.innerText = data.emoji || "🤖";
  } else {
    meaning.innerText = "Recognizing…";
    emojiBox.innerText = "🤖";
  }
}

// --- Backend ---
async function sendGestureToBackend(gesture) {
  // cooldown on 429s
  if (Date.now() < cooldownUntil) return;

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

// --- Main inference loop (throttled) ---
async function predictLoop() {
  if (!cameraActive) return;

  const nowPerf = performance.now();
  if (nowPerf - lastPredictionTime >= PREDICTION_INTERVAL) {
    lastPredictionTime = nowPerf;

    const result = await handLandmarker.detectForVideo(videoEl, nowPerf);

    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    if (result.landmarks && result.landmarks.length > 0) {
      for (const lm of result.landmarks) {
        drawingUtils.drawConnectors(lm, HandLandmarker.HAND_CONNECTIONS, {
          color: "#00FFF0",
          lineWidth: 2,
        });
        drawingUtils.drawLandmarks(lm, { color: "#8B5CF6", lineWidth: 1 });

        const gesture = classifyGesture(lm);
        if (gesture !== "unknown") {
          // avoid spamming backend with same gesture
          if (gesture !== lastGesture) updateGestureUI(gesture);
          const now = Date.now();
          if (gesture !== lastGesture && now - lastSent > SEND_INTERVAL_MS) {
            lastSent = now;
            lastGesture = gesture;
            await sendGestureToBackend(gesture);
          }
        } else {
          setIdleUI();
          lastGesture = "";
        }
      }
    } else {
      setIdleUI();
      lastGesture = "";
    }
  }
  requestAnimationFrame(predictLoop);
}

// --- Camera setup (640x480 = good FPS) ---
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    videoEl.srcObject = stream;

    // play() may get interrupted if srcObject changes; swallow AbortError
    try {
      await videoEl.play();
    } catch (e) {
      console.warn("play() interrupted, retrying once…", e);
      await new Promise((r) => setTimeout(r, 50));
      await videoEl.play();
    }

    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;

    cameraActive = true;
    console.log("✅ Camera started (Tasks API)");
    requestAnimationFrame(predictLoop);
  } catch (err) {
    console.error("Camera error:", err);
    alert("Please allow camera access to continue the demo.");
  }
}

// --- Button logic ---
demoButton.addEventListener("click", async () => {
  if (!cameraActive) {
    await initHandTracking();
    await startCamera();
    demoButton.textContent = "Stop Recognition";
    demoButton.classList.add("active");
  } else {
    location.reload();
  }
});

// --- Smooth scroll & reveal (unchanged) ---
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});
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

// --- Init UI ---
createParticles();
onConfigChange(config);
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
