"""
Knee rehabilitation ML pipeline service.

Loads and caches models for:
  - IMU path  : uci_physical_therapy (exercise_type + quality)
  - Camera    : skeleton133 (exercise_type + correctness)
"""

import sys
import os
import logging
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np

# ── Add dataML to the Python path ─────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DATA_ML   = _REPO_ROOT / "dataML"
if str(_DATA_ML) not in sys.path:
    sys.path.insert(0, str(_DATA_ML))

from ml.common.feature_extraction import extract_features
from ml.common.inference_schema import (
    RehabPrediction, RehabMetrics, build_rehab_metrics, generate_warnings,
)
from ml.common.model_registry import load_model, load_label_encoder
from ml.common.config import Skeleton133Config
from ml.datasets.skeleton133.preprocess import extract_skeleton_features

logger = logging.getLogger(__name__)

_DEPLOY_MODELS_DIR  = _DATA_ML / "ml" / "models" / "deploy"  / "saved"
_RETRAIN_MODELS_DIR = _DATA_ML / "ml" / "models" / "retrain" / "saved"

_SKELETON_CFG = Skeleton133Config()


# ── Lazy model cache ──────────────────────────────────────────────────────────

class _ModelCache:
    def __init__(self) -> None:
        self._imu_ex_model:    Optional[object] = None
        self._imu_ex_le:       Optional[object] = None
        self._imu_qual_model:  Optional[object] = None
        self._imu_qual_le:     Optional[object] = None
        self._skel_ex_model:   Optional[object] = None
        self._skel_ex_le:      Optional[object] = None
        self._skel_corr_model: Optional[object] = None
        self._skel_corr_le:    Optional[object] = None

    def _load_imu(self, model_name: str) -> None:
        if self._imu_ex_model is not None:
            return
        logger.info("Loading UCI IMU models (%s)…", model_name)
        self._imu_ex_model   = load_model("uci_physical_therapy", "exercise_type", model_name, _RETRAIN_MODELS_DIR)
        self._imu_ex_le      = load_label_encoder("uci_physical_therapy", "exercise_type", _RETRAIN_MODELS_DIR)
        self._imu_qual_model = load_model("uci_physical_therapy", "quality",        model_name, _RETRAIN_MODELS_DIR)
        self._imu_qual_le    = load_label_encoder("uci_physical_therapy", "quality", _RETRAIN_MODELS_DIR)

    def _load_skeleton(self, model_name: str) -> None:
        if self._skel_ex_model is not None:
            return
        logger.info("Loading skeleton133 models (%s)…", model_name)
        self._skel_ex_model   = load_model("skeleton133", "exercise_type", model_name, _DEPLOY_MODELS_DIR)
        self._skel_ex_le      = load_label_encoder("skeleton133", "exercise_type", _DEPLOY_MODELS_DIR)
        self._skel_corr_model = load_model("skeleton133", "correctness",   model_name, _DEPLOY_MODELS_DIR)
        self._skel_corr_le    = load_label_encoder("skeleton133", "correctness", _DEPLOY_MODELS_DIR)

    def imu_models(self, model_name: str = "random_forest"):
        self._load_imu(model_name)
        return (
            self._imu_ex_model,   self._imu_ex_le,
            self._imu_qual_model, self._imu_qual_le,
        )

    def skeleton_models(self, model_name: str = "random_forest"):
        self._load_skeleton(model_name)
        return (
            self._skel_ex_model,   self._skel_ex_le,
            self._skel_corr_model, self._skel_corr_le,
        )


_cache = _ModelCache()


# ── IMU prediction ─────────────────────────────────────────────────────────────

def predict_imu(
    window: np.ndarray,   # (n_samples, n_channels)
    fs: float = 50.0,
    model_name: str = "random_forest",
) -> dict:
    ex_model, ex_le, qual_model, qual_le = _cache.imu_models(model_name)

    features = extract_features(window, fs=fs, include_freq=True).reshape(1, -1)

    ex_idx   = ex_model.predict(features)[0]
    ex_label = ex_le.inverse_transform([ex_idx])[0]
    ex_proba = {}
    if hasattr(ex_model, "predict_proba"):
        proba = ex_model.predict_proba(features)[0]
        ex_proba = dict(zip(ex_le.classes_, proba.tolist()))
        ex_conf  = float(proba[ex_idx])
    else:
        ex_conf = 1.0

    qual_idx   = qual_model.predict(features)[0]
    qual_label = qual_le.inverse_transform([qual_idx])[0]
    qual_proba = {}
    if hasattr(qual_model, "predict_proba"):
        proba = qual_model.predict_proba(features)[0]
        qual_proba = dict(zip(qual_le.classes_, proba.tolist()))
        qual_conf  = float(proba[qual_idx])
    else:
        qual_conf = 1.0

    metrics  = build_rehab_metrics(window)
    warnings = generate_warnings(qual_label, metrics)

    return {
        "exercise_type":       ex_label,
        "exercise_confidence": ex_conf,
        "quality_label":       qual_label,
        "quality_confidence":  qual_conf,
        "rehab_metrics": {
            "movement_intensity":       metrics.movement_intensity,
            "smoothness":               metrics.smoothness,
            "stability":                metrics.stability,
            "estimated_range_of_motion":metrics.estimated_range_of_motion,
            "repetition_count":         metrics.repetition_count,
            "exercise_duration_s":      metrics.exercise_duration_s,
        },
        "warnings":        warnings,
        "exercise_proba":  ex_proba,
        "quality_proba":   qual_proba,
    }


# ── Skeleton prediction ────────────────────────────────────────────────────────

def predict_skeleton(
    frames: np.ndarray,   # (n_frames, 26, 3)
    model_name: str = "random_forest",
) -> dict:
    ex_model, ex_le, corr_model, corr_le = _cache.skeleton_models(model_name)

    features = extract_skeleton_features(frames, _SKELETON_CFG).reshape(1, -1)

    ex_idx   = ex_model.predict(features)[0]
    ex_label = ex_le.inverse_transform([ex_idx])[0]
    ex_proba = {}
    if hasattr(ex_model, "predict_proba"):
        proba    = ex_model.predict_proba(features)[0]
        ex_proba = dict(zip(ex_le.classes_, proba.tolist()))
        ex_conf  = float(proba[ex_idx])
    else:
        ex_conf = 1.0

    corr_idx   = corr_model.predict(features)[0]
    corr_raw   = corr_le.inverse_transform([corr_idx])[0]
    corr_label = "correct" if str(corr_raw) in ("1", "correct") else "incorrect"
    corr_proba = {}
    if hasattr(corr_model, "predict_proba"):
        proba      = corr_model.predict_proba(features)[0]
        corr_proba = dict(zip([str(c) for c in corr_le.classes_], proba.tolist()))
        corr_conf  = float(proba[corr_idx])
    else:
        corr_conf = 1.0

    warnings = []
    if corr_label == "incorrect":
        warnings.append("Movement pattern classified as incorrect — check form.")

    return {
        "exercise_type":           ex_label,
        "exercise_confidence":     ex_conf,
        "correctness":             corr_label,
        "correctness_confidence":  corr_conf,
        "warnings":                warnings,
        "exercise_proba":          ex_proba,
        "correctness_proba":       corr_proba,
    }


# ── Combined (fuse both modalities) ───────────────────────────────────────────

def predict_combined(
    imu_window: Optional[np.ndarray] = None,
    skeleton_frames: Optional[np.ndarray] = None,
    imu_fs: float = 50.0,
    model_name: str = "random_forest",
) -> dict:
    imu_result  = predict_imu(imu_window, fs=imu_fs, model_name=model_name)      if imu_window      is not None else None
    skel_result = predict_skeleton(skeleton_frames, model_name=model_name)        if skeleton_frames is not None else None

    # Simple fusion: average probabilities when both available
    fused_exercise = None
    fused_conf     = None
    if imu_result and skel_result:
        imu_proba  = imu_result["exercise_proba"]
        skel_proba = skel_result["exercise_proba"]
        all_labels = set(imu_proba) | set(skel_proba)
        fused = {
            lbl: (imu_proba.get(lbl, 0.0) + skel_proba.get(lbl, 0.0)) / 2.0
            for lbl in all_labels
        }
        fused_exercise = max(fused, key=lambda k: fused[k])
        fused_conf     = fused[fused_exercise]

    return {
        "imu":              imu_result,
        "skeleton":         skel_result,
        "fused_exercise_type": fused_exercise,
        "fused_confidence":    fused_conf,
    }
