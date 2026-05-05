"""
Ball detection and tracking pipeline.

Designed to be swapped with RF-DETR or any other detector — the rest of the
pipeline only depends on the `detect_frame()` contract:

    detect_frame(frame: np.ndarray) -> tuple[float | None, float | None, float]
        Returns (x, y, confidence) in pixel coordinates, or (None, None, 0.0)
        when the ball is not detected in this frame.
"""

import math
from dataclasses import dataclass, field

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Detector — swap this class body for RF-DETR inference when available
# ---------------------------------------------------------------------------

class BallDetector:
    """
    Baseline detector using HSV colour segmentation + Hough circles.
    Replace `_infer()` with a model forward-pass for RF-DETR.
    """

    def __init__(self):
        # Warm-up: no model loading needed for the baseline
        pass

    def detect_frame(
        self, frame: np.ndarray
    ) -> tuple[float | None, float | None, float]:
        return self._infer(frame)

    def _infer(
        self, frame: np.ndarray
    ) -> tuple[float | None, float | None, float]:
        hsv  = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([0, 0, 200]), np.array([180, 30, 255]))
        mask = cv2.GaussianBlur(mask, (9, 9), 2)

        circles = cv2.HoughCircles(
            mask,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=30,
            param1=50,
            param2=15,
            minRadius=4,
            maxRadius=40,
        )

        if circles is None:
            return None, None, 0.0

        # Pick the circle with the highest accumulator value (first in list)
        x, y, r = circles[0][0]
        conf = min(1.0, r / 20.0)  # rough proxy for confidence
        return float(x), float(y), round(conf, 3)


# ---------------------------------------------------------------------------
# Bounce detection
# ---------------------------------------------------------------------------

def _find_bounces(
    frames: list[dict],
    min_gap: int = 5,
) -> list[dict]:
    """
    Detect bounces as local y-minima in the trajectory (ball closest to top of
    frame just before reversing direction). Works in image-space: y increases
    downward, so a bounce is a *local maximum* in y.
    """
    bounces = []
    pts = [(f["f"], f["x"], f["y"]) for f in frames if f["x"] is not None]

    for i in range(1, len(pts) - 1):
        _, _, y_prev = pts[i - 1]
        fi, xi, yi   = pts[i]
        _, _, y_next = pts[i + 1]

        if yi > y_prev and yi > y_next:
            if not bounces or (fi - bounces[-1]["f"]) >= min_gap:
                bounces.append({"f": fi, "x": xi, "y": yi})

    return bounces


# ---------------------------------------------------------------------------
# Speed calculation
# ---------------------------------------------------------------------------

def _calc_speed(
    frames: list[dict],
    fps: float,
    pixels_per_meter: float = 30.0,
) -> float | None:
    """
    Compute average ball speed in km/h over the first tracked segment.
    pixels_per_meter should come from court calibration; 30 px/m is a
    reasonable placeholder for a standard broadcast crop.
    """
    pts = [(f["x"], f["y"]) for f in frames if f["x"] is not None]
    if len(pts) < 2:
        return None

    total_px = sum(
        math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        for i in range(1, len(pts))
    )
    total_m  = total_px / pixels_per_meter
    duration = len(pts) / fps          # seconds
    speed_ms = total_m / duration
    return round(speed_ms * 3.6, 1)   # m/s → km/h


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_pipeline(video_path: str, fps: float) -> dict:
    """
    Process a video file and return the full tracking result blob.

    Returns:
        {
            "frames":    [{"f": int, "x": float|null, "y": float|null, "conf": float}],
            "bounces":   [{"f": int, "x": float, "y": float}],
            "speed_kmh": float|null,
        }
    """
    detector = BallDetector()
    cap      = cv2.VideoCapture(video_path)

    frame_records: list[dict] = []
    idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        x, y, conf = detector.detect_frame(frame)
        frame_records.append({"f": idx, "x": x, "y": y, "conf": conf})
        idx += 1

    cap.release()

    bounces   = _find_bounces(frame_records)
    speed_kmh = _calc_speed(frame_records, fps)

    return {
        "frames":    frame_records,
        "bounces":   bounces,
        "speed_kmh": speed_kmh,
    }
