/**
 * Maps MediaPipe 33 pose landmarks → skeleton133 26-joint format.
 *
 * skeleton133 joint indices come from dataML/133/joints_names.txt.
 * MediaPipe landmark indices from: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 *
 * Where no direct MediaPipe equivalent exists, we average nearby landmarks.
 */

export type Vec3 = [number, number, number];
export type Landmark = { x: number; y: number; z: number; visibility?: number };

// Returns the average position of multiple landmarks
function avg(lms: Landmark[], ...indices: number[]): Vec3 {
  let x = 0, y = 0, z = 0;
  for (const i of indices) {
    x += lms[i].x;
    y += lms[i].y;
    z += lms[i].z;
  }
  const n = indices.length;
  return [x / n, y / n, z / n];
}

function single(lm: Landmark): Vec3 {
  return [lm.x, lm.y, lm.z];
}

/**
 * Convert a MediaPipe landmarks array (33 points) to skeleton133 format (26 joints × 3).
 * Returns null if the input is missing required landmarks.
 */
export function mediapipeToSkeleton133(landmarks: Landmark[]): Vec3[] | null {
  if (landmarks.length < 33) return null;

  const L = landmarks;

  // Midpoints used repeatedly
  const hips   = avg(L, 23, 24);         // center of left/right hip
  const spine  = avg(L, 11, 12, 23, 24); // body center
  const spine1 = avg(L, 11, 12);         // shoulder midpoint (approximation)

  return [
    hips,                            // 0  Hips
    spine,                           // 1  Spine
    spine1,                          // 2  Spine1
    avg(L, 11, 12),                  // 3  Neck  (shoulder midpoint)
    single(L[0]),                    // 4  Head  (nose)
    [L[0].x, L[0].y - 0.05, L[0].z] as Vec3, // 5  Head_end (nose projected slightly up)
    single(L[11]),                   // 6  LeftShoulder
    single(L[11]),                   // 7  LeftArm (no separate upper-arm landmark)
    single(L[13]),                   // 8  LeftForeArm  (left elbow)
    single(L[15]),                   // 9  LeftHand     (left wrist)
    single(L[19]),                   // 10 LeftHand_end (left index tip)
    single(L[12]),                   // 11 RightShoulder
    single(L[12]),                   // 12 RightArm
    single(L[14]),                   // 13 RightForeArm (right elbow)
    single(L[16]),                   // 14 RightHand    (right wrist)
    single(L[20]),                   // 15 RightHand_end (right index tip)
    single(L[23]),                   // 16 LeftUpLeg  (left hip)
    single(L[25]),                   // 17 LeftLeg    (left knee) ← key for knee rehab
    single(L[27]),                   // 18 LeftFoot   (left ankle)
    single(L[31]),                   // 19 LeftToeBase
    single(L[31]),                   // 20 LeftToeBase_end
    single(L[24]),                   // 21 RightUpLeg (right hip)
    single(L[26]),                   // 22 RightLeg   (right knee) ← key for knee rehab
    single(L[28]),                   // 23 RightFoot  (right ankle)
    single(L[32]),                   // 24 RightToeBase
    single(L[32]),                   // 25 RightToeBase_end
  ];
}

/** Skeleton133 bone connections for drawing the overlay */
export const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // spine to head
  [3, 6], [6, 7], [7, 8], [8, 9],         // left arm
  [3, 11], [11, 12], [12, 13], [13, 14],  // right arm
  [0, 16], [16, 17], [17, 18], [18, 19],  // left leg
  [0, 21], [21, 22], [22, 23], [23, 24],  // right leg
];
