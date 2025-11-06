import numpy as np
import json
import os

GESTURE_PATH = os.path.join(os.path.dirname(__file__), "gestures.json")

with open(GESTURE_PATH, "r") as f:
    GESTURE_MAP = json.load(f)

def classify_landmarks(landmarks):
    """Rule-based gesture classifier for now."""
    # Example: check y-distance between thumb and index
    if not landmarks or len(landmarks) < 21:
        return "unknown"
    
    wrist = landmarks[0]
    thumb_tip = landmarks[4]
    index_tip = landmarks[8]
    
    if abs(index_tip[1] - thumb_tip[1]) < 0.05:
        return "ok"
    if index_tip[1] < wrist[1]:
        return "hello"
    if thumb_tip[0] < wrist[0]:
        return "love"
    return "unknown"
