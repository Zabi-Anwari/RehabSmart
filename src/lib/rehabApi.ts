/**
 * Typed HTTP client for the RehabSmart FastAPI server (localhost:8000).
 */

const BASE_URL = "http://localhost:8000";

export interface RehabMetrics {
  movement_intensity: number | null;
  smoothness: number | null;
  stability: number | null;
  estimated_range_of_motion: number | null;
  repetition_count: number | null;
  exercise_duration_s: number | null;
}

// ── Knee ──────────────────────────────────────────────────────────────────────

export interface IMUPrediction {
  exercise_type: string;
  exercise_confidence: number;
  quality_label: string;
  quality_confidence: number;
  rehab_metrics: RehabMetrics;
  warnings: string[];
  exercise_proba: Record<string, number>;
  quality_proba: Record<string, number>;
}

export interface SkeletonPrediction {
  exercise_type: string;
  exercise_confidence: number;
  correctness: "correct" | "incorrect";
  correctness_confidence: number;
  warnings: string[];
  exercise_proba: Record<string, number>;
  correctness_proba: Record<string, number>;
}

export interface CombinedPrediction {
  imu: IMUPrediction | null;
  skeleton: SkeletonPrediction | null;
  fused_exercise_type: string | null;
  fused_confidence: number | null;
}

// ── Elbow ─────────────────────────────────────────────────────────────────────

export interface ElbowIMUPrediction {
  exercise_type: string;
  exercise_confidence: number;
  correctness: "correct" | "incorrect";
  correctness_confidence: number;
  rehab_metrics: RehabMetrics;
  warnings: string[];
  exercise_proba: Record<string, number>;
  correctness_proba: Record<string, number>;
}

export interface ElbowCombinedPrediction {
  imu: ElbowIMUPrediction | null;
  skeleton: SkeletonPrediction | null;
  fused_exercise_type: string | null;
  fused_confidence: number | null;
}

// ── Leg ───────────────────────────────────────────────────────────────────────

export interface LegIMUPrediction {
  dataset: "dataset11" | "hugadb" | string;
  task: "exercise_type" | "activity_type" | string;
  exercise_type: string;
  exercise_confidence: number;
  exercise_proba: Record<string, number>;
  rehab_metrics: RehabMetrics;
  warnings: string[];
}

export interface LegCombinedPrediction {
  imu: LegIMUPrediction | null;
  skeleton: SkeletonPrediction | null;
  fused_exercise_type: string | null;
  fused_confidence: number | null;
}

// ── Transport ─────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export const rehabApi = {
  knee: {
    predictIMU: (window: number[][], fs = 50, model_name = "random_forest") =>
      post<IMUPrediction>("/api/knee/imu/predict", { window, fs, model_name }),

    predictSingleIMU: (window: number[][], fs = 50) =>
      post<IMUPrediction>("/api/knee/imu/single", { window, fs }),

    predictSkeleton: (frames: number[][][], model_name = "random_forest") =>
      post<SkeletonPrediction>("/api/knee/skeleton/predict", { frames, model_name }),

    predictCombined: (params: {
      imu_window?: number[][];
      skeleton_frames?: number[][][];
      imu_fs?: number;
      model_name?: string;
    }) => post<CombinedPrediction>("/api/knee/combined/predict", params),

    health: () => fetch(`${BASE_URL}/api/knee/health`).then((r) => r.json()),
  },

  elbow: {
    predictIMU: (window: number[][], fs = 100, model_name = "random_forest") =>
      post<ElbowIMUPrediction>("/api/elbow/imu/predict", { window, fs, model_name }),

    predictSingleIMU: (window: number[][], fs = 50) =>
      post<IMUPrediction>("/api/elbow/imu/single", { window, fs }),

    predictSkeleton: (frames: number[][][], model_name = "random_forest") =>
      post<SkeletonPrediction>("/api/elbow/skeleton/predict", { frames, model_name }),

    predictCombined: (params: {
      imu_window?: number[][];
      skeleton_frames?: number[][][];
      imu_fs?: number;
      model_name?: string;
    }) => post<ElbowCombinedPrediction>("/api/elbow/combined/predict", params),

    health: () => fetch(`${BASE_URL}/api/elbow/health`).then((r) => r.json()),
  },

  leg: {
    predictIMU: (window: number[][], fs = 100, model_name = "random_forest") =>
      post<LegIMUPrediction>("/api/leg/imu/predict", { window, fs, model_name }),

    predictSingleIMU: (window: number[][], fs = 50) =>
      post<IMUPrediction>("/api/leg/imu/single", { window, fs }),

    predictSkeleton: (frames: number[][][], model_name = "random_forest") =>
      post<SkeletonPrediction>("/api/leg/skeleton/predict", { frames, model_name }),

    predictCombined: (params: {
      imu_window?: number[][];
      skeleton_frames?: number[][][];
      imu_fs?: number;
      model_name?: string;
    }) => post<LegCombinedPrediction>("/api/leg/combined/predict", params),

    health: () => fetch(`${BASE_URL}/api/leg/health`).then((r) => r.json()),
  },
};

export type RehabModuleType = "knee" | "leg" | "elbow";
