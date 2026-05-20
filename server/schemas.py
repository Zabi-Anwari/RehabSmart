"""Pydantic request/response schemas for the RehabSmart API."""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Shared metrics ────────────────────────────────────────────────────────────

class RehabMetricsOut(BaseModel):
    movement_intensity: Optional[float] = None
    smoothness: Optional[float] = None
    stability: Optional[float] = None
    estimated_range_of_motion: Optional[float] = None
    repetition_count: Optional[int] = None
    exercise_duration_s: Optional[float] = None


# ── Knee — IMU (UCI Physical Therapy) ─────────────────────────────────────────

class IMUPredictRequest(BaseModel):
    """
    Raw IMU window for knee rehabilitation inference.
    window: list of samples, each sample is a list of channel values.
    Expected shape: (50, 45)  — 50 samples at 50 Hz, 45 IMU channels.
    """
    window: List[List[float]] = Field(..., description="IMU window (n_samples, n_channels)")
    fs: float = Field(default=50.0, description="Sampling rate in Hz")
    model_name: str = Field(default="random_forest")


class IMUPredictResponse(BaseModel):
    exercise_type: str
    exercise_confidence: float
    quality_label: str
    quality_confidence: float
    rehab_metrics: RehabMetricsOut
    warnings: List[str]
    exercise_proba: dict
    quality_proba: dict


# ── Shared skeleton (camera) ──────────────────────────────────────────────────

class SkeletonPredictRequest(BaseModel):
    """
    Skeleton frame sequence — used by knee, leg and elbow.
    frames: list of frames, each frame is 26 joints × 3 coords.
    Expected shape: (30, 26, 3)  — 30 frames at 30 fps.
    """
    frames: List[List[List[float]]] = Field(..., description="Skeleton frames (n_frames, 26, 3)")
    model_name: str = Field(default="random_forest")


class SkeletonPredictResponse(BaseModel):
    exercise_type: str
    exercise_confidence: float
    correctness: str           # "correct" | "incorrect"
    correctness_confidence: float
    warnings: List[str]
    exercise_proba: dict
    correctness_proba: dict


# ── Knee combined ─────────────────────────────────────────────────────────────

class CombinedPredictRequest(BaseModel):
    imu_window: Optional[List[List[float]]] = Field(default=None)
    skeleton_frames: Optional[List[List[List[float]]]] = Field(default=None)
    imu_fs: float = Field(default=50.0)
    model_name: str = Field(default="random_forest")


class CombinedPredictResponse(BaseModel):
    imu: Optional[IMUPredictResponse] = None
    skeleton: Optional[SkeletonPredictResponse] = None
    fused_exercise_type: Optional[str] = None
    fused_confidence: Optional[float] = None


# ── Elbow — IMU/MoCap (ULTra-MoCap, 108 channels) ─────────────────────────────

class IMUElbowPredictRequest(BaseModel):
    """
    Elbow MoCap-like window.
    Expected shape: (n_samples, 108) at 100 Hz.
    """
    window: List[List[float]] = Field(..., description="Elbow window (n_samples, 108)")
    fs: float = Field(default=100.0)
    model_name: str = Field(default="random_forest")


class IMUElbowPredictResponse(BaseModel):
    exercise_type: str
    exercise_confidence: float
    correctness: str
    correctness_confidence: float
    rehab_metrics: RehabMetricsOut
    warnings: List[str]
    exercise_proba: dict
    correctness_proba: dict


class ElbowCombinedPredictRequest(BaseModel):
    imu_window: Optional[List[List[float]]] = Field(default=None)
    skeleton_frames: Optional[List[List[List[float]]]] = Field(default=None)
    imu_fs: float = Field(default=100.0)
    model_name: str = Field(default="random_forest")


class ElbowCombinedPredictResponse(BaseModel):
    imu: Optional[IMUElbowPredictResponse] = None
    skeleton: Optional[SkeletonPredictResponse] = None
    fused_exercise_type: Optional[str] = None
    fused_confidence: Optional[float] = None


# ── Leg — IMU (dataset11 OR hugadb, 48 or 36 channels) ────────────────────────

class IMULegPredictRequest(BaseModel):
    """
    Leg IMU window. Channel count picks the routed model:
      - 48 channels → dataset11 exercise_type (rehab exercises)
      - 36 channels → hugadb    activity_type (gait activities)
    """
    window: List[List[float]] = Field(..., description="Leg IMU window (n_samples, 48 | 36)")
    fs: float = Field(default=100.0)
    model_name: str = Field(default="random_forest")


class IMULegPredictResponse(BaseModel):
    dataset: str               # "dataset11" | "hugadb"
    task: str                  # "exercise_type" | "activity_type"
    exercise_type: str         # label name (re-used field for both tasks)
    exercise_confidence: float
    exercise_proba: dict
    rehab_metrics: RehabMetricsOut
    warnings: List[str]


class LegCombinedPredictRequest(BaseModel):
    imu_window: Optional[List[List[float]]] = Field(default=None)
    skeleton_frames: Optional[List[List[List[float]]]] = Field(default=None)
    imu_fs: float = Field(default=100.0)
    model_name: str = Field(default="random_forest")


class LegCombinedPredictResponse(BaseModel):
    imu: Optional[IMULegPredictResponse] = None
    skeleton: Optional[SkeletonPredictResponse] = None
    fused_exercise_type: Optional[str] = None
    fused_confidence: Optional[float] = None
