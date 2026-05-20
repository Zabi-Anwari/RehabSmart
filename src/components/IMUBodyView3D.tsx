/**
 * IMUBodyView3D  —  v2 (anatomically distinct models)
 *
 * Each body part has its own unique identifying geometry:
 *
 *  Knee  — close-up joint view; LARGE patella in front, wide femoral condyles,
 *           tibial tuberosity + fibula side-bone; shin pivots forward (extension)
 *
 *  Elbow — side-on view; PROMINENT olecranon point jutting backward (the one
 *           feature that makes it unmistakably an elbow); radius + ulna separate;
 *           forearm curls up into bicep-curl position
 *
 *  Leg   — full limb hip-to-ankle; LARGE hip ball-socket at top dwarfs the knee;
 *           long femur + calf; lower leg curls backward (hamstring-curl motion)
 *
 * Camera position, FOV and OrbitControls target differ per model so each is
 * well-framed without the user needing to rotate.
 */

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { RehabType } from '../types';

// ── Colour palettes ───────────────────────────────────────────────────────────
//  tissue = warm muscle/skin tone  |  joint = module accent  |  bone = ivory

const PALETTE: Record<RehabType, { tissue: string; joint: string; bone: string; accent: string }> = {
  knee:  { tissue: '#b06b50', joint: '#34d399', bone: '#e8d5c0', accent: '#6ee7b7' },
  leg:   { tissue: '#a86048', joint: '#818cf8', bone: '#e0d4c8', accent: '#c7d2fe' },
  elbow: { tissue: '#aa6452', joint: '#fb923c', bone: '#eeddd0', accent: '#fed7aa' },
};

// ── Material factory ──────────────────────────────────────────────────────────

function useMats(type: RehabType) {
  const p = PALETTE[type];
  return useMemo(() => ({
    // muscle / soft tissue
    muscle: new THREE.MeshStandardMaterial({ color: p.tissue,  roughness: 0.55, metalness: 0.04 }),
    // joint cartilage / accent
    jnt:    new THREE.MeshStandardMaterial({ color: p.joint,   roughness: 0.28, metalness: 0.14, envMapIntensity: 0.7 }),
    // exposed bone / epiphyses
    bone:   new THREE.MeshStandardMaterial({ color: p.bone,    roughness: 0.50, metalness: 0.06 }),
  }), [p.tissue, p.joint, p.bone]);
}

// ── Lighting rig ──────────────────────────────────────────────────────────────

function Lights() {
  return (
    <>
      <ambientLight intensity={0.50} color="#f0f4ff" />
      {/* Main key — warm, overhead-front */}
      <directionalLight castShadow position={[3, 8, 6]} intensity={1.20} color="#fff8e8"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8} shadow-camera-right={8}
        shadow-camera-top={8}   shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />
      {/* Cool fill from the left */}
      <directionalLight position={[-6, 3, -2]} intensity={0.38} color="#c8d8f0" />
      {/* Rim light — low, behind */}
      <directionalLight position={[0, -3, -8]} intensity={0.22} color="#a0c0e8" />
      {/* Soft point — highlights joints */}
      <pointLight position={[2, 1, 4]} intensity={0.30} color="#ffffff" />
    </>
  );
}

function ShadowGround() {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -4.2, 0]}>
      <planeGeometry args={[22, 22]} />
      <shadowMaterial opacity={0.22} />
    </mesh>
  );
}

// ── KNEE model ────────────────────────────────────────────────────────────────
//
// Close-up of the knee joint. Camera is to the right-front so the patella
// (kneecap) is clearly visible. The femoral condyles spread noticeably wider
// than the shafts above and below.
//
//  Thigh  ↑  (femur + quads + hamstring)
//  ════════  femoral condyles (wide) + PATELLA
//  Shin   ↓  (tibia + fibula + calf) — pivots forward on extension
//
function KneeModel({ angleDeg }: { angleDeg: number }) {
  const shinRef = useRef<THREE.Group>(null!);
  const cur     = useRef(0);
  const m       = useMats('knee');

  useFrame(() => {
    const target = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angleDeg, -12, 130));
    cur.current  = THREE.MathUtils.lerp(cur.current, target, 0.09);
    if (shinRef.current) shinRef.current.rotation.x = cur.current;
  });

  return (
    <group>
      {/* ─── Femur / thigh shaft ─── */}
      <mesh castShadow receiveShadow material={m.muscle} position={[0, 1.70, 0]}>
        <cylinderGeometry args={[0.34, 0.48, 3.40, 32]} />
      </mesh>
      {/* Rectus femoris – front quad belly */}
      <mesh castShadow material={m.muscle} position={[0.04, 0.82, 0.28]} scale={[0.38, 0.96, 0.34]}>
        <sphereGeometry args={[1, 18, 18]} />
      </mesh>
      {/* Vastus medialis – teardrop near inner knee */}
      <mesh castShadow material={m.muscle} position={[0.26, 0.20, 0.26]} scale={[0.30, 0.46, 0.28]}>
        <sphereGeometry args={[1, 14, 14]} />
      </mesh>
      {/* Hamstring bulk – back */}
      <mesh castShadow material={m.muscle} position={[0, 0.72, -0.28]} scale={[0.30, 0.78, 0.26]}>
        <sphereGeometry args={[1, 14, 14]} />
      </mesh>

      {/* ─── Femoral condyles – WIDE, defining knee shape ─── */}
      <mesh castShadow receiveShadow material={m.jnt} position={[ 0.46, -0.06, 0.04]} scale={[0.84, 0.74, 0.96]}>
        <sphereGeometry args={[0.44, 24, 24]} />
      </mesh>
      <mesh castShadow receiveShadow material={m.jnt} position={[-0.46, -0.06, 0.04]} scale={[0.84, 0.74, 0.96]}>
        <sphereGeometry args={[0.44, 24, 24]} />
      </mesh>
      {/* Intercondylar bridge */}
      <mesh castShadow material={m.jnt} position={[0, -0.06, 0.12]} scale={[0.38, 0.70, 0.74]}>
        <sphereGeometry args={[0.44, 20, 20]} />
      </mesh>

      {/* ─── PATELLA – large oval kneecap, most prominent feature ─── */}
      <mesh castShadow material={m.bone} position={[0, 0.22, 0.64]} scale={[1.40, 1.60, 0.70]}>
        <sphereGeometry args={[0.27, 24, 24]} />
      </mesh>
      {/* Patellar tendon */}
      <mesh castShadow material={m.muscle} position={[0, -0.18, 0.58]} scale={[0.24, 0.54, 0.16]}>
        <cylinderGeometry args={[1, 0.8, 1, 10]} />
      </mesh>

      {/* ─── Shin group (pivots on extension) ─── */}
      <group ref={shinRef}>
        {/* Tibia shaft */}
        <mesh castShadow receiveShadow material={m.muscle} position={[0, -1.56, 0.06]} scale={[1, 1, 0.86]}>
          <cylinderGeometry args={[0.38, 0.24, 3.12, 30]} />
        </mesh>
        {/* Fibula – thin lateral bone */}
        <mesh castShadow material={m.bone} position={[0.38, -1.74, 0]} scale={[0.36, 1, 0.36]}>
          <cylinderGeometry args={[0.11, 0.08, 2.80, 14]} />
        </mesh>
        {/* Tibial tuberosity – front bony bump */}
        <mesh castShadow material={m.bone} position={[0, -0.22, 0.48]} scale={[0.52, 0.64, 0.46]}>
          <sphereGeometry args={[0.22, 16, 16]} />
        </mesh>
        {/* Gastrocnemius medial head */}
        <mesh castShadow material={m.muscle} position={[-0.15, -1.20, -0.32]} scale={[0.26, 0.68, 0.24]}>
          <sphereGeometry args={[1, 16, 16]} />
        </mesh>
        {/* Gastrocnemius lateral head */}
        <mesh castShadow material={m.muscle} position={[ 0.14, -1.12, -0.30]} scale={[0.22, 0.60, 0.20]}>
          <sphereGeometry args={[1, 14, 14]} />
        </mesh>
        {/* Ankle malleoli – medial + lateral bumps */}
        <mesh castShadow receiveShadow material={m.bone} position={[ 0.30, -3.04, 0]} scale={[0.56, 0.42, 0.68]}>
          <sphereGeometry args={[0.26, 16, 16]} />
        </mesh>
        <mesh castShadow receiveShadow material={m.bone} position={[-0.30, -3.04, 0]} scale={[0.56, 0.42, 0.68]}>
          <sphereGeometry args={[0.26, 16, 16]} />
        </mesh>
      </group>
    </group>
  );
}

// ── ELBOW model ───────────────────────────────────────────────────────────────
//
// Viewed from the side (camera at ~45° azimuth) so the arm's profile is clear.
// Key identifier: the OLECRANON — the sharp elbow bone point that juts
// distinctly BACKWARD. No other joint has this shape.
//
//  Upper arm ↑  (humerus + bicep + tricep)
//  ══════════   humeral trochlea + epicondyles + OLECRANON (back)
//  Forearm   ↓  (radius + ulna) — pivots forward/up on bicep-curl motion
//
function ElbowModel({ angleDeg }: { angleDeg: number }) {
  const forearmRef = useRef<THREE.Group>(null!);
  const cur        = useRef(0);
  const m          = useMats('elbow');

  useFrame(() => {
    const target = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angleDeg, -5, 145));
    cur.current  = THREE.MathUtils.lerp(cur.current, target, 0.09);
    if (forearmRef.current) forearmRef.current.rotation.x = cur.current;
  });

  return (
    <group>
      {/* ─── Humerus / upper arm ─── */}
      <mesh castShadow receiveShadow material={m.muscle} position={[0, 1.60, 0]} scale={[0.92, 1, 0.90]}>
        <cylinderGeometry args={[0.30, 0.40, 3.20, 30]} />
      </mesh>
      {/* Bicep – front, peaks at mid-humerus */}
      <mesh castShadow material={m.muscle} position={[0.02, 0.72, 0.32]} scale={[0.36, 0.92, 0.32]}>
        <sphereGeometry args={[1, 20, 20]} />
      </mesh>
      {/* Short bicep head / coracobrachialis */}
      <mesh castShadow material={m.muscle} position={[-0.08, 0.55, 0.26]} scale={[0.24, 0.70, 0.24]}>
        <sphereGeometry args={[1, 14, 14]} />
      </mesh>
      {/* Tricep – back of upper arm */}
      <mesh castShadow material={m.muscle} position={[0, 0.64, -0.26]} scale={[0.28, 0.76, 0.24]}>
        <sphereGeometry args={[1, 16, 16]} />
      </mesh>
      {/* Deltoid – shoulder, widens the top */}
      <mesh castShadow material={m.muscle} position={[0, 3.02, 0]} scale={[1.60, 0.52, 1.30]}>
        <sphereGeometry args={[0.40, 18, 18]} />
      </mesh>

      {/* ─── Humeral trochlea + capitulum (elbow joint) ─── */}
      <mesh castShadow material={m.jnt} position={[0, 0, 0.06]} scale={[0.90, 0.76, 1.00]}>
        <sphereGeometry args={[0.44, 26, 26]} />
      </mesh>
      {/* Lateral epicondyle */}
      <mesh castShadow material={m.jnt} position={[ 0.56, 0.12, -0.04]} scale={[0.62, 0.50, 0.66]}>
        <sphereGeometry args={[0.30, 16, 16]} />
      </mesh>
      {/* Medial epicondyle */}
      <mesh castShadow material={m.jnt} position={[-0.56, 0.12, -0.04]} scale={[0.62, 0.50, 0.66]}>
        <sphereGeometry args={[0.30, 16, 16]} />
      </mesh>

      {/* ─── OLECRANON – the pointed elbow bone, juts sharply BACKWARD ─── */}
      {/* Main olecranon body */}
      <mesh castShadow receiveShadow material={m.bone} position={[0, -0.08, -0.62]} scale={[0.70, 0.90, 1.10]}>
        <sphereGeometry args={[0.32, 20, 20]} />
      </mesh>
      {/* Pointed tip */}
      <mesh castShadow material={m.bone} position={[0, -0.24, -0.90]} scale={[0.52, 0.72, 0.84]}>
        <sphereGeometry args={[0.22, 18, 18]} />
      </mesh>
      {/* Tricep tendon – connects tricep to olecranon */}
      <mesh castShadow material={m.muscle} position={[0, 0.18, -0.32]} scale={[0.18, 0.34, 0.16]}>
        <cylinderGeometry args={[1, 0.7, 1, 10]} />
      </mesh>

      {/* ─── Forearm (pivots on bicep-curl) ─── */}
      <group ref={forearmRef}>
        {/* Radius – lateral/thumb side */}
        <mesh castShadow receiveShadow material={m.muscle} position={[ 0.14, -1.42, 0.04]} scale={[0.80, 1, 0.84]}>
          <cylinderGeometry args={[0.20, 0.14, 2.84, 24]} />
        </mesh>
        {/* Ulna – medial/pinky side, slightly behind */}
        <mesh castShadow receiveShadow material={m.muscle} position={[-0.12, -1.46, -0.06]} scale={[0.68, 1, 0.76]}>
          <cylinderGeometry args={[0.18, 0.12, 2.92, 20]} />
        </mesh>
        {/* Brachioradialis – lateral forearm muscle */}
        <mesh castShadow material={m.muscle} position={[ 0.22, -0.82, 0.20]} scale={[0.30, 0.64, 0.26]}>
          <sphereGeometry args={[1, 14, 14]} />
        </mesh>
        {/* Pronator / flexor mass – medial */}
        <mesh castShadow material={m.muscle} position={[-0.14, -0.96, 0.18]} scale={[0.26, 0.56, 0.22]}>
          <sphereGeometry args={[1, 12, 12]} />
        </mesh>
        {/* Wrist – radial styloid */}
        <mesh castShadow receiveShadow material={m.bone} position={[ 0.16, -2.80, 0]} scale={[0.96, 0.46, 0.82]}>
          <sphereGeometry args={[0.25, 16, 16]} />
        </mesh>
        {/* Wrist – ulnar styloid */}
        <mesh castShadow receiveShadow material={m.bone} position={[-0.14, -2.76, -0.08]} scale={[0.86, 0.42, 0.74]}>
          <sphereGeometry args={[0.23, 14, 14]} />
        </mesh>
      </group>
    </group>
  );
}

// ── LEG model ─────────────────────────────────────────────────────────────────
//
// Full limb from iliac crest down to ankle. The LARGE hip ball-and-socket at
// the top is the unmistakable identifier — it's visibly bigger than the knee.
// The long femur + calf make the proportional difference from the knee model
// obvious. Lower leg curls backward (hamstring-curl exercise).
//
function LegModel({ angleDeg }: { angleDeg: number }) {
  const shinRef = useRef<THREE.Group>(null!);
  const cur     = useRef(0);
  const m       = useMats('leg');

  useFrame(() => {
    const target = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(angleDeg, -10, 130));
    cur.current  = THREE.MathUtils.lerp(cur.current, target, 0.09);
    if (shinRef.current) shinRef.current.rotation.x = -cur.current; // backward = hamstring curl
  });

  // Shift down so both hip (y≈3.1) and ankle (y≈-3.7) fit the viewport
  return (
    <group position={[0, -0.55, 0]}>
      {/* ─── Pelvis / iliac crest ─── */}
      <mesh castShadow material={m.muscle} position={[0, 4.52, -0.10]} scale={[2.10, 0.48, 0.88]}>
        <sphereGeometry args={[0.46, 18, 18]} />
      </mesh>
      {/* Greater trochanter */}
      <mesh castShadow material={m.bone} position={[0.62, 3.76, -0.18]} scale={[0.64, 0.56, 0.72]}>
        <sphereGeometry args={[0.30, 14, 14]} />
      </mesh>

      {/* ─── HIP JOINT — large ball-and-socket, dominant top feature ─── */}
      <mesh castShadow receiveShadow material={m.jnt} position={[0, 3.72, 0.04]} scale={[1.18, 1.12, 1.14]}>
        <sphereGeometry args={[0.62, 32, 32]} />
      </mesh>
      {/* Acetabular rim */}
      <mesh castShadow material={m.bone} position={[0, 3.72, 0]} scale={[1.35, 1.28, 1.30]}>
        <torusGeometry args={[0.56, 0.08, 12, 30]} />
      </mesh>

      {/* ─── Femur / thigh — long shaft ─── */}
      <mesh castShadow receiveShadow material={m.muscle} position={[0, 1.90, 0]} scale={[1, 1, 0.88]}>
        <cylinderGeometry args={[0.44, 0.52, 3.64, 32]} />
      </mesh>
      {/* Rectus femoris */}
      <mesh castShadow material={m.muscle} position={[0.04, 0.94, 0.28]} scale={[0.36, 0.90, 0.32]}>
        <sphereGeometry args={[1, 16, 16]} />
      </mesh>
      {/* Vastus lateralis */}
      <mesh castShadow material={m.muscle} position={[0.32, 0.86, 0.22]} scale={[0.28, 0.76, 0.24]}>
        <sphereGeometry args={[1, 14, 14]} />
      </mesh>
      {/* Biceps femoris (hamstring) */}
      <mesh castShadow material={m.muscle} position={[0.20, 0.80, -0.30]} scale={[0.24, 0.72, 0.22]}>
        <sphereGeometry args={[1, 14, 14]} />
      </mesh>
      {/* Semitendinosus */}
      <mesh castShadow material={m.muscle} position={[-0.18, 0.76, -0.28]} scale={[0.22, 0.66, 0.20]}>
        <sphereGeometry args={[1, 12, 12]} />
      </mesh>

      {/* ─── Knee joint — smaller than hip ─── */}
      <mesh castShadow receiveShadow material={m.jnt} position={[ 0.36, 0.02, 0]} scale={[0.72, 0.66, 0.84]}>
        <sphereGeometry args={[0.44, 24, 24]} />
      </mesh>
      <mesh castShadow receiveShadow material={m.jnt} position={[-0.36, 0.02, 0]} scale={[0.72, 0.66, 0.84]}>
        <sphereGeometry args={[0.44, 24, 24]} />
      </mesh>
      {/* Patella */}
      <mesh castShadow material={m.bone} position={[0, 0.22, 0.50]} scale={[1.10, 1.20, 0.68]}>
        <sphereGeometry args={[0.20, 18, 18]} />
      </mesh>

      {/* ─── Lower leg (pivots at knee — hamstring curl) ─── */}
      <group ref={shinRef}>
        {/* Tibia */}
        <mesh castShadow receiveShadow material={m.muscle} position={[0, -1.62, 0.04]} scale={[1, 1, 0.86]}>
          <cylinderGeometry args={[0.38, 0.24, 3.24, 30]} />
        </mesh>
        {/* Fibula */}
        <mesh castShadow material={m.bone} position={[0.36, -1.76, 0]} scale={[0.36, 1, 0.34]}>
          <cylinderGeometry args={[0.12, 0.09, 2.94, 14]} />
        </mesh>
        {/* Tibial tuberosity */}
        <mesh castShadow material={m.bone} position={[0, -0.22, 0.44]} scale={[0.48, 0.54, 0.42]}>
          <sphereGeometry args={[0.20, 14, 14]} />
        </mesh>
        {/* Gastrocnemius — large calf */}
        <mesh castShadow material={m.muscle} position={[0, -1.26, -0.36]} scale={[0.38, 0.86, 0.32]}>
          <sphereGeometry args={[1, 18, 18]} />
        </mesh>
        {/* Soleus — below gastrocnemius */}
        <mesh castShadow material={m.muscle} position={[0, -1.90, -0.26]} scale={[0.30, 0.58, 0.24]}>
          <sphereGeometry args={[1, 12, 12]} />
        </mesh>
        {/* Ankle malleoli */}
        <mesh castShadow receiveShadow material={m.bone} position={[ 0.30, -3.14, 0]} scale={[0.52, 0.44, 0.64]}>
          <sphereGeometry args={[0.28, 16, 16]} />
        </mesh>
        <mesh castShadow receiveShadow material={m.bone} position={[-0.30, -3.14, 0]} scale={[0.52, 0.44, 0.64]}>
          <sphereGeometry args={[0.28, 16, 16]} />
        </mesh>
        {/* Heel stub */}
        <mesh castShadow material={m.muscle} position={[0, -3.32, -0.26]} scale={[0.84, 0.46, 0.68]}>
          <sphereGeometry args={[0.24, 14, 14]} />
        </mesh>
      </group>
    </group>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

// Each model gets a different camera position and OrbitControls target
// so it is well-framed from a distinctive angle.
const CAM_CONFIG: Record<RehabType, {
  pos:    [number, number, number];
  target: [number, number, number];
  fov:    number;
}> = {
  // Slightly right of centre so the patella depth is readable
  knee:  { pos: [1.6, 0.3, 6.8],  target: [0,  0.0, 0], fov: 38 },
  // From the side — camera to the right so the olecranon silhouette is clear
  elbow: { pos: [5.2, 0.4, 4.2],  target: [0,  0.0, 0], fov: 40 },
  // Pulled back + slightly elevated to frame hip-to-ankle
  leg:   { pos: [2.4, 1.6, 10.5], target: [0,  0.6, 0], fov: 42 },
};

function Scene({ type, angleDeg }: { type: RehabType; angleDeg: number }) {
  const cfg = CAM_CONFIG[type];
  return (
    <>
      <Lights />
      <ShadowGround />

      {type === 'knee'  && <KneeModel  angleDeg={angleDeg} />}
      {type === 'elbow' && <ElbowModel angleDeg={angleDeg} />}
      {type === 'leg'   && <LegModel   angleDeg={angleDeg} />}

      <OrbitControls
        target={cfg.target}
        enablePan={false}
        enableZoom={false}
        rotateSpeed={0.45}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI * 0.74}
        minAzimuthAngle={-Math.PI / 2.2}
        maxAzimuthAngle={ Math.PI / 2.2}
      />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface IMUBodyView3DProps {
  rehabType: RehabType;
  jointAngle: number;
  rangeOfMotion: number;
  isStreaming: boolean;
  children?: React.ReactNode;
}

export function IMUBodyView3D({
  rehabType, jointAngle, rangeOfMotion, isStreaming, children,
}: IMUBodyView3DProps) {
  const { accent } = PALETTE[rehabType];
  const cfg        = CAM_CONFIG[rehabType];

  const LABELS: Record<RehabType, string> = {
    knee:  'Knee Joint',
    elbow: 'Elbow Joint',
    leg:   'Hip / Hamstring',
  };

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden w-full h-full" style={{ minHeight: '280px' }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: cfg.pos, fov: cfg.fov, near: 0.1, far: 60 }}
        style={{ background: '#0f172a' }}
      >
        <color attach="background" args={['#0f172a']} />
        <Suspense fallback={null}>
          <Scene type={rehabType} angleDeg={jointAngle} />
        </Suspense>
      </Canvas>

      {/* LIVE badge */}
      {isStreaming && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full text-xs font-bold text-white shadow z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      )}

      {/* Rotate hint */}
      <div className="absolute top-3 right-3 px-2 py-1 bg-black/30 backdrop-blur rounded-lg text-[10px] font-medium text-slate-400 z-10 select-none">
        Drag to rotate
      </div>

      {/* Joint label */}
      <div className="absolute bottom-14 left-3 z-10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {LABELS[rehabType]}
        </p>
      </div>

      {/* Angle + ROM badges */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between z-10">
        <div className="flex items-end gap-2">
          <div className="bg-slate-800/90 backdrop-blur rounded-xl px-3 py-2 text-center border border-slate-700">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Angle</p>
            <p className="text-2xl font-extrabold tabular-nums leading-none mt-0.5" style={{ color: accent }}>
              {Math.round(Math.abs(jointAngle))}<span className="text-xs font-bold text-slate-400">°</span>
            </p>
          </div>
          <div className="bg-slate-800/90 backdrop-blur rounded-xl px-3 py-2 text-center border border-slate-700">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ROM</p>
            <p className="text-lg font-extrabold tabular-nums leading-none mt-0.5 text-white">
              {rangeOfMotion.toFixed(1)}<span className="text-xs font-bold text-slate-400">°</span>
            </p>
          </div>
        </div>
        {!isStreaming && (
          <div className="bg-slate-800/80 backdrop-blur rounded-xl px-3 py-2 border border-slate-700">
            <p className="text-[10px] text-slate-500 font-medium">Connect IMU to animate</p>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
