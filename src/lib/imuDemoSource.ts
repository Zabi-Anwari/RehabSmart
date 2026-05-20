/**
 * Synthetic IMU sample source for development without hardware.
 *
 * Simulates a single thigh-mounted sensor performing repetitive knee-flexion
 * cycles at ~0.5 Hz (one rep per ~2 s). Streams at 50 Hz to match the rate
 * the FastAPI knee/imu pipeline expects.
 */

import type { IMUSample } from "../types";

const SAMPLE_HZ      = 50;
const SAMPLE_PERIOD  = 1000 / SAMPLE_HZ;       // 20 ms
const REP_HZ         = 0.5;                     // one rep / 2 s
const GRAVITY_G      = 1.0;                     // 1 g baseline on one accel axis
const ACCEL_AMP      = 0.35;                    // ± g during motion
const GYRO_AMP_DPS   = 140;                     // ± deg/s during motion
const NOISE_ACCEL    = 0.02;
const NOISE_GYRO     = 1.5;

type Listener = (s: IMUSample) => void;

export interface IMUDemoController {
  stop(): void;
}

/**
 * Start a 50 Hz synthetic IMU stream. Returns a controller used to stop it.
 */
export function startDemoIMUSource(onSample: Listener): IMUDemoController {
  let t0: number | null = null;
  let stopped = false;

  const timer = window.setInterval(() => {
    if (stopped) return;
    const now = performance.now();
    if (t0 === null) t0 = now;
    const tMs = now - t0;
    const tSec = tMs / 1000;

    const phase = 2 * Math.PI * REP_HZ * tSec;

    const sample: IMUSample = {
      t: tMs,
      ax: ACCEL_AMP * Math.sin(phase)        + randn(NOISE_ACCEL),
      ay: GRAVITY_G + ACCEL_AMP * 0.2 * Math.cos(phase) + randn(NOISE_ACCEL),
      az: ACCEL_AMP * 0.5 * Math.cos(phase)  + randn(NOISE_ACCEL),
      gx: GYRO_AMP_DPS * Math.cos(phase)     + randn(NOISE_GYRO),
      gy: GYRO_AMP_DPS * 0.3 * Math.sin(phase) + randn(NOISE_GYRO),
      gz: GYRO_AMP_DPS * 0.15 * Math.sin(2 * phase) + randn(NOISE_GYRO),
    };
    onSample(sample);
  }, SAMPLE_PERIOD);

  return {
    stop() {
      stopped = true;
      window.clearInterval(timer);
    },
  };
}

// Box-Muller transform for normally-distributed noise.
function randn(scale: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return scale * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
