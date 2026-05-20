export type InjuryType = 'Hand' | 'Wrist' | 'Elbow' | 'Knee' | 'Leg' | 'Walking';

// The three rehabilitation modules supported by the platform
export type RehabType = 'knee' | 'leg' | 'elbow';

// Static Tailwind color strings — must be full class names for Tailwind v4 JIT
export interface RehabColors {
  primary: string;
  primaryHover: string;
  light: string;
  text: string;
  textDark: string;
  border: string;
  badge: string;
  bar: string;
  chartHex: string;
}

export interface RehabModuleInfo {
  type: RehabType;
  label: string;
  tagline: string;
  description: string;
  conditions: string[];
  colors: RehabColors;
}

/**
 * How a single rep is detected during a coached session.
 *
 *  - `angle` — count one rep when the tracked joint angle dips below
 *    `flexedAt` and then comes back above `extendedAt`. Best for clear
 *    flexion/extension movements (heel slides, bicep curls, squats…).
 *  - `hold`  — no skeleton-based detection is reliable, so each rep is
 *    measured by a `holdSec` timer. Used for isometric holds (Quad Sets,
 *    Single-Leg Balance) and for exercises whose primary joint isn't
 *    tracked well by the pose model (calf raises, wrist flexion, grip).
 */
export interface RepDetection {
  strategy: 'angle' | 'hold';
  /** Angle (°) at which we consider the joint "flexed". Required when strategy === 'angle'. */
  flexedAt?: number;
  /** Angle (°) at which we consider the joint "extended". Required when strategy === 'angle'. */
  extendedAt?: number;
  /** Seconds per rep. Required when strategy === 'hold'. */
  holdSec?: number;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  sets: number;
  reps: number | string;       // string for time-based, e.g. "30s hold"
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  phase: 1 | 2 | 3 | 4;
  duration: number;            // estimated minutes
  safetyNotes: string;
  targetArea: InjuryType;
  rehabType: RehabType;
  imageUrl?: string;
  /** How the coached session should count reps. Defaults to angle 130/160 if omitted. */
  repDetection?: RepDetection;
}

export interface RehabPhase {
  phase: 1 | 2 | 3 | 4;
  name: string;
  goal: string;
  durationWeeks: string;
  focusAreas: string[];
  exercises: string[];         // Exercise IDs
}

export interface PatientSession {
  id: string;
  date: string;
  exerciseId: string;
  exerciseTitle: string;
  quality: number;             // 0-100
  painLevel: number;           // 0-10
  duration: number;            // seconds
  rehabType: RehabType;
  // TODO: attach raw IMU sensor data when hardware integration is complete
  sensorData?: null;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  injuryType: InjuryType;
  rehabType: RehabType;
  recoveryProgress: number;   // 0-100
  nextSession: string;
  lastActive: string;
  planId: string;
  currentPhase: 1 | 2 | 3 | 4;
  adherenceRate: number;      // 0-100
  sessionsCompleted: number;
  assignedDoctor?: string;
  alerts?: string[];
}

// === Doctor profile / patient ↔ doctor connections / messaging =================

/**
 * Public-facing CV info a doctor fills in from /doctor/settings. Stored on
 * users/{uid}.doctorProfile AND mirrored to doctorDirectory/{uid} so patients
 * can search without us having to broaden read access on the users collection.
 */
export interface DoctorProfile {
  /** Body parts this doctor treats — drives the Find My Doctor filter. */
  specialties: RehabType[];
  /** Free-text location/region (e.g. "Boston, MA"). */
  workArea: string;
  /** Hospital/clinic name. Optional. */
  clinicName?: string;
  /** Short bio paragraph shown on the public profile. */
  bio: string;
  yearsOfExperience: number;
  /** One entry per degree/school, e.g. "MD — Harvard Medical School (2010)". */
  education: string[];
  certifications: string[];
  languages: string[];
  /** Optional, private-ish — not mirrored to directory. */
  licenseNumber?: string;
  /** True once all required fields are filled. Patients only see complete profiles in search. */
  profileComplete: boolean;
  /** When the profile was last edited. */
  updatedAt: Date;
}

/**
 * Mirror of DoctorProfile used in the public-search collection. Anything we
 * write here is readable by any signed-in patient — keep private fields out.
 */
export interface DoctorDirectoryEntry {
  uid: string;
  name: string;
  photoUrl?: string;
  specialties: RehabType[];
  workArea: string;
  clinicName?: string;
  bio: string;
  yearsOfExperience: number;
  education: string[];
  certifications: string[];
  languages: string[];
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

/**
 * One patient ↔ doctor relationship. Document ID is deterministic
 * (`${patientUid}_${doctorUid}`) so a patient can't accidentally fire off two
 * requests to the same doctor. Most denormalized fields exist so the Messages
 * list and dashboards can render without N follow-up reads.
 */
export interface Connection {
  id: string;
  patientUid: string;
  doctorUid: string;
  patientName: string;
  patientPhotoUrl?: string;
  patientInjuryType?: InjuryType;
  doctorName: string;
  doctorPhotoUrl?: string;
  doctorSpecialties: RehabType[];
  status: ConnectionStatus;
  requestedAt: Date;
  respondedAt?: Date;
  /** Initial note attached by the patient when sending the request. */
  introMessage?: string;
  /** Last-message metadata for sorting the Messages list. */
  lastMessageAt?: Date;
  lastMessageText?: string;
  lastMessageBy?: 'patient' | 'doctor';
  /** Unread message counts, reset to 0 when the recipient opens the thread. */
  patientUnread: number;
  doctorUnread: number;
}

/** One chat message within a connection's thread. */
export interface Message {
  id: string;
  senderUid: string;
  senderRole: 'patient' | 'doctor';
  text: string;
  sentAt: Date;
}

// =============================================================================

export interface ProgressData {
  week: string;
  rom: number;                 // Range of Motion — degrees for knee/elbow, % for leg
  quality: number;             // 0-100 movement quality score
  pain: number;                // 0-10 pain level
}

export interface KneeProgressData extends ProgressData {
  swelling: number;            // 0-5 scale
  quadStrength: number;        // 0-100 % of healthy side
}

export interface LegProgressData extends ProgressData {
  balance: number;             // seconds single-leg balance
  gaitSymmetry: number;        // 0-100 %
  hipStrength: number;         // 0-100 % of healthy side
}

export interface ElbowProgressData extends ProgressData {
  gripStrength: number;        // kg
  forearmRotation: number;     // degrees
  functionalScore: number;     // 0-100 (DASH questionnaire equivalent)
}

// === ML / Sensor Placeholder Types ===
// TODO: Replace these stubs with real data structures from the ML pipeline integration

export interface MLPipelineStatus {
  pipelineId: string;
  name: string;
  rehabType: RehabType;
  status: 'not_connected' | 'initializing' | 'active' | 'error';
  description: string;
}

export interface SensorStatus {
  sensorId: string;
  name: string;
  placement: string;
  connected: boolean;
  batteryLevel?: number;
  lastReading?: string;
}

// === Live IMU integration types ===
// Used by src/lib/imuBluetooth.ts, src/lib/imuDemoSource.ts, src/hooks/useIMU.ts

export type IMUTransport = 'ble' | 'demo';

export type IMUConnectionStatus =
  | 'disconnected'
  | 'pairing'
  | 'connecting'
  | 'streaming'
  | 'error';

/**
 * A single IMU sample. All values are in SI-ish units:
 *  - accel in g (1 g ≈ 9.81 m/s²)
 *  - gyro in deg/s
 *  - mag (optional) in microtesla
 */
export interface IMUSample {
  t: number;            // ms since first sample
  ax: number; ay: number; az: number;
  gx: number; gy: number; gz: number;
  mx?: number; my?: number; mz?: number;
}

export interface IMULiveMetrics {
  /** Cumulative repetitions detected from the live stream */
  repCount: number;
  /** Current single-axis tilt of the sensor in degrees */
  jointAngle: number;
  /** Min/max joint angle observed so far in degrees */
  rangeOfMotion: number;
  /** Smoothness score 0–100 from inverse jerk RMS — higher = smoother */
  smoothness: number;
  /** Last few accelerometer magnitudes for sparkline rendering */
  accelSparkline: number[];
  /** Last few gyro magnitudes for sparkline rendering */
  gyroSparkline: number[];
  /** Total samples received since stream start */
  sampleCount: number;
}

export interface IMUDeviceInfo {
  /** Browser-reported BLE name, or 'Demo Sensor' in demo mode */
  name: string;
  /** Transport actually in use */
  transport: IMUTransport;
  /** Pairing time, ISO string */
  connectedAt: string;
}

/**
 * Snapshot of a completed IMU session — mirrors the camera pipeline's
 * SessionStats so the Firestore write and pain-prompt recap work the same way.
 */
export interface IMUSessionStats {
  avgFormScore: number;   // 0-100
  romDegrees: number;
  smoothness: number;     // 0-100
}
