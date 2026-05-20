import {
  Exercise, Patient, PatientSession,
  RehabModuleInfo, RehabType, MLPipelineStatus, SensorStatus,
  KneeProgressData, LegProgressData, ElbowProgressData, RehabPhase,
} from './types';

// ─── Rehab Module Definitions ─────────────────────────────────────────────────
// All Tailwind class strings must be full names (no dynamic construction) for v4 JIT

export const REHAB_MODULES: Record<RehabType, RehabModuleInfo> = {
  knee: {
    type: 'knee',
    label: 'Knee Rehabilitation',
    tagline: 'Restore strength & joint stability',
    description: 'Structured recovery for ACL/PCL injuries, meniscus tears, patellofemoral syndrome, and knee replacement surgery.',
    conditions: ['ACL / PCL Injury', 'Meniscus Tear', 'Patellofemoral Syndrome', 'Total Knee Replacement', 'Knee Osteoarthritis'],
    colors: {
      primary: 'bg-emerald-600',
      primaryHover: 'hover:bg-emerald-700',
      light: 'bg-emerald-50',
      text: 'text-emerald-600',
      textDark: 'text-emerald-700',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-700',
      bar: 'bg-emerald-500',
      chartHex: '#10b981',
    },
  },
  leg: {
    type: 'leg',
    label: 'Leg Rehabilitation',
    tagline: 'Rebuild power, balance & gait',
    description: 'Comprehensive lower-extremity recovery for hip, thigh, calf, and gait dysfunction after injury or surgery.',
    conditions: ['Hip Flexor Strain', 'Hamstring Tear', 'Shin Splints', 'Hip Replacement', 'Gait / Balance Dysfunction'],
    colors: {
      primary: 'bg-indigo-600',
      primaryHover: 'hover:bg-indigo-700',
      light: 'bg-indigo-50',
      text: 'text-indigo-600',
      textDark: 'text-indigo-700',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-700',
      bar: 'bg-indigo-500',
      chartHex: '#6366f1',
    },
  },
  elbow: {
    type: 'elbow',
    label: 'Elbow Rehabilitation',
    tagline: 'Recover function & flexibility',
    description: 'Evidence-based therapy for lateral/medial epicondylitis, radial head fractures, ulnar nerve conditions, and tendinopathy.',
    conditions: ['Tennis Elbow (Lateral Epicondylitis)', "Golfer's Elbow (Medial)", 'Radial Head Fracture', 'Ulnar Nerve Entrapment', 'Triceps Tendinopathy'],
    colors: {
      primary: 'bg-orange-500',
      primaryHover: 'hover:bg-orange-600',
      light: 'bg-orange-50',
      text: 'text-orange-500',
      textDark: 'text-orange-600',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-600',
      bar: 'bg-orange-500',
      chartHex: '#f97316',
    },
  },
};

// ─── Knee Exercises ───────────────────────────────────────────────────────────
// NOTE: We render anatomical SVG diagrams from src/components/ExerciseDemo.tsx
// instead of using the imageUrl field. Earlier we extracted photos from the
// REHAB24-6 demo videos in dataML/133/, but those videos turned out to depict
// different exercises than the clinical knee protocol below. The JPGs remain
// in public/exercise-demos/ for future reuse.

export const KNEE_EXERCISES: Exercise[] = [
  {
    id: 'knee-ex-1',
    title: 'Quad Sets',
    description: 'Activates the quadriceps without moving the knee joint — ideal for the acute phase.',
    instructions: [
      'Sit or lie flat with the affected leg fully extended.',
      'Tighten your quadriceps by pressing the back of the knee down into the surface.',
      'Hold the contraction for 5 seconds.',
      'Relax completely, then repeat.',
    ],
    sets: 3, reps: 10, difficulty: 'Beginner', phase: 1, duration: 8,
    safetyNotes: 'Stop if you feel sharp pain. Focus on gentle isometric activation only.',
    targetArea: 'Knee', rehabType: 'knee',
    repDetection: { strategy: 'hold', holdSec: 5 }, // isometric — pure hold
  },
  {
    id: 'knee-ex-2',
    title: 'Straight Leg Raise',
    description: 'Strengthens the quadriceps and hip flexors while keeping the knee fully protected.',
    instructions: [
      'Lie on your back, unaffected knee bent with foot flat.',
      'Tighten the quad of the injured leg and raise it to roughly 45°.',
      'Hold for 3 seconds at the top.',
      'Lower slowly — avoid resting the leg between reps.',
    ],
    sets: 3, reps: 12, difficulty: 'Beginner', phase: 1, duration: 10,
    safetyNotes: 'Keep your core engaged. Do not hold your breath.',
    targetArea: 'Knee', rehabType: 'knee',
    repDetection: { strategy: 'hold', holdSec: 5 }, // lift + 3 s hold + lower
  },
  {
    id: 'knee-ex-3',
    title: 'Heel Slides',
    description: 'Gently restores knee flexion range of motion in early recovery.',
    instructions: [
      'Lie on your back with both legs extended.',
      'Slowly slide the heel of the injured leg toward your buttocks.',
      'Slide until you feel a comfortable stretch — hold 3 seconds.',
      'Slide back to the start position.',
    ],
    sets: 3, reps: 10, difficulty: 'Beginner', phase: 1, duration: 8,
    safetyNotes: 'Never force the range. Work within a pain-free arc only.',
    targetArea: 'Knee', rehabType: 'knee',
    repDetection: { strategy: 'angle', flexedAt: 130, extendedAt: 165 }, // clear knee flexion
  },
  {
    id: 'knee-ex-4',
    title: 'Mini Squats (0–45°)',
    description: 'Builds quadriceps and glute strength through a safe partial range of motion.',
    instructions: [
      'Stand with feet shoulder-width apart, holding a support if needed.',
      'Slowly bend both knees to approximately 45°.',
      'Keep weight distributed evenly, knees aligned over toes.',
      'Pause 2 seconds, then straighten back up.',
    ],
    sets: 3, reps: 12, difficulty: 'Intermediate', phase: 2, duration: 12,
    safetyNotes: 'Do not let the knee cave inward. Use a mirror for alignment feedback.',
    targetArea: 'Knee', rehabType: 'knee',
    repDetection: { strategy: 'angle', flexedAt: 150, extendedAt: 170 }, // partial range
  },
  {
    id: 'knee-ex-5',
    title: 'Terminal Knee Extension',
    description: 'Targets the last 30° of knee extension — critical for gait and stair climbing.',
    instructions: [
      'Attach a resistance band around a fixed object at knee height.',
      'Loop the band behind your knee and step back to create tension.',
      'Bend the knee slightly, then push through to full extension.',
      'Control the return slowly. Keep your foot flat on the ground.',
    ],
    sets: 3, reps: 15, difficulty: 'Intermediate', phase: 2, duration: 12,
    safetyNotes: 'Avoid hyperextending the knee. Begin with light resistance.',
    targetArea: 'Knee', rehabType: 'knee',
    repDetection: { strategy: 'angle', flexedAt: 160, extendedAt: 175 }, // narrow end-range extension
  },
  {
    id: 'knee-ex-6',
    title: 'Step-Ups',
    description: 'Functional exercise improving quad control, single-leg strength, and balance.',
    instructions: [
      'Stand in front of a 6–8 inch step with the injured leg on the step.',
      'Drive through the heel to push your body up onto the step.',
      'Control the descent, lowering the trailing foot slowly.',
      'Keep the stepping knee directly above your ankle throughout.',
    ],
    sets: 3, reps: 10, difficulty: 'Advanced', phase: 3, duration: 15,
    safetyNotes: 'Avoid letting the knee buckle inward when stepping up or down.',
    targetArea: 'Knee', rehabType: 'knee',
    repDetection: { strategy: 'angle', flexedAt: 130, extendedAt: 165 }, // full step cycle
  },
];

// ─── Leg Exercises ────────────────────────────────────────────────────────────

export const LEG_EXERCISES: Exercise[] = [
  {
    id: 'leg-ex-1',
    title: 'Standing Calf Raises',
    description: 'Strengthens the gastrocnemius and soleus, improving ankle stability and propulsion.',
    instructions: [
      'Stand with feet hip-width apart, holding a support for balance.',
      'Rise up slowly onto the balls of your feet.',
      'Hold at the top for 2 seconds.',
      'Lower slowly back down over 3–4 counts.',
    ],
    sets: 3, reps: 15, difficulty: 'Beginner', phase: 1, duration: 8,
    safetyNotes: 'Keep the movement slow and controlled. Avoid bouncing at the bottom.',
    targetArea: 'Leg', rehabType: 'leg',
    repDetection: { strategy: 'hold', holdSec: 4 }, // rise 2s + lower 2s, ankle not in pose triplet
  },
  {
    id: 'leg-ex-2',
    title: 'Side-Lying Hip Abduction',
    description: 'Isolates the gluteus medius — essential for hip stability and gait correction.',
    instructions: [
      'Lie on your side with the affected hip on top.',
      'Keep the top leg straight, toes pointed slightly downward.',
      'Raise the top leg to 45°, keeping the body stable.',
      'Hold 2 seconds, then lower slowly.',
    ],
    sets: 3, reps: 12, difficulty: 'Beginner', phase: 1, duration: 10,
    safetyNotes: 'Do not roll the pelvis backward. Keep the top hip stacked over the bottom.',
    targetArea: 'Leg', rehabType: 'leg',
    repDetection: { strategy: 'hold', holdSec: 4 }, // side-view hip angle isn't in our triplet
  },
  {
    id: 'leg-ex-3',
    title: 'Prone Hamstring Curl',
    description: 'Activates and strengthens the hamstrings through full available range.',
    instructions: [
      'Lie face down with legs straight.',
      'Bend the knee of the affected leg, raising the heel toward the ceiling.',
      'Control the motion to 90° or comfortable limit.',
      'Lower slowly over 3–4 counts.',
    ],
    sets: 3, reps: 12, difficulty: 'Beginner', phase: 2, duration: 10,
    safetyNotes: 'Keep the pelvis flat. Avoid excessive lumbar extension.',
    targetArea: 'Leg', rehabType: 'leg',
    repDetection: { strategy: 'angle', flexedAt: 120, extendedAt: 165 }, // knee bends ~90°
  },
  {
    id: 'leg-ex-4',
    title: 'Forward Step-Up with Hip Hinge',
    description: 'Combines hip extension and knee control to improve functional lower-limb strength.',
    instructions: [
      'Stand in front of a low step (6–8 inches).',
      'Step up with the affected leg, driving through the heel.',
      'At the top, hinge slightly forward for added glute activation.',
      'Lower with control, trailing leg first.',
    ],
    sets: 3, reps: 10, difficulty: 'Intermediate', phase: 2, duration: 12,
    safetyNotes: 'Avoid letting the knee drift medially. Engage glutes at the top.',
    targetArea: 'Leg', rehabType: 'leg',
    repDetection: { strategy: 'angle', flexedAt: 135, extendedAt: 170 }, // step-up flexion
  },
  {
    id: 'leg-ex-5',
    title: 'Single-Leg Balance',
    description: 'Improves proprioception and neuromuscular control — key for fall prevention.',
    instructions: [
      'Stand near a wall or support for safety.',
      'Lift the non-affected leg slightly off the ground.',
      'Balance on the affected leg for the prescribed time.',
      'Increase difficulty by closing eyes or standing on a foam pad.',
    ],
    sets: 3, reps: 1, difficulty: 'Intermediate', phase: 3, duration: 10,
    safetyNotes: 'Stay close to a wall. Discontinue immediately if you feel unsafe.',
    targetArea: 'Leg', rehabType: 'leg',
    repDetection: { strategy: 'hold', holdSec: 30 }, // 1 rep = 30 s of balance per set
  },
  {
    id: 'leg-ex-6',
    title: 'Lateral Band Walk',
    description: 'Strengthens hip abductors and external rotators to improve gait stability.',
    instructions: [
      'Place a resistance band just above the ankles.',
      'Assume a slight squat position with feet hip-width apart.',
      'Step sideways 12 steps maintaining band tension.',
      'Return to start without letting feet come together.',
    ],
    sets: 3, reps: 24, difficulty: 'Intermediate', phase: 3, duration: 12,
    safetyNotes: 'Keep the band taut throughout. Do not let the knees collapse inward.',
    targetArea: 'Leg', rehabType: 'leg',
    repDetection: { strategy: 'hold', holdSec: 2 }, // 24 steps × 2 s each
  },
];

// ─── Elbow Exercises ──────────────────────────────────────────────────────────

export const ELBOW_EXERCISES: Exercise[] = [
  {
    id: 'elbow-ex-1',
    title: 'Active Elbow Flexion / Extension',
    description: 'Gently restores full elbow range of motion in the acute recovery phase.',
    instructions: [
      'Sit with your elbow at your side, arm relaxed.',
      'Slowly bend the elbow, bringing the hand toward the shoulder.',
      'Hold at maximum comfortable flexion for 3 seconds.',
      'Slowly straighten back to full extension.',
    ],
    sets: 3, reps: 10, difficulty: 'Beginner', phase: 1, duration: 8,
    safetyNotes: 'Work within a pain-free range only. Do not force the end range.',
    targetArea: 'Elbow', rehabType: 'elbow',
    repDetection: { strategy: 'angle', flexedAt: 60, extendedAt: 160 }, // shoulder→elbow→wrist
  },
  {
    id: 'elbow-ex-2',
    title: 'Forearm Supination / Pronation',
    description: 'Restores rotational mobility — critical for daily tasks like turning a doorknob.',
    instructions: [
      'Hold a light object (pencil) vertically in the affected hand.',
      'Elbow bent to 90° and anchored at your side, rotate palm to face up (supination).',
      'Hold 2 seconds, then rotate to palm-down (pronation).',
      'Keep the elbow still and close to your body throughout.',
    ],
    sets: 3, reps: 10, difficulty: 'Beginner', phase: 1, duration: 8,
    safetyNotes: 'Use a light object only. Do not allow the elbow to flare outward.',
    targetArea: 'Elbow', rehabType: 'elbow',
    repDetection: { strategy: 'hold', holdSec: 4 }, // rotation not visible in pose triplet
  },
  {
    id: 'elbow-ex-3',
    title: 'Wrist Flexion / Extension',
    description: 'Improves forearm flexibility and reduces tension on the epicondyles.',
    instructions: [
      'Rest your forearm on a table, palm facing up, wrist at the edge.',
      'Slowly lower the hand downward (extension) for a stretch.',
      'Then raise the hand upward (flexion).',
      'Complete all reps before switching to palm-down position.',
    ],
    sets: 3, reps: 12, difficulty: 'Beginner', phase: 2, duration: 8,
    safetyNotes: 'Move slowly. If wrist flexion causes elbow pain, reduce range.',
    targetArea: 'Elbow', rehabType: 'elbow',
    repDetection: { strategy: 'hold', holdSec: 3 }, // wrist not tracked by elbow triplet
  },
  {
    id: 'elbow-ex-4',
    title: 'Bicep Curl (Light Resistance)',
    description: 'Gradually reloads the elbow flexors to restore functional strength.',
    instructions: [
      'Hold a light dumbbell (0.5–2 kg) in the affected hand, palm facing up.',
      'Keeping the elbow anchored, curl the weight toward the shoulder.',
      'Squeeze at the top for 1 second.',
      'Lower slowly over 3–4 counts to starting position.',
    ],
    sets: 3, reps: 12, difficulty: 'Beginner', phase: 2, duration: 10,
    safetyNotes: 'Start with the lightest weight possible. Increase only when 3×12 is pain-free.',
    targetArea: 'Elbow', rehabType: 'elbow',
    repDetection: { strategy: 'angle', flexedAt: 70, extendedAt: 155 }, // bicep curl arc
  },
  {
    id: 'elbow-ex-5',
    title: 'Tricep Overhead Extension',
    description: 'Strengthens the triceps and improves elbow extension through loaded range.',
    instructions: [
      'Hold a light dumbbell in both hands overhead.',
      'Slowly lower the weight behind the head by bending the elbows.',
      'Keep upper arms vertical and close to the ears.',
      'Extend back to the starting position in a controlled manner.',
    ],
    sets: 3, reps: 10, difficulty: 'Intermediate', phase: 3, duration: 12,
    safetyNotes: 'Avoid if full overhead shoulder mobility is not yet restored.',
    targetArea: 'Elbow', rehabType: 'elbow',
    repDetection: { strategy: 'angle', flexedAt: 80, extendedAt: 165 }, // overhead extension arc
  },
  {
    id: 'elbow-ex-6',
    title: 'Grip Strengthening — Putty / Ball',
    description: 'Progressive grip loading to restore forearm and hand function.',
    instructions: [
      'Hold therapeutic putty or a soft rubber ball in the palm.',
      'Squeeze firmly for 5 seconds, then fully relax.',
      'Vary grip pattern: full fist, lateral pinch, and tip pinch.',
      'Alternate grip style every 5 reps.',
    ],
    sets: 3, reps: 10, difficulty: 'Intermediate', phase: 3, duration: 10,
    safetyNotes: 'Do not squeeze to the point of pain. Use appropriate putty resistance level.',
    targetArea: 'Elbow', rehabType: 'elbow',
    repDetection: { strategy: 'hold', holdSec: 6 }, // 5 s squeeze + 1 s relax
  },
];

export const ALL_EXERCISES: Exercise[] = [...KNEE_EXERCISES, ...LEG_EXERCISES, ...ELBOW_EXERCISES];

export function getExercisesByType(type: RehabType): Exercise[] {
  return ALL_EXERCISES.filter(e => e.rehabType === type);
}

// ─── Rehab Phase Plans ────────────────────────────────────────────────────────

export const REHAB_PHASES: Record<RehabType, RehabPhase[]> = {
  knee: [
    {
      phase: 1, name: 'Acute Pain Control', durationWeeks: 'Weeks 1–2',
      goal: 'Reduce swelling, control pain, and prevent muscle atrophy.',
      focusAreas: ['Pain management', 'Edema control', 'Quad activation', 'Weight-bearing tolerance'],
      exercises: ['knee-ex-1', 'knee-ex-2', 'knee-ex-3'],
    },
    {
      phase: 2, name: 'Range of Motion & Strength', durationWeeks: 'Weeks 3–5',
      goal: 'Restore full knee flexion/extension and regain basic strength.',
      focusAreas: ['ROM restoration (0–120°)', 'Quadriceps strengthening', 'Hamstring activation', 'Patellar mobility'],
      exercises: ['knee-ex-3', 'knee-ex-4', 'knee-ex-5'],
    },
    {
      phase: 3, name: 'Functional Strengthening', durationWeeks: 'Weeks 6–10',
      goal: 'Achieve full strength symmetry and prepare for return to activity.',
      focusAreas: ['Closed-chain strengthening', 'Proprioception training', 'Gait normalization', 'Sports-specific movement'],
      exercises: ['knee-ex-4', 'knee-ex-5', 'knee-ex-6'],
    },
    {
      phase: 4, name: 'Return to Activity', durationWeeks: 'Weeks 11–16',
      goal: 'Cleared for sports/work with full strength and confidence.',
      focusAreas: ['Running progression', 'Agility training', 'Sport-specific drills', 'Long-term maintenance'],
      exercises: ['knee-ex-5', 'knee-ex-6'],
    },
  ],
  leg: [
    {
      phase: 1, name: 'Inflammation & Pain Control', durationWeeks: 'Weeks 1–2',
      goal: 'Minimize pain and protect healing tissue.',
      focusAreas: ['Rest & protection', 'Gentle activation', 'Edema management', 'Range of motion maintenance'],
      exercises: ['leg-ex-1', 'leg-ex-2'],
    },
    {
      phase: 2, name: 'Mobility & Muscle Activation', durationWeeks: 'Weeks 3–5',
      goal: 'Restore full range of motion and reactivate key muscle groups.',
      focusAreas: ['Hip flexor flexibility', 'Hamstring lengthening', 'Calf strengthening', 'Early weight-bearing'],
      exercises: ['leg-ex-2', 'leg-ex-3', 'leg-ex-4'],
    },
    {
      phase: 3, name: 'Strength & Balance', durationWeeks: 'Weeks 6–10',
      goal: 'Develop dynamic balance, hip control, and lower-limb strength.',
      focusAreas: ['Single-leg stability', 'Hip abductor strengthening', 'Gait re-training', 'Neuromuscular control'],
      exercises: ['leg-ex-4', 'leg-ex-5', 'leg-ex-6'],
    },
    {
      phase: 4, name: 'Endurance & Return to Sport', durationWeeks: 'Weeks 11–16',
      goal: 'Full lower-limb endurance and return to pre-injury activity level.',
      focusAreas: ['Running endurance', 'Reactive agility', 'Return-to-sport testing', 'Maintenance program'],
      exercises: ['leg-ex-5', 'leg-ex-6'],
    },
  ],
  elbow: [
    {
      phase: 1, name: 'Pain & Inflammation Control', durationWeeks: 'Weeks 1–2',
      goal: 'Protect healing structures and manage acute inflammation.',
      focusAreas: ['Pain management', 'Edema control', 'Gentle ROM', 'Protecting tendon attachment'],
      exercises: ['elbow-ex-1', 'elbow-ex-2'],
    },
    {
      phase: 2, name: 'Range of Motion Recovery', durationWeeks: 'Weeks 3–5',
      goal: 'Restore full elbow and forearm mobility.',
      focusAreas: ['Flexion/extension ROM', 'Supination/pronation', 'Wrist mobility', 'Gentle tissue loading'],
      exercises: ['elbow-ex-2', 'elbow-ex-3', 'elbow-ex-4'],
    },
    {
      phase: 3, name: 'Progressive Strengthening', durationWeeks: 'Weeks 6–10',
      goal: 'Reload elbow and forearm with progressive resistance.',
      focusAreas: ['Eccentric loading', 'Grip strength', 'Wrist strengthening', 'Tricep/bicep balance'],
      exercises: ['elbow-ex-4', 'elbow-ex-5', 'elbow-ex-6'],
    },
    {
      phase: 4, name: 'Functional Return', durationWeeks: 'Weeks 11–16',
      goal: 'Return to pre-injury activities including sport and occupational demands.',
      focusAreas: ['Work-simulation tasks', 'Sport-specific loading', 'Throwing/racket drills', 'Maintenance'],
      exercises: ['elbow-ex-5', 'elbow-ex-6'],
    },
  ],
};

// ─── Mock Progress Data ───────────────────────────────────────────────────────

export const MOCK_KNEE_PROGRESS: KneeProgressData[] = [
  { week: 'W1', rom: 45,  quality: 40, pain: 7, swelling: 4, quadStrength: 20 },
  { week: 'W2', rom: 60,  quality: 48, pain: 6, swelling: 3, quadStrength: 28 },
  { week: 'W3', rom: 80,  quality: 57, pain: 5, swelling: 2, quadStrength: 40 },
  { week: 'W4', rom: 95,  quality: 65, pain: 4, swelling: 2, quadStrength: 52 },
  { week: 'W5', rom: 110, quality: 72, pain: 3, swelling: 1, quadStrength: 65 },
  { week: 'W6', rom: 120, quality: 79, pain: 2, swelling: 1, quadStrength: 75 },
  { week: 'W7', rom: 128, quality: 84, pain: 2, swelling: 0, quadStrength: 83 },
  { week: 'W8', rom: 133, quality: 88, pain: 1, swelling: 0, quadStrength: 90 },
];

export const MOCK_LEG_PROGRESS: LegProgressData[] = [
  { week: 'W1', rom: 50, quality: 38, pain: 6, balance: 5,  gaitSymmetry: 55, hipStrength: 30 },
  { week: 'W2', rom: 62, quality: 47, pain: 5, balance: 8,  gaitSymmetry: 62, hipStrength: 40 },
  { week: 'W3', rom: 70, quality: 55, pain: 4, balance: 12, gaitSymmetry: 68, hipStrength: 50 },
  { week: 'W4', rom: 78, quality: 63, pain: 3, balance: 18, gaitSymmetry: 74, hipStrength: 60 },
  { week: 'W5', rom: 84, quality: 70, pain: 3, balance: 22, gaitSymmetry: 80, hipStrength: 68 },
  { week: 'W6', rom: 90, quality: 76, pain: 2, balance: 27, gaitSymmetry: 85, hipStrength: 76 },
  { week: 'W7', rom: 93, quality: 82, pain: 2, balance: 32, gaitSymmetry: 90, hipStrength: 83 },
  { week: 'W8', rom: 96, quality: 87, pain: 1, balance: 38, gaitSymmetry: 94, hipStrength: 89 },
];

export const MOCK_ELBOW_PROGRESS: ElbowProgressData[] = [
  { week: 'W1', rom: 60,  quality: 35, pain: 7, gripStrength: 12, forearmRotation: 40,  functionalScore: 30 },
  { week: 'W2', rom: 80,  quality: 45, pain: 6, gripStrength: 15, forearmRotation: 60,  functionalScore: 40 },
  { week: 'W3', rom: 100, quality: 55, pain: 5, gripStrength: 18, forearmRotation: 80,  functionalScore: 50 },
  { week: 'W4', rom: 115, quality: 63, pain: 4, gripStrength: 22, forearmRotation: 100, functionalScore: 60 },
  { week: 'W5', rom: 125, quality: 71, pain: 3, gripStrength: 26, forearmRotation: 120, functionalScore: 68 },
  { week: 'W6', rom: 132, quality: 78, pain: 2, gripStrength: 30, forearmRotation: 140, functionalScore: 76 },
  { week: 'W7', rom: 138, quality: 84, pain: 2, gripStrength: 33, forearmRotation: 155, functionalScore: 83 },
  { week: 'W8', rom: 142, quality: 89, pain: 1, gripStrength: 36, forearmRotation: 165, functionalScore: 90 },
];

export function getProgressByType(type: RehabType) {
  if (type === 'knee') return MOCK_KNEE_PROGRESS;
  if (type === 'leg') return MOCK_LEG_PROGRESS;
  return MOCK_ELBOW_PROGRESS;
}

// ─── Mock Sessions ────────────────────────────────────────────────────────────

export const MOCK_SESSIONS: PatientSession[] = [
  { id: 's1', date: '2026-05-12', exerciseId: 'knee-ex-4', exerciseTitle: 'Mini Squats',               quality: 88, painLevel: 2, duration: 720, rehabType: 'knee' },
  { id: 's2', date: '2026-05-11', exerciseId: 'knee-ex-3', exerciseTitle: 'Heel Slides',               quality: 82, painLevel: 3, duration: 480, rehabType: 'knee' },
  { id: 's3', date: '2026-05-10', exerciseId: 'knee-ex-5', exerciseTitle: 'Terminal Knee Extension',   quality: 90, painLevel: 2, duration: 720, rehabType: 'knee' },
  { id: 's4', date: '2026-05-09', exerciseId: 'knee-ex-2', exerciseTitle: 'Straight Leg Raise',        quality: 76, painLevel: 4, duration: 600, rehabType: 'knee' },
  { id: 's5', date: '2026-05-12', exerciseId: 'leg-ex-5',  exerciseTitle: 'Single-Leg Balance',        quality: 79, painLevel: 2, duration: 600, rehabType: 'leg' },
  { id: 's6', date: '2026-05-11', exerciseId: 'leg-ex-4',  exerciseTitle: 'Forward Step-Up',           quality: 85, painLevel: 2, duration: 720, rehabType: 'leg' },
  { id: 's7', date: '2026-05-12', exerciseId: 'elbow-ex-4', exerciseTitle: 'Bicep Curl',               quality: 83, painLevel: 2, duration: 600, rehabType: 'elbow' },
  { id: 's8', date: '2026-05-11', exerciseId: 'elbow-ex-6', exerciseTitle: 'Grip Strengthening',       quality: 87, painLevel: 1, duration: 480, rehabType: 'elbow' },
];

export function getSessionsByType(type: RehabType): PatientSession[] {
  return MOCK_SESSIONS.filter(s => s.rehabType === type);
}

// ─── Mock Patients (Doctor View) ──────────────────────────────────────────────

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p1', name: 'Ali Hassan', age: 34, injuryType: 'Knee', rehabType: 'knee',
    recoveryProgress: 72, nextSession: '2026-05-13', lastActive: '2026-05-12',
    planId: 'plan-knee-1', currentPhase: 2, adherenceRate: 88, sessionsCompleted: 18,
    assignedDoctor: 'Dr. Smith', alerts: [],
  },
  {
    id: 'p2', name: 'Sara Malik', age: 28, injuryType: 'Elbow', rehabType: 'elbow',
    recoveryProgress: 55, nextSession: '2026-05-14', lastActive: '2026-05-11',
    planId: 'plan-elbow-1', currentPhase: 2, adherenceRate: 75, sessionsCompleted: 12,
    assignedDoctor: 'Dr. Smith', alerts: ['Pain level increase reported'],
  },
  {
    id: 'p3', name: 'Omar Yusuf', age: 42, injuryType: 'Leg', rehabType: 'leg',
    recoveryProgress: 90, nextSession: '2026-05-15', lastActive: '2026-05-12',
    planId: 'plan-leg-1', currentPhase: 4, adherenceRate: 95, sessionsCompleted: 32,
    assignedDoctor: 'Dr. Smith', alerts: [],
  },
  {
    id: 'p4', name: 'Fatima Al-Rashid', age: 55, injuryType: 'Knee', rehabType: 'knee',
    recoveryProgress: 38, nextSession: '2026-05-13', lastActive: '2026-05-10',
    planId: 'plan-knee-2', currentPhase: 1, adherenceRate: 62, sessionsCompleted: 7,
    assignedDoctor: 'Dr. Smith', alerts: ['Missed 2 sessions this week', 'High pain scores'],
  },
  {
    id: 'p5', name: 'James Okonkwo', age: 31, injuryType: 'Elbow', rehabType: 'elbow',
    recoveryProgress: 68, nextSession: '2026-05-14', lastActive: '2026-05-12',
    planId: 'plan-elbow-2', currentPhase: 3, adherenceRate: 82, sessionsCompleted: 21,
    assignedDoctor: 'Dr. Smith', alerts: [],
  },
];

// ─── ML Pipeline Status ───────────────────────────────────────────────────────

export const ML_PIPELINES: Record<RehabType, MLPipelineStatus[]> = {
  knee: [
    { pipelineId: 'knee-ml-1', name: 'Knee Angle Tracker', rehabType: 'knee', status: 'active', description: 'MediaPipe Pose tracks knee flexion/extension angle in real time from the device camera.' },
    { pipelineId: 'knee-ml-2', name: 'Movement Quality Classifier', rehabType: 'knee', status: 'active', description: 'UCI Physical Therapy model (5-sensor, 45-channel) scores exercise form: correct / fast / low_amplitude.' },
  ],
  leg: [
    { pipelineId: 'leg-ml-1', name: 'Exercise Type Classifier', rehabType: 'leg', status: 'active', description: 'HugaDB model (6-sensor, 36-channel) classifies lower-limb exercise type from IMU in real time.' },
    { pipelineId: 'leg-ml-2', name: 'Movement Quality Classifier', rehabType: 'leg', status: 'active', description: 'Single-sensor quality model (6-channel) rates form as correct / too_fast / shaky / low_amplitude.' },
  ],
  elbow: [
    { pipelineId: 'elbow-ml-1', name: 'Elbow Angle & ROM Tracker', rehabType: 'elbow', status: 'active', description: 'Gyro integration tracks live elbow flexion angle; MediaPipe Pose measures range of motion from camera.' },
    { pipelineId: 'elbow-ml-2', name: 'Movement Quality Classifier', rehabType: 'elbow', status: 'active', description: 'Single-sensor quality model (6-channel) rates repetition form in real time.' },
  ],
};

// ─── IMU Sensor Placeholders ──────────────────────────────────────────────────
// TODO: Replace with real BLE/USB IMU device connections

export const SENSOR_PLACEHOLDERS: Record<RehabType, SensorStatus[]> = {
  knee: [
    { sensorId: 'imu-knee-1', name: 'Thigh IMU', placement: 'Anterior thigh — 5 cm above patella', connected: false },
    { sensorId: 'imu-knee-2', name: 'Shank IMU', placement: 'Anterior shin — tibial crest', connected: false },
    { sensorId: 'imu-knee-3', name: 'Foot IMU',  placement: 'Dorsum of foot', connected: false },
  ],
  leg: [
    { sensorId: 'imu-leg-1', name: 'Hip IMU',   placement: 'Lateral pelvis / ASIS region', connected: false },
    { sensorId: 'imu-leg-2', name: 'Thigh IMU', placement: 'Lateral mid-thigh', connected: false },
    { sensorId: 'imu-leg-3', name: 'Calf IMU',  placement: 'Posterior calf — gastrocnemius belly', connected: false },
  ],
  elbow: [
    { sensorId: 'imu-elbow-1', name: 'Upper Arm IMU', placement: 'Lateral mid-humerus', connected: false },
    { sensorId: 'imu-elbow-2', name: 'Forearm IMU',   placement: 'Dorsal forearm — mid-radius', connected: false },
    { sensorId: 'imu-elbow-3', name: 'Wrist IMU',     placement: 'Dorsal wrist — distal radius', connected: false },
  ],
};

// Legacy alias kept so existing imports don't break
export const MOCK_EXERCISES: Exercise[] = ALL_EXERCISES;

// ─── Skeleton133 ML label → Knee exercise ID mapping ──────────────────────────
// ⚠️ KNOWN BROKEN — DO NOT TRUST THE "MATCHES TARGET" CHECK.
//
// The skeleton133 model is trained on REHAB24-6 (dataML/133/), whose Ex1..Ex6
// labels correspond to:
//     Ex1: arm rotation / abduction
//     Ex2: arm raise overhead
//     Ex3: squat
//     Ex4: single-leg raise
//     Ex5: single-leg lunge
//     Ex6: step-up / step-out
// (confirmed by reading dataML/133/Segmentation.csv `exercise_subtype` column).
//
// These are NOT the clinical knee exercises we prescribe (Quad Sets, Straight
// Leg Raise, Heel Slides, …). The "Matching target exercise" badge that this
// mapping powers has been hidden in the coached-session UI for that reason —
// see RehabSession.tsx. Fixing it properly requires either retraining a model
// on our exercise set OR redesigning the prescribed exercise list to align
// with what the model already knows.
export const KNEE_ML_LABEL_TO_EXERCISE_ID: Record<string, string> = {
  Ex1: 'knee-ex-1', // Quad Sets       — model actually sees: arm rotation
  Ex2: 'knee-ex-2', // Straight Leg    — model actually sees: arm raise
  Ex3: 'knee-ex-3', // Heel Slides     — model actually sees: squat
  Ex4: 'knee-ex-4', // Mini Squats     — model actually sees: single-leg raise
  Ex5: 'knee-ex-5', // Terminal Knee   — model actually sees: single-leg lunge
  Ex6: 'knee-ex-6', // Step-Ups        — model actually sees: step-up (only one that matches)
};

export const KNEE_EXERCISE_ID_TO_ML_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(KNEE_ML_LABEL_TO_EXERCISE_ID).map(([k, v]) => [v, k])
);
