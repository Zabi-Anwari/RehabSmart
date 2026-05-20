"""
Leg rehabilitation ML pipeline service.

Loads and caches models for:
  - IMU path  : dataset11 (exercise_type, 48 channels) + hugadb (activity_type, 36 channels)
  - Camera    : skeleton133 (exercise_type + correctness)

The skeleton path reuses the same skeleton133 models since they were trained on a
whole-body 26-joint skeleton.
"""

import sys
import logging
from pathlib import Path
from typing import Optional

import numpy as np

# ── Add dataML to the Python path ─────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_DATA_ML   = _REPO_ROOT / "dataML"
if str(_DATA_ML) not in sys.path:
    sys.path.insert(0, str(_DATA_ML))

from ml.common.feature_extraction import extract_features
from ml.common.inference_schema import build_rehab_metrics, generate_warnings
from ml.common.model_registry import load_model, load_label_encoder
from ml.common.signal_processing import butter_lowpass
from ml.common.config import Skeleton133Config
from ml.datasets.skeleton133.preprocess import extract_skeleton_features

logger = logging.getLogger(__name__)

_DEPLOY_MODELS_DIR  = _DATA_ML / "ml" / "models" / "deploy"  / "saved"
_RETRAIN_MODELS_DIR = _DATA_ML / "ml" / "models" / "retrain" / "saved"

_SKELETON_CFG = Skeleton133Config()

_DATASET11_CHANNELS = 48
_HUGADB_CHANNELS    = 36


class _ModelCache:
    def __init__(self) -> None:
        self._d11_model:        Optional[object] = None
        self._d11_le:           Optional[object] = None
        self._hugadb_model:     Optional[object] = None
        self._hugadb_le:        Optional[object] = None
        self._skel_ex_model:    Optional[object] = None
        self._skel_ex_le:       Optional[object] = None
        self._skel_corr_model:  Optional[object] = None
        self._skel_corr_le:     Optional[object] = None

    def _load_dataset11(self, model_name: str) -> None:
        if self._d11_model is not None:
            return
        logger.info("Loading dataset11 model (%s)…", model_name)
        self._d11_model = load_model("dataset11", "exercise_type", model_name, _RETRAIN_MODELS_DIR)
        self._d11_le    = load_label_encoder("dataset11", "exercise_type", _RETRAIN_MODELS_DIR)

    def _load_hugadb(self, model_name: str) -> None:
        if self._hugadb_model is not None:
            return
        logger.info("Loading hugadb activity model (%s)…", model_name)
        self._hugadb_model = load_model("hugadb", "activity_type", model_name, _DEPLOY_MODELS_DIR)
        self._hugadb_le    = load_label_encoder("hugadb", "activity_type", _DEPLOY_MODELS_DIR)

    def _load_skeleton(self, model_name: str) -> None:
        if self._skel_ex_model is not None:
            return
        logger.info("Loading skeleton133 models for leg (%s)…", model_name)
        self._skel_ex_model   = load_model("skeleton133", "exercise_type", model_name, _DEPLOY_MODELS_DIR)
        self._skel_ex_le      = load_label_encoder("skeleton133", "exercise_type", _DEPLOY_MODELS_DIR)
        self._skel_corr_model = load_model("skeleton133", "correctness",   model_name, _DEPLOY_MODELS_DIR)
        self._skel_corr_le    = load_label_encoder("skeleton133", "correctness", _DEPLOY_MODELS_DIR)

    def dataset11(self, model_name: str = "random_forest"):
        self._load_dataset11(model_name)
        return self._d11_model, self._d11_le

    def hugadb(self, model_name: str = "random_forest"):
        self._load_hugadb(model_name)
        return self._hugadb_model, self._hugadb_le

    def skeleton_models(self, model_name: str = "random_forest"):
        self._load_skeleton(model_name)
        return (
            self._skel_ex_model,   self._skel_ex_le,
            self._skel_corr_model, self._skel_corr_le,
        )


_cache = _ModelCache()


def _predict_with_model(model, le, features) -> tuple[str, float, dict]:
    idx   = model.predict(features)[0]
    label = le.inverse_transform([idx])[0]
    proba = {}
    if hasattr(model, "predict_proba"):
        p = model.predict_proba(features)[0]
        proba = dict(zip([str(c) for c in le.classes_], p.tolist()))
        conf  = float(p[idx])
    else:
        conf = 1.0
    return str(label), conf, proba


def predict_imu(
    window: np.ndarray,
    fs: float = 100.0,
    model_name: str = "random_forest",
) -> dict:
    """
    Route to the correct model based on channel count:
      - 48 channels → dataset11 (exercise_type)
      - 36 channels → hugadb    (activity_type)
    """
    n_channels = window.shape[1]

    # dataset11 was trained on low-pass-filtered windows — replicate at inference
    if n_channels == _DATASET11_CHANNELS and len(window) >= 20:
        cutoff = min(20.0, 0.45 * fs)
        try:
            window = butter_lowpass(window, cutoff_hz=cutoff, fs=fs)
        except Exception:
            pass  # filtfilt can fail on very short windows; fall back to raw

    features = extract_features(window, fs=fs, include_freq=True).reshape(1, -1)

    if n_channels == _DATASET11_CHANNELS:
        model, le = _cache.dataset11(model_name)
        task = "exercise_type"
        dataset = "dataset11"
    elif n_channels == _HUGADB_CHANNELS:
        model, le = _cache.hugadb(model_name)
        task = "activity_type"
        dataset = "hugadb"
    else:
        raise ValueError(
            f"Unsupported leg IMU channel count: {n_channels}. "
            f"Expected {_DATASET11_CHANNELS} (dataset11) or {_HUGADB_CHANNELS} (hugadb)."
        )

    label, conf, proba = _predict_with_model(model, le, features)
    metrics = build_rehab_metrics(window)
    warnings = generate_warnings(label, metrics)

    return {
        "dataset":             dataset,
        "task":                task,
        "exercise_type":       label,
        "exercise_confidence": conf,
        "exercise_proba":      proba,
        "rehab_metrics": {
            "movement_intensity":        metrics.movement_intensity,
            "smoothness":                metrics.smoothness,
            "stability":                 metrics.stability,
            "estimated_range_of_motion": metrics.estimated_range_of_motion,
            "repetition_count":          metrics.repetition_count,
            "exercise_duration_s":       metrics.exercise_duration_s,
        },
        "warnings": warnings,
    }


def predict_skeleton(
    frames: np.ndarray,
    model_name: str = "random_forest",
) -> dict:
    ex_model, ex_le, corr_model, corr_le = _cache.skeleton_models(model_name)

    features = extract_skeleton_features(frames, _SKELETON_CFG).reshape(1, -1)

    ex_label, ex_conf, ex_proba = _predict_with_model(ex_model, ex_le, features)

    corr_idx  = corr_model.predict(features)[0]
    corr_raw  = corr_le.inverse_transform([corr_idx])[0]
    corr_label = "correct" if str(corr_raw) in ("1", "correct") else "incorrect"
    corr_proba = {}
    if hasattr(corr_model, "predict_proba"):
        p = corr_model.predict_proba(features)[0]
        corr_proba = dict(zip([str(c) for c in corr_le.classes_], p.tolist()))
        corr_conf  = float(p[corr_idx])
    else:
        corr_conf = 1.0

    warnings = []
    if corr_label == "incorrect":
        warnings.append("Leg movement pattern classified as incorrect — check form.")

    return {
        "exercise_type":          ex_label,
        "exercise_confidence":    ex_conf,
        "correctness":            corr_label,
        "correctness_confidence": corr_conf,
        "warnings":               warnings,
        "exercise_proba":         ex_proba,
        "correctness_proba":      corr_proba,
    }


def predict_combined(
    imu_window: Optional[np.ndarray] = None,
    skeleton_frames: Optional[np.ndarray] = None,
    imu_fs: float = 100.0,
    model_name: str = "random_forest",
) -> dict:
    imu_result  = predict_imu(imu_window, fs=imu_fs, model_name=model_name)      if imu_window      is not None else None
    skel_result = predict_skeleton(skeleton_frames, model_name=model_name)        if skeleton_frames is not None else None

    fused_exercise = None
    fused_conf     = None
    if imu_result and skel_result:
        imu_proba  = imu_result["exercise_proba"]
        skel_proba = skel_result["exercise_proba"]
        common = set(imu_proba) & set(skel_proba)
        if common:
            fused = {lbl: (imu_proba[lbl] + skel_proba[lbl]) / 2.0 for lbl in common}
            fused_exercise = max(fused, key=lambda k: fused[k])
            fused_conf     = fused[fused_exercise]

    return {
        "imu":                 imu_result,
        "skeleton":            skel_result,
        "fused_exercise_type": fused_exercise,
        "fused_confidence":    fused_conf,
    }
