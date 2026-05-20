/**
 * Anatomical reference diagram for each exercise.
 *
 * Every exercise gets a hand-drawn SVG showing:
 *   - A simplified human silhouette in the correct exercise position
 *   - The active muscle group highlighted in the rehab module's accent color
 *   - A motion arrow indicating the rep direction
 *   - A small label naming the primary target muscle
 *
 * We used to extract photos from dataML/133 demo videos, but those videos
 * depict REHAB24-6's 6 generic exercises (arm raise, squat, lunge, etc.) —
 * NOT the 18 clinical rehab exercises we prescribe. See
 * KNEE_ML_LABEL_TO_EXERCISE_ID in constants.ts for the full mismatch.
 * SVGs are accurate by construction.
 */

import React from 'react';
import { cn } from '../lib/utils';
import type { Exercise } from '../types';
import { REHAB_MODULES } from '../constants';

interface Props {
  exercise: Exercise;
  className?: string;
}

export function ExerciseDemo({ exercise, className }: Props) {
  const colors = REHAB_MODULES[exercise.rehabType].colors;
  const renderer = DIAGRAMS[exercise.id];

  return (
    <div className={cn(
      'relative rounded-2xl overflow-hidden border bg-gradient-to-br from-slate-50 to-slate-100',
      colors.border,
      'aspect-[4/3] flex items-center justify-center',
      className,
    )}>
      {renderer ? renderer(colors.chartHex) : (
        <p className="text-xs text-slate-400">No reference diagram</p>
      )}
      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-900/70 text-white backdrop-blur-sm">
        Anatomy
      </span>
    </div>
  );
}

// ── Drawing primitives ────────────────────────────────────────────────────────

const SKIN  = '#e2e8f0';   // body fill
const EDGE  = '#94a3b8';   // body outline
const DARK  = '#475569';   // joints / detail
const FLOOR = '#cbd5e1';

const Frame = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <svg viewBox="0 0 240 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="currentColor" />
      </marker>
    </defs>
    {children}
    {label && (
      <text x="120" y="172" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="700"
            letterSpacing="0.5">
        {label}
      </text>
    )}
  </svg>
);

/** A line marked with the active-muscle accent color, slightly thicker. */
const Muscle = (d: string, accent: string) => (
  <path d={d} stroke={accent} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.85" />
);

/** A filled blob for a bulk muscle group (e.g. quad belly, calf). */
const MuscleBlob = (d: string, accent: string) => (
  <path d={d} fill={accent} opacity="0.55" stroke={accent} strokeWidth="1" />
);

/** Curved arrow showing motion direction. */
const Arrow = (d: string, accent: string) => (
  <path d={d} stroke={accent} strokeWidth="2" fill="none"
        markerEnd="url(#arrow)" strokeLinecap="round" style={{ color: accent }} />
);

/** A joint dot to anchor the body shape. */
const Joint = (cx: number, cy: number, r = 3) =>
  <circle cx={cx} cy={cy} r={r} fill={DARK} />;

const Floor = () => (
  <line x1="20" y1="160" x2="220" y2="160" stroke={FLOOR} strokeWidth="1.5" strokeDasharray="3 3" />
);

// ── Reusable body parts ──────────────────────────────────────────────────────
// Each helper returns a JSX fragment positioned around an anchor point.

const HeadFront = (cx: number, cy: number, r = 9) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={EDGE} strokeWidth="1.2" />
    {/* simple face hint */}
    <circle cx={cx - 3} cy={cy - 1} r="0.9" fill={DARK} />
    <circle cx={cx + 3} cy={cy - 1} r="0.9" fill={DARK} />
  </g>
);

const HeadSide = (cx: number, cy: number, r = 9) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={EDGE} strokeWidth="1.2" />
    <circle cx={cx + 3} cy={cy - 1} r="0.9" fill={DARK} />
  </g>
);

/** Tapered limb from (x1,y1) to (x2,y2). Thickness shrinks toward the second point. */
const Limb = (x1: number, y1: number, x2: number, y2: number, t1 = 6, t2 = 5) => {
  // Compute a thin trapezoid by offsetting perpendicular to the limb axis.
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const p1 = `${x1 + nx * t1},${y1 + ny * t1}`;
  const p2 = `${x1 - nx * t1},${y1 - ny * t1}`;
  const p3 = `${x2 - nx * t2},${y2 - ny * t2}`;
  const p4 = `${x2 + nx * t2},${y2 + ny * t2}`;
  return (
    <path d={`M ${p1} L ${p2} L ${p3} L ${p4} Z`}
          fill={SKIN} stroke={EDGE} strokeWidth="1" strokeLinejoin="round" />
  );
};

const Torso = (cx: number, top: number, bottom: number, halfW = 13) => {
  const wTop = halfW, wBot = halfW - 3;
  return (
    <path d={`M ${cx - wTop} ${top}
              Q ${cx} ${top - 2} ${cx + wTop} ${top}
              L ${cx + wBot} ${bottom}
              Q ${cx} ${bottom + 2} ${cx - wBot} ${bottom} Z`}
          fill={SKIN} stroke={EDGE} strokeWidth="1.2" strokeLinejoin="round" />
  );
};

const MuscleLabel = (x: number, y: number, text: string, accent: string) => (
  <g>
    <rect x={x - 28} y={y - 8} width="56" height="13" rx="6"
          fill="white" stroke={accent} strokeWidth="1" opacity="0.95" />
    <text x={x} y={y + 1} textAnchor="middle" fontSize="8" fontWeight="700" fill={accent}>
      {text}
    </text>
  </g>
);

type DiagramFn = (accent: string) => React.ReactNode;

// ── Knee diagrams ─────────────────────────────────────────────────────────────

// Supine (lying on back). Used by Quad Sets, Straight Leg Raise, Heel Slides.
// Origin: head at (45, 90), feet to the right.
const kneeQuadSets: DiagramFn = (accent) => (
  <Frame label="Quadriceps isometric — no movement">
    <Floor />
    {/* lying on table */}
    <rect x="30" y="100" width="190" height="6" fill={FLOOR} rx="2" />
    {HeadSide(45, 90)}
    {Torso(75, 80, 100, 10)}
    <g>{/* arms relaxed at sides */}
      {Limb(73, 88, 60, 105, 4, 3)}
      {Limb(77, 92, 95, 105, 4, 3)}
    </g>
    {/* legs both straight */}
    {Limb(105, 95, 165, 96, 7, 6)}{/* thigh */}
    {Limb(165, 96, 215, 97, 6, 5)}{/* shin */}
    {Joint(165, 96, 4)}{/* knee */}
    {/* Active muscle: quadriceps on the front of the thigh */}
    {MuscleBlob('M 110 91 Q 138 86 162 92 Q 162 96 138 100 Q 110 99 110 95 Z', accent)}
    {/* contraction arrow (squeeze, not motion) */}
    <g style={{ color: accent }}>
      <path d="M 135 78 L 135 85" stroke={accent} strokeWidth="1.5" />
      <path d="M 135 78 L 132 81 M 135 78 L 138 81" stroke={accent} strokeWidth="1.5" fill="none" />
      <path d="M 135 110 L 135 103" stroke={accent} strokeWidth="1.5" />
      <path d="M 135 110 L 132 107 M 135 110 L 138 107" stroke={accent} strokeWidth="1.5" fill="none" />
    </g>
    {MuscleLabel(155, 70, 'Quadriceps', accent)}
  </Frame>
);

const kneeStraightLegRaise: DiagramFn = (accent) => (
  <Frame label="Lift straight leg to 45°">
    <Floor />
    <rect x="30" y="100" width="190" height="6" fill={FLOOR} rx="2" />
    {HeadSide(45, 90)}
    {Torso(75, 80, 100, 10)}
    {Limb(73, 88, 60, 105, 4, 3)}
    {Limb(77, 92, 95, 105, 4, 3)}
    {/* Bent (unaffected) leg flat */}
    {Limb(105, 99, 145, 95, 6, 5)}
    {Limb(145, 95, 175, 99, 5, 5)}
    {/* Affected leg raised at ~45° — anchored at hip (105,95) */}
    {Limb(105, 95, 165, 60, 7, 6)}
    {Limb(165, 60, 210, 35, 6, 5)}
    {Joint(165, 60, 4)}
    {MuscleBlob('M 112 94 Q 138 78 162 64 Q 165 68 142 84 Q 116 99 112 96 Z', accent)}
    {/* Motion arrow at hip */}
    <g style={{ color: accent }}>
      {Arrow('M 130 100 Q 145 90 158 70', accent)}
    </g>
    {MuscleLabel(195, 30, 'Quadriceps', accent)}
  </Frame>
);

const kneeHeelSlides: DiagramFn = (accent) => (
  <Frame label="Slide heel toward buttocks">
    <Floor />
    <rect x="30" y="100" width="190" height="6" fill={FLOOR} rx="2" />
    {HeadSide(45, 90)}
    {Torso(75, 80, 100, 10)}
    {Limb(73, 88, 60, 105, 4, 3)}
    {Limb(77, 92, 95, 105, 4, 3)}
    {/* Bent leg sliding up */}
    {Limb(105, 95, 145, 80, 6, 5)}
    {Limb(145, 80, 130, 100, 5, 5)}
    {Joint(145, 80, 4)}
    {/* Ghost of straight position */}
    {Limb(105, 95, 160, 96, 6, 5)}
    {Limb(160, 96, 205, 97, 5, 5)}
    <g opacity="0.25">
      <line x1="160" y1="96" x2="160" y2="96" />
    </g>
    {/* Hamstring + knee joint highlighted */}
    {MuscleBlob('M 142 78 Q 135 95 130 102 Q 124 100 135 80 Z', accent)}
    <circle cx="145" cy="80" r="10" fill={accent} opacity="0.18" />
    <g style={{ color: accent }}>
      {Arrow('M 200 92 Q 175 92 155 82', accent)}
    </g>
    {MuscleLabel(175, 60, 'Knee Flexion', accent)}
  </Frame>
);

const kneeMiniSquats: DiagramFn = (accent) => (
  <Frame label="Quadriceps + Gluteals (0–45° squat)">
    <Floor />
    {HeadFront(120, 30)}
    {Torso(120, 39, 78, 14)}
    {/* Arms forward for balance */}
    {Limb(108, 50, 90, 78, 4, 3)}
    {Limb(132, 50, 150, 78, 4, 3)}
    {/* Bent legs — thighs angled outward, shins more vertical */}
    {Limb(112, 78, 95, 118, 7, 6)}
    {Limb(95, 118, 100, 158, 6, 5)}
    {Limb(128, 78, 145, 118, 7, 6)}
    {Limb(145, 118, 140, 158, 6, 5)}
    {Joint(95, 118, 4)}
    {Joint(145, 118, 4)}
    {/* Quad bulges */}
    {MuscleBlob('M 108 80 Q 95 100 95 118 Q 102 115 110 100 Q 113 88 108 80 Z', accent)}
    {MuscleBlob('M 132 80 Q 145 100 145 118 Q 138 115 130 100 Q 127 88 132 80 Z', accent)}
    {/* Glute hint */}
    <ellipse cx="120" cy="76" rx="12" ry="5" fill={accent} opacity="0.45" />
    {/* Downward motion */}
    <g style={{ color: accent }}>
      {Arrow('M 168 60 L 168 95', accent)}
    </g>
    {MuscleLabel(195, 110, 'Quads + Glutes', accent)}
  </Frame>
);

const kneeTerminalKneeExtension: DiagramFn = (accent) => (
  <Frame label="Push knee to full extension">
    <Floor />
    {HeadFront(80, 32)}
    {Torso(80, 41, 90, 13)}
    {Limb(70, 50, 56, 82, 4, 3)}
    {Limb(90, 50, 104, 82, 4, 3)}
    {/* Standing leg (back) */}
    {Limb(75, 90, 72, 158, 6, 5)}
    {/* Active leg — slight bend → extension */}
    {Limb(85, 90, 90, 122, 7, 6)}
    {Limb(90, 122, 92, 158, 6, 5)}
    {Joint(90, 122, 5)}
    {/* Band */}
    <path d="M 100 122 Q 150 122 200 122" stroke={accent} strokeWidth="2.5" strokeDasharray="3 2" fill="none" />
    <rect x="198" y="115" width="14" height="14" rx="2" fill={DARK} />
    {/* Quad highlight on active leg */}
    {MuscleBlob('M 81 92 Q 93 105 92 121 Q 87 121 79 110 Q 78 96 81 92 Z', accent)}
    <g style={{ color: accent }}>
      {Arrow('M 80 138 Q 105 134 80 116', accent)}
    </g>
    {MuscleLabel(150, 60, 'Vastus Medialis', accent)}
  </Frame>
);

const kneeStepUps: DiagramFn = (accent) => (
  <Frame label="Drive through quad onto step">
    <Floor />
    {/* Step */}
    <rect x="135" y="118" width="80" height="38" fill={FLOOR} rx="3" stroke={EDGE} strokeWidth="1" />
    {HeadFront(95, 32)}
    {Torso(95, 41, 88, 13)}
    {Limb(85, 50, 70, 82, 4, 3)}
    {Limb(105, 50, 118, 82, 4, 3)}
    {/* Trailing leg on floor */}
    {Limb(88, 90, 80, 158, 6, 5)}
    {/* Lead leg on step */}
    {Limb(102, 90, 150, 118, 7, 6)}
    {Limb(150, 118, 175, 152, 6, 5)}
    {Joint(150, 118, 5)}
    {/* Quad on lead leg */}
    {MuscleBlob('M 105 91 Q 130 100 148 117 Q 144 122 122 113 Q 105 102 105 95 Z', accent)}
    {/* Glute */}
    <ellipse cx="120" cy="84" rx="14" ry="5" fill={accent} opacity="0.5" />
    <g style={{ color: accent }}>
      {Arrow('M 95 142 Q 122 138 145 122', accent)}
    </g>
    {MuscleLabel(195, 100, 'Quads + Glutes', accent)}
  </Frame>
);

// ── Leg diagrams ──────────────────────────────────────────────────────────────

const legCalfRaise: DiagramFn = (accent) => (
  <Frame label="Lift heels — calves engaged">
    <Floor />
    {HeadFront(120, 28)}
    {Torso(120, 37, 92, 13)}
    {Limb(108, 48, 95, 82, 4, 3)}
    {Limb(132, 48, 145, 82, 4, 3)}
    {Limb(114, 90, 112, 140, 6, 5)}
    {Limb(126, 90, 128, 140, 6, 5)}
    {/* Ankles raised — foot tilted forward */}
    {Limb(112, 140, 104, 152, 5, 4)}
    {Limb(128, 140, 136, 152, 5, 4)}
    {/* Calf muscles */}
    {MuscleBlob('M 110 116 Q 102 128 109 142 Q 116 138 116 122 Z', accent)}
    {MuscleBlob('M 130 116 Q 138 128 131 142 Q 124 138 124 122 Z', accent)}
    <g style={{ color: accent }}>
      {Arrow('M 80 154 Q 75 130 92 122', accent)}
    </g>
    {MuscleLabel(180, 130, 'Gastrocnemius', accent)}
  </Frame>
);

const legSideLyingHipAbduction: DiagramFn = (accent) => (
  <Frame label="Lift top leg straight up">
    <Floor />
    <rect x="20" y="120" width="200" height="6" fill={FLOOR} rx="2" />
    {/* Side view — head on left, body horizontal */}
    {HeadSide(38, 92)}
    {/* Torso horizontal */}
    <path d="M 48 84 L 48 102 L 130 100 L 130 90 Z" fill={SKIN} stroke={EDGE} strokeWidth="1.2" />
    {/* Arm under head */}
    {Limb(58, 88, 40, 80, 3, 3)}
    {Limb(58, 88, 30, 96, 3, 3)}
    {/* Bottom leg straight on the floor */}
    {Limb(130, 100, 180, 105, 7, 6)}
    {Limb(180, 105, 215, 110, 6, 5)}
    {/* Top leg lifted at ~40° */}
    {Limb(130, 90, 180, 70, 7, 6)}
    {Limb(180, 70, 215, 50, 6, 5)}
    {Joint(180, 70, 4)}
    {/* Hip abductor highlight (gluteus medius) */}
    <ellipse cx="135" cy="84" rx="9" ry="5" fill={accent} opacity="0.7" />
    {MuscleBlob('M 132 88 Q 155 78 180 70 Q 182 75 158 86 Q 138 95 132 92 Z', accent)}
    <g style={{ color: accent }}>
      {Arrow('M 213 102 Q 218 78 213 55', accent)}
    </g>
    {MuscleLabel(120, 50, 'Gluteus Medius', accent)}
  </Frame>
);

const legProneHamstringCurl: DiagramFn = (accent) => (
  <Frame label="Curl heel toward glutes">
    <Floor />
    <rect x="20" y="118" width="200" height="6" fill={FLOOR} rx="2" />
    {/* Prone — face down, side view */}
    {HeadSide(38, 110)}
    <path d="M 48 100 L 48 116 L 135 116 L 135 102 Z" fill={SKIN} stroke={EDGE} strokeWidth="1.2" />
    {Limb(55, 100, 35, 92, 3, 3)}
    {/* Straight leg */}
    {Limb(135, 110, 175, 115, 7, 6)}
    {Limb(175, 115, 215, 115, 6, 5)}
    {/* Bent leg curling up */}
    {Limb(135, 108, 170, 92, 7, 6)}
    {Limb(170, 92, 150, 60, 6, 5)}
    {Joint(170, 92, 5)}
    {/* Hamstring */}
    {MuscleBlob('M 137 102 Q 155 95 168 88 Q 174 92 160 102 Q 142 110 137 108 Z', accent)}
    {MuscleBlob('M 162 88 Q 167 78 152 64 Q 145 70 156 88 Z', accent)}
    <g style={{ color: accent }}>
      {Arrow('M 180 110 Q 178 75 153 58', accent)}
    </g>
    {MuscleLabel(120, 50, 'Hamstrings', accent)}
  </Frame>
);

const legForwardStepUp: DiagramFn = (accent) => (
  <Frame label="Hip-hinge then drive up">
    <Floor />
    <rect x="145" y="115" width="70" height="45" fill={FLOOR} rx="3" stroke={EDGE} strokeWidth="1" />
    {HeadFront(85, 32)}
    {/* Torso hinged forward */}
    <path d="M 73 41 L 76 76 L 102 84 L 100 49 Z" fill={SKIN} stroke={EDGE} strokeWidth="1.2" />
    {Limb(76, 50, 60, 84, 4, 3)}
    {Limb(98, 52, 116, 84, 4, 3)}
    {/* Trailing leg */}
    {Limb(85, 80, 75, 158, 6, 5)}
    {/* Lead leg on step */}
    {Limb(102, 82, 158, 115, 7, 6)}
    {Limb(158, 115, 180, 152, 6, 5)}
    {Joint(158, 115, 5)}
    {/* Glute + hamstring */}
    <ellipse cx="110" cy="74" rx="12" ry="5" fill={accent} opacity="0.7" />
    {MuscleBlob('M 105 80 Q 130 96 156 113 Q 152 119 130 109 Q 108 96 105 86 Z', accent)}
    <g style={{ color: accent }}>
      {Arrow('M 95 138 Q 130 132 152 120', accent)}
    </g>
    {MuscleLabel(195, 90, 'Glutes', accent)}
  </Frame>
);

const legSingleLegBalance: DiagramFn = (accent) => (
  <Frame label="Hold balance — hip stabilizers">
    <Floor />
    {HeadFront(120, 28)}
    {Torso(120, 37, 88, 13)}
    {Limb(108, 48, 88, 60, 4, 3)}
    {Limb(132, 48, 152, 60, 4, 3)}
    {/* Planted leg */}
    {Limb(120, 86, 120, 158, 7, 6)}
    {Joint(120, 122, 5)}
    {/* Lifted leg bent in front */}
    {Limb(124, 88, 152, 124, 6, 5)}
    {Limb(152, 124, 130, 142, 5, 4)}
    {/* Stabilizer muscles */}
    {MuscleBlob('M 113 90 Q 113 120 113 156 Q 118 156 118 120 Q 118 90 113 90 Z', accent)}
    {MuscleBlob('M 122 90 Q 122 120 122 156 Q 127 156 127 120 Q 127 90 122 90 Z', accent)}
    <ellipse cx="120" cy="86" rx="11" ry="4" fill={accent} opacity="0.6" />
    {/* Balance wobble */}
    <path d="M 80 162 Q 120 168 160 162" stroke={accent} strokeWidth="1.5" fill="none"
          strokeDasharray="3 2" opacity="0.6" />
    {MuscleLabel(75, 100, 'Hip + Quad', accent)}
  </Frame>
);

const legLateralBandWalk: DiagramFn = (accent) => (
  <Frame label="Side-step against band tension">
    <Floor />
    {HeadFront(120, 30)}
    {Torso(120, 39, 90, 13)}
    {Limb(108, 50, 92, 88, 4, 3)}
    {Limb(132, 50, 148, 88, 4, 3)}
    {/* Wide-stance legs, bent slightly */}
    {Limb(114, 92, 90, 158, 7, 6)}
    {Limb(126, 92, 150, 158, 7, 6)}
    {/* Band around shins */}
    <path d="M 92 145 Q 120 132 148 145" stroke={accent} strokeWidth="3" fill="none" strokeDasharray="2 3" />
    {/* Glute medius (hip abductors) */}
    <ellipse cx="105" cy="90" rx="8" ry="4" fill={accent} opacity="0.7" />
    <ellipse cx="135" cy="90" rx="8" ry="4" fill={accent} opacity="0.7" />
    {MuscleBlob('M 110 92 Q 95 120 92 156 Q 100 156 105 124 Q 113 100 110 92 Z', accent)}
    {MuscleBlob('M 130 92 Q 145 120 148 156 Q 140 156 135 124 Q 127 100 130 92 Z', accent)}
    <g style={{ color: accent }}>
      {Arrow('M 60 158 L 38 158', accent)}
      {Arrow('M 180 158 L 202 158', accent)}
    </g>
    {MuscleLabel(60, 60, 'Hip Abductors', accent)}
  </Frame>
);

// ── Elbow diagrams ────────────────────────────────────────────────────────────

const elbowFlexionExtension: DiagramFn = (accent) => (
  <Frame label="Bend and straighten the elbow">
    <Floor />
    {HeadFront(120, 32)}
    {Torso(120, 41, 100, 13)}
    {/* Resting arm */}
    {Limb(108, 52, 95, 95, 5, 4)}
    {Limb(95, 95, 100, 130, 4, 4)}
    {/* Active arm — bent up */}
    {Limb(132, 52, 158, 92, 5, 4)}
    {Limb(158, 92, 138, 56, 4, 4)}
    {Joint(158, 92, 5)}
    {/* Bicep highlight on upper arm */}
    {MuscleBlob('M 135 56 Q 148 72 158 89 Q 152 92 142 78 Q 132 62 135 56 Z', accent)}
    {/* Legs */}
    {Limb(114, 102, 104, 158, 6, 5)}
    {Limb(126, 102, 132, 158, 6, 5)}
    <g style={{ color: accent }}>
      {Arrow('M 172 92 Q 195 70 165 50', accent)}
    </g>
    {MuscleLabel(195, 60, 'Biceps Brachii', accent)}
  </Frame>
);

const elbowSupinationPronation: DiagramFn = (accent) => (
  <Frame label="Rotate palm up ↔ down">
    <Floor />
    <rect x="30" y="118" width="190" height="6" fill={FLOOR} rx="2" />
    {/* Upper arm vertical */}
    {Limb(80, 70, 80, 118, 6, 6)}
    {Joint(80, 118, 5)}
    {/* Forearm extends to the right */}
    {Limb(80, 118, 180, 118, 6, 6)}
    {/* Pronator + supinator muscles (forearm rotators) */}
    {MuscleBlob('M 90 113 Q 130 110 175 113 Q 175 123 130 122 Q 90 123 90 116 Z', accent)}
    {/* Palm/hand circle */}
    <circle cx="184" cy="118" r="6" fill={SKIN} stroke={EDGE} strokeWidth="1" />
    {/* Rotation arrows */}
    <g style={{ color: accent }}>
      <path d="M 184 100 A 16 16 0 0 1 200 118" stroke={accent} strokeWidth="2" fill="none"
            markerEnd="url(#arrow)" />
      <path d="M 200 118 A 16 16 0 0 1 184 134" stroke={accent} strokeWidth="2" fill="none"
            markerEnd="url(#arrow)" />
    </g>
    {MuscleLabel(120, 60, 'Pronator / Supinator', accent)}
  </Frame>
);

const elbowWristFlexion: DiagramFn = (accent) => (
  <Frame label="Flex and extend the wrist">
    <Floor />
    <rect x="30" y="118" width="190" height="6" fill={FLOOR} rx="2" />
    {/* Forearm on table */}
    {Limb(70, 118, 170, 118, 7, 7)}
    {Joint(170, 118, 5)}
    {/* Wrist flexed up + ghost extended */}
    {Limb(170, 118, 200, 86, 5, 4)}
    <g opacity="0.3">{Limb(170, 118, 200, 150, 5, 4)}</g>
    {/* Forearm flexors/extensors */}
    {MuscleBlob('M 75 113 Q 120 110 167 113 Q 167 123 120 122 Q 75 123 75 116 Z', accent)}
    <g style={{ color: accent }}>
      <path d="M 205 90 Q 222 118 205 146" stroke={accent} strokeWidth="2" fill="none"
            markerEnd="url(#arrow)" />
    </g>
    {MuscleLabel(120, 60, 'Forearm Flexors', accent)}
  </Frame>
);

const elbowBicepCurl: DiagramFn = (accent) => (
  <Frame label="Curl weight toward shoulder">
    <Floor />
    {HeadFront(120, 32)}
    {Torso(120, 41, 100, 13)}
    {/* Resting arm */}
    {Limb(108, 52, 96, 98, 5, 4)}
    {Limb(96, 98, 102, 132, 4, 4)}
    {/* Active arm holding dumbbell — curled */}
    {Limb(132, 52, 154, 96, 5, 4)}
    {Limb(154, 96, 142, 60, 4, 4)}
    {/* Dumbbell */}
    <rect x="128" y="50" width="22" height="8" rx="2" fill={DARK} />
    <rect x="126" y="46" width="5" height="16" rx="1" fill={DARK} />
    <rect x="147" y="46" width="5" height="16" rx="1" fill={DARK} />
    {Joint(154, 96, 5)}
    {/* Bicep peak */}
    {MuscleBlob('M 138 60 Q 152 76 156 95 Q 150 96 144 80 Q 134 65 138 60 Z', accent)}
    {/* Legs */}
    {Limb(114, 102, 104, 158, 6, 5)}
    {Limb(126, 102, 132, 158, 6, 5)}
    <g style={{ color: accent }}>
      {Arrow('M 168 96 Q 188 78 166 54', accent)}
    </g>
    {MuscleLabel(195, 90, 'Biceps', accent)}
  </Frame>
);

const elbowTricepOverhead: DiagramFn = (accent) => (
  <Frame label="Lower behind head, then extend up">
    <Floor />
    {HeadFront(120, 44)}
    {Torso(120, 53, 102, 13)}
    {/* Both arms overhead */}
    {Limb(110, 60, 96, 22, 5, 4)}
    {Limb(130, 60, 144, 22, 5, 4)}
    {/* Forearms angled behind head */}
    {Limb(96, 22, 112, 8, 4, 4)}
    {Limb(144, 22, 128, 8, 4, 4)}
    {/* Dumbbell at top */}
    <rect x="108" y="0" width="24" height="8" rx="2" fill={DARK} />
    <rect x="106" y="-4" width="5" height="16" rx="1" fill={DARK} />
    <rect x="129" y="-4" width="5" height="16" rx="1" fill={DARK} />
    {Joint(96, 22, 5)}
    {Joint(144, 22, 5)}
    {/* Tricep on back of upper arms */}
    {MuscleBlob('M 105 30 Q 100 50 110 60 Q 116 60 110 42 Q 108 32 105 30 Z', accent)}
    {MuscleBlob('M 135 30 Q 140 50 130 60 Q 124 60 130 42 Q 132 32 135 30 Z', accent)}
    {/* Legs */}
    {Limb(114, 114, 106, 158, 6, 5)}
    {Limb(126, 114, 134, 158, 6, 5)}
    <g style={{ color: accent }}>
      {Arrow('M 76 24 Q 64 50 80 70', accent)}
    </g>
    {MuscleLabel(190, 60, 'Triceps', accent)}
  </Frame>
);

const elbowGripStrength: DiagramFn = (accent) => (
  <Frame label="Squeeze, hold, then release">
    <Floor />
    {/* Forearm horizontal */}
    {Limb(36, 100, 130, 100, 8, 7)}
    {Joint(130, 100, 5)}
    {/* Palm wrapping ball */}
    {/* Ball */}
    <circle cx="172" cy="100" r="20" fill={accent} opacity="0.22" />
    <circle cx="172" cy="100" r="13" fill={accent} opacity="0.85" stroke={accent} strokeWidth="1" />
    {/* Fingers */}
    {Limb(130, 92, 168, 86, 4, 3)}
    {Limb(130, 100, 175, 96, 4, 3)}
    {Limb(130, 108, 170, 110, 4, 3)}
    {Limb(130, 86, 162, 82, 3, 3)}
    {/* Forearm flexors highlighted */}
    {MuscleBlob('M 40 94 Q 85 90 128 95 Q 128 105 85 110 Q 40 106 40 96 Z', accent)}
    {/* Compression arrows */}
    <g style={{ color: accent }}>
      <path d="M 200 88 L 188 94" stroke={accent} strokeWidth="2" markerEnd="url(#arrow)" fill="none" />
      <path d="M 200 112 L 188 106" stroke={accent} strokeWidth="2" markerEnd="url(#arrow)" fill="none" />
    </g>
    {MuscleLabel(75, 70, 'Forearm Flexors', accent)}
  </Frame>
);

const DIAGRAMS: Record<string, DiagramFn> = {
  // Knee
  'knee-ex-1': kneeQuadSets,
  'knee-ex-2': kneeStraightLegRaise,
  'knee-ex-3': kneeHeelSlides,
  'knee-ex-4': kneeMiniSquats,
  'knee-ex-5': kneeTerminalKneeExtension,
  'knee-ex-6': kneeStepUps,
  // Leg
  'leg-ex-1': legCalfRaise,
  'leg-ex-2': legSideLyingHipAbduction,
  'leg-ex-3': legProneHamstringCurl,
  'leg-ex-4': legForwardStepUp,
  'leg-ex-5': legSingleLegBalance,
  'leg-ex-6': legLateralBandWalk,
  // Elbow
  'elbow-ex-1': elbowFlexionExtension,
  'elbow-ex-2': elbowSupinationPronation,
  'elbow-ex-3': elbowWristFlexion,
  'elbow-ex-4': elbowBicepCurl,
  'elbow-ex-5': elbowTricepOverhead,
  'elbow-ex-6': elbowGripStrength,
};
