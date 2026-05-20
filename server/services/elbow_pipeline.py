"""
Elbow rehabilitation ML pipeline service.

Loads and caches models for:
  - IMU/MoCap path : elbow (exercise_type + correctness, 108-channel input)
  - Camera         : skeleton133 (exercise_type + correctness)

The skeleton path reuses the same skeleton133 models that the knee pipeline uses,
since the model was trained on a whole-body 26-joint skeleton.
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

from ml.common.inference_schema import build_rehab_metrics, generate_warnings
from ml.common.model_registry import load_model, load_label_encoder
from ml.common.config import Skeleton133Config
from ml.datasets.skeleton133.preprocess import extract_skeleton_features
from ml.datasets.elbow.preprocess import _extract_mocap_features as _extract_elbow_features

logger = logging.getLogger(__name__)

_DEPLOY_MODELS_DIR  = _DATA_ML / "ml" / "models" / "deploy"  / "saved"
_RETRAIN_MODELS_DIR = _DATA_ML / "ml" / "models" / "retrain" / "saved"

_SKELETON_CFG = Skeleton133Config()


class _ModelCache:
    def __init__(self) -> None:
        self._imu_ex_model:    Optional[object] = None
        self._imu_ex_le:       Optional[object] = None
        self._imu_corr_model:  Optional[object] = None
        self._imu_corr_le:     Optional[object] = None
        self._skel_ex_model:   Optional[object] = None
        self._skel_ex_le:      Optional[object] = None
        self._skel_corr_model: Optional[object] = None
        self._skel_corr_le:    Optional[object] = None

    def _load_imu(self, model_name: str) -> None:
        if self._imu_ex_model is not None:
            return
        logger.info("Loading elbow IMU models (%s)…", model_name)
        # Exercise classifier lives in deploy/, correctness lives in retrain/
        self._imu_ex_model   = load_model("elbow", "exercise_type", model_name, _DEPLOY_MODELS_DIR)
        self._imu_ex_le      = load_label_encoder("elbow", "exercise_type", _DEPLOY_MODELS_DIR)
        self._imu_corr_model = load_model("elbow", "correctness",  model_name, _RETRAIN_MODELS_DIR)
        self._imu_corr_le    = load_label_encoder("elbow", "correctness", _RETRAIN_MODELS_DIR)

    def _load_skeleton(self, model_name: str) -> None:
        if self._skel_ex_model is not None:
            return
        logger.info("Loading skeleton133 models for elbow (%s)…", model_name)
        self._skel_ex_model   = load_model("skeleton133", "exercise_type", model_name, _DEPLOY_MODELS_DIR)
        self._skel_ex_le      = load_label_encoder("skeleton133", "exercise_type", _DEPLOY_MODELS_DIR)
        self._skel_corr_model = load_model("skeleton133", "correctness",   model_name, _DEPLOY_MODELS_DIR)
        self._skel_corr_le    = load_label_encoder("skeleton133", "correctness", _DEPLOY_MODELS_DIR)

    def imu_models(self, model_name: str = "random_forest"):
        self._load_imu(model_name)
        return (
            self._imu_ex_model,   self._imu_ex_le,
            self._imu_corr_model, self._imu_corr_le,
        )

    def skeleton_models(self, model_name: str = "random_forest"):
        self._load_skeleton(model_name)
        return (
            self._skel_ex_model,   self._skel_ex_le,
            self._skel_corr_model, self._skel_corr_le,
        )


_cache = _ModelCache()


def predict_imu(
    window: np.ndarray,
    fs: float = 100.0,
    model_name: str = "random_forest",
) -> dict:
    ex_model, ex_le, corr_model, corr_le = _cache.imu_models(model_name)

    # Elbow model was trained on 7-stat features × 108 channels = 756 features
    features = _extract_elbow_features(window).reshape(1, -1)

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

    metrics  = build_rehab_metrics(window)
    warnings = generate_warnings(corr_label, metrics)
    if corr_label == "incorrect":
        warnings.append("Elbow movement marked incorrect — check speed/form.")

    return {
        "exercise_type":          ex_label,
        "exercise_confidence":    ex_conf,
        "correctness":            corr_label,
        "correctness_confidence": corr_conf,
        "rehab_metrics": {
            "movement_intensity":        metrics.movement_intensity,
            "smoothness":                metrics.smoothness,
            "stability":                 metrics.stability,
            "estimated_range_of_motion": metrics.estimated_range_of_motion,
            "repetition_count":          metrics.repetition_count,
            "exercise_duration_s":       metrics.exercise_duration_s,
        },
        "warnings":           warnings,
        "exercise_proba":     ex_proba,
        "correctness_proba":  corr_proba,
    }


def predict_skeleton(
    frames: np.ndarray,
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
        warnings.append("Elbow movement pattern classified as incorrect — check form.")

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
        # Only fuse on overlapping labels (elbow IMU and skeleton133 use different label sets)
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
