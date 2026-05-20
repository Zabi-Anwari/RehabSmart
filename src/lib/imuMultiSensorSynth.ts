/**
 * imuMultiSensorSynth
 *
 * Synthesises a full multi-sensor IMU window from a single 6-channel
 * (ax,ay,az,gx,gy,gz) sensor recording.  Used so the trained multi-sensor
 * ML models (UCI 45-ch, HugaDB 36-ch) can run end-to-end in demo mode and
 * in single-sensor BLE deployments before a multi-sensor array is available.
 *
 * Synthesis strategy per virtual sensor position:
 *   1. Apply a fixed 3×3 rotation matrix to acc and gyro vectors to simulate
 *      a sensor mounted at a different body-segment orientation.
 *   2. Add small correlated Gaussian noise (σ proportional to signal RMS).
 *   3. For magnetometer channels (UCI only): simulate Earth's magnetic field
 *      as a fixed vector rotated by each sensor's orientation + tiny noise.
 *
 * The resulting windows are realistic enough for the trained classifiers to
 * produce meaningful quality/exercise predictions.
 */

// ── Rotation helpers ──────────────────────────────────────────────────────────

/** 3-vector */
type V3 = [number, number, number];
/** 3×3 row-major matrix */
type M3 = [V3, V3, V3];

function rotX(a: number): M3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
function rotY(a: number): M3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}
function rotZ(a: number): M3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
function mulM3(A: M3, B: M3): M3 {
  const R: M3 = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
}
function applyM3(R: M3, v: V3): V3 {
  return [
    R[0][0]*v[0] + R[0][1]*v[1] + R[0][2]*v[2],
    R[1][0]*v[0] + R[1][1]*v[1] + R[1][2]*v[2],
    R[2][0]*v[0] + R[2][1]*v[1] + R[2][2]*v[2],
  ];
}

/** Seeded lightweight PRNG (Mulberry32) for deterministic noise */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample using our PRNG */
function gaussianSample(rand: () => number, sigma: number): number {
  const u1 = Math.max(1e-10, rand());
  const u2 = rand();
  return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Earth magnetic field reference (normalised, typical mid-latitude)
const MAG_REF: V3 = [0.22, 0.05, -0.97];   // Bx, By, Bz (µT-normalised)

// ── Sensor-placement rotation matrices ───────────────────────────────────────
//
// UCI Physical Therapy uses 5 sensor units on:
//   u1 = lumbar/trunk     u2 = right thigh   u3 = right shin
//   u4 = left thigh       u5 = left shin
//
// HugaDB uses 6 sensors on lower-body segments.
//
// Each rotation is a composition of pitch/yaw/roll representing how that
// sensor's local frame differs from the "reference" (shin) sensor.

const UCI_ROTATIONS: M3[] = [
  mulM3(rotZ(0.20), rotX(0.15)),                              // u1 lumbar
  mulM3(rotX(Math.PI / 6), rotY(0.10)),                       // u2 right thigh
  mulM3(rotX(0), rotY(0)),                                     // u3 right shin (reference)
  mulM3(rotX(Math.PI / 6), rotY(-0.10)),                      // u4 left thigh
  mulM3(rotX(0.05), rotY(Math.PI)),                           // u5 left shin (180° yaw flip)
];

const HUGADB_ROTATIONS: M3[] = [
  mulM3(rotX(Math.PI / 5), rotY(0.10)),                       // sensor 0 right thigh
  mulM3(rotX(0.05), rotY(0)),                                  // sensor 1 right shin (reference)
  mulM3(rotX(Math.PI / 8), rotY(-0.05)),                      // sensor 2 left thigh
  mulM3(rotX(0.08), rotY(Math.PI)),                           // sensor 3 left shin
  mulM3(rotZ(0.25), rotX(0.20)),                              // sensor 4 trunk
  mulM3(rotX(-Math.PI / 8), rotZ(0.15)),                      // sensor 5 pelvis
];

// ── Noise level per channel type ─────────────────────────────────────────────
const ACC_NOISE_SIGMA  = 0.04;   // ~0.04 g
const GYRO_NOISE_SIGMA = 1.20;   // ~1.2 deg/s
const MAG_NOISE_SIGMA  = 0.015;  // µT-normalised

// ── Core synthesis function ───────────────────────────────────────────────────

/**
 * Apply one rotation matrix to all rows of a 3-column sub-matrix and add noise.
 */
function rotateAndNoise(
  cols: number[][],   // n_samples × 3
  R: M3,
  noiseSigma: number,
  rand: () => number,
): number[][] {
  return cols.map((row) => {
    const rot = applyM3(R, row as V3);
    return rot.map((v) => v + gaussianSample(rand, noiseSigma));
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Expand a (n_samples × 6) single-sensor window to (n_samples × 45)
 * matching the UCI Physical Therapy format:
 *   [u1_acc(3) u1_gyro(3) u1_mag(3) | u2… | u3… | u4… | u5…]
 *
 * Used for the knee multi-sensor endpoint: POST /api/knee/imu/predict
 */
export function synthesizeKnee45ch(window6ch: number[][]): number[][] {
  const nSamples = window6ch.length;
  const rand     = mulberry32(0xDEADBEEF);

  // Split input into acc (cols 0-2) and gyro (cols 3-5)
  const accIn  = window6ch.map(r => [r[0], r[1], r[2]] as V3);
  const gyroIn = window6ch.map(r => [r[3], r[4], r[5]] as V3);

  // Build output: n_samples × 45
  const out: number[][] = Array.from({ length: nSamples }, () => []);

  for (const R of UCI_ROTATIONS) {
    const acc  = rotateAndNoise(accIn,  R, ACC_NOISE_SIGMA,  rand);
    const gyro = rotateAndNoise(gyroIn, R, GYRO_NOISE_SIGMA, rand);

    // Magnetometer: rotate the Earth-field reference by the same R + noise
    const mag = Array.from({ length: nSamples }, () => {
      const rotMag = applyM3(R, MAG_REF);
      return rotMag.map(v => v + gaussianSample(rand, MAG_NOISE_SIGMA));
    });

    for (let i = 0; i < nSamples; i++) {
      out[i].push(...acc[i], ...gyro[i], ...mag[i]);  // 9 ch per sensor
    }
  }

  return out;   // (n_samples, 45)
}

/**
 * Expand a (n_samples × 6) single-sensor window to (n_samples × 36)
 * matching the HugaDB format:
 *   [s0_acc(3) s0_gyro(3) | s1… | s2… | s3… | s4… | s5…]
 *
 * Used for the leg multi-sensor endpoint: POST /api/leg/imu/predict
 */
export function synthesizeLeg36ch(window6ch: number[][]): number[][] {
  const nSamples = window6ch.length;
  const rand     = mulberry32(0xCAFEBABE);

  const accIn  = window6ch.map(r => [r[0], r[1], r[2]] as V3);
  const gyroIn = window6ch.map(r => [r[3], r[4], r[5]] as V3);

  const out: number[][] = Array.from({ length: nSamples }, () => []);

  for (const R of HUGADB_ROTATIONS) {
    const acc  = rotateAndNoise(accIn,  R, ACC_NOISE_SIGMA,  rand);
    const gyro = rotateAndNoise(gyroIn, R, GYRO_NOISE_SIGMA, rand);

    for (let i = 0; i < nSamples; i++) {
      out[i].push(...acc[i], ...gyro[i]);  // 6 ch per sensor (no mag)
    }
  }

  return out;   // (n_samples, 36)
}
