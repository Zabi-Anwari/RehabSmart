"""Elbow rehabilitation API routes."""

import logging
import numpy as np
from fastapi import APIRouter, HTTPException

from schemas import (
    IMUPredictRequest, IMUPredictResponse,
    IMUElbowPredictRequest, IMUElbowPredictResponse,
    SkeletonPredictRequest, SkeletonPredictResponse,
    ElbowCombinedPredictRequest, ElbowCombinedPredictResponse,
    RehabMetricsOut,
)
from services.elbow_pipeline import predict_imu, predict_skeleton, predict_combined
from ml.common.inference_schema import predict_single_imu as _predict_single_imu

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/elbow", tags=["elbow"])

_IMU_EXPECTED_CHANNELS = 108
_SKEL_EXPECTED_JOINTS  = 26
_SKEL_EXPECTED_COORDS  = 3


@router.post("/imu/single", response_model=IMUPredictResponse)
async def imu_single_predict(req: IMUPredictRequest):
    """Single 6-channel IMU window — rule-based quality assessment, no MoCap suit required."""
    window = np.array(req.window, dtype=np.float32)

    if window.ndim != 2:
        raise HTTPException(400, "window must be 2-D (n_samples, 6)")
    if window.shape[1] != 6:
        raise HTTPException(
            400,
            f"Single-sensor endpoint expects 6 channels (ax/ay/az/gx/gy/gz), got {window.shape[1]}."
        )
    if len(window) < 5:
        raise HTTPException(400, "Need at least 5 samples.")

    try:
        result = _predict_single_imu(window, fs=req.fs)
    except Exception as exc:
        logger.exception("Single IMU prediction failed")
        raise HTTPException(500, f"Inference error: {exc}") from exc

    return IMUPredictResponse(
        exercise_type=result["exercise_type"],
        exercise_confidence=result["exercise_confidence"],
        quality_label=result["quality_label"],
        quality_confidence=result["quality_confidence"],
        rehab_metrics=RehabMetricsOut(**result["rehab_metrics"]),
        warnings=result["warnings"],
        exercise_proba=result["exercise_proba"],
        quality_proba=result["quality_proba"],
    )


@router.post("/imu/predict", response_model=IMUElbowPredictResponse)
async def imu_predict(req: IMUElbowPredictRequest):
    window = np.array(req.window, dtype=np.float32)

    if window.ndim != 2:
        raise HTTPException(400, "window must be 2-D (n_samples, n_channels)")
    if window.shape[1] != _IMU_EXPECTED_CHANNELS:
        raise HTTPException(
            400,
            f"Expected {_IMU_EXPECTED_CHANNELS} channels for elbow, got {window.shape[1]}."
        )
    if len(window) < 5:
        raise HTTPException(400, "Need at least 5 samples for inference.")

    try:
        result = predict_imu(window, fs=req.fs, model_name=req.model_name)
    except Exception as exc:
        logger.exception("Elbow IMU prediction failed")
        raise HTTPException(500, f"Inference error: {exc}") from exc

    return IMUElbowPredictResponse(
        exercise_type=result["exercise_type"],
        exercise_confidence=result["exercise_confidence"],
        correctness=result["correctness"],
        correctness_confidence=result["correctness_confidence"],
        rehab_metrics=RehabMetricsOut(**result["rehab_metrics"]),
        warnings=result["warnings"],
        exercise_proba=result["exercise_proba"],
        correctness_proba=result["correctness_proba"],
    )


@router.post("/skeleton/predict", response_model=SkeletonPredictResponse)
async def skeleton_predict(req: SkeletonPredictRequest):
    frames = np.array(req.frames, dtype=np.float32)

    if frames.ndim != 3:
        raise HTTPException(400, "frames must be 3-D (n_frames, 26, 3)")
    if frames.shape[1] != _SKEL_EXPECTED_JOINTS or frames.shape[2] != _SKEL_EXPECTED_COORDS:
        raise HTTPException(400, f"Expected (n_frames, 26, 3), got {frames.shape}.")
    if len(frames) < 5:
        raise HTTPException(400, "Need at least 5 frames for inference.")

    try:
        result = predict_skeleton(frames, model_name=req.model_name)
    except Exception as exc:
        logger.exception("Elbow skeleton prediction failed")
        raise HTTPException(500, f"Inference error: {exc}") from exc

    return SkeletonPredictResponse(
        exercise_type=result["exercise_type"],
        exercise_confidence=result["exercise_confidence"],
        correctness=result["correctness"],
        correctness_confidence=result["correctness_confidence"],
        warnings=result["warnings"],
        exercise_proba=result["exercise_proba"],
        correctness_proba=result["correctness_proba"],
    )


@router.post("/combined/predict", response_model=ElbowCombinedPredictResponse)
async def combined_predict(req: ElbowCombinedPredictRequest):
    imu_window      = np.array(req.imu_window,      dtype=np.float32) if req.imu_window      else None
    skeleton_frames = np.array(req.skeleton_frames, dtype=np.float32) if req.skeleton_frames else None

    if imu_window is None and skeleton_frames is None:
        raise HTTPException(400, "Provide at least imu_window or skeleton_frames.")

    try:
        result = predict_combined(
            imu_window=imu_window,
            skeleton_frames=skeleton_frames,
            imu_fs=req.imu_fs,
            model_name=req.model_name,
        )
    except Exception as exc:
        logger.exception("Elbow combined prediction failed")
        raise HTTPException(500, f"Inference error: {exc}") from exc

    imu_out  = None
    skel_out = None

    if result["imu"]:
        r = result["imu"]
        imu_out = IMUElbowPredictResponse(
            exercise_type=r["exercise_type"],
            exercise_confidence=r["exercise_confidence"],
            correctness=r["correctness"],
            correctness_confidence=r["correctness_confidence"],
            rehab_metrics=RehabMetricsOut(**r["rehab_metrics"]),
            warnings=r["warnings"],
            exercise_proba=r["exercise_proba"],
            correctness_proba=r["correctness_proba"],
        )

    if result["skeleton"]:
        r = result["skeleton"]
        skel_out = SkeletonPredictResponse(
            exercise_type=r["exercise_type"],
            exercise_confidence=r["exercise_confidence"],
            correctness=r["correctness"],
            correctness_confidence=r["correctness_confidence"],
            warnings=r["warnings"],
            exercise_proba=r["exercise_proba"],
            correctness_proba=r["correctness_proba"],
        )

    return ElbowCombinedPredictResponse(
        imu=imu_out,
        skeleton=skel_out,
        fused_exercise_type=result["fused_exercise_type"],
        fused_confidence=result["fused_confidence"],
    )


@router.get("/health")
async def health():
    return {"status": "ok", "module": "elbow"}
