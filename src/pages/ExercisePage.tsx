import React from 'react';
import { Card, StatCard } from '../components/Cards';
import {
  Camera,
  CameraOff,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  Minimize2,
  Mic,
  Cpu,
  Dumbbell,
  Loader2
} from 'lucide-react';
import { MOCK_EXERCISES } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { PlaceholderChart } from '../components/Charts';

export function ExercisePage() {
  const [isActive, setIsActive] = React.useState(false);
  const [cameraEnabled, setCameraEnabled] = React.useState(false);
  const [cameraLoading, setCameraLoading] = React.useState(false);
  const [cameraError, setCameraError] = React.useState('');

  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const cameraContainerRef = React.useRef<HTMLDivElement>(null);

  const exercise = MOCK_EXERCISES[1];

  /* ── Camera helpers ──────────────────────────────────────────────────── */

  const enableCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Your browser does not support camera access. Try Chrome or Edge.');
      return;
    }
    setCameraLoading(true);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraEnabled(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Click the camera icon in your browser address bar to allow access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera detected on this device.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(`Could not start camera: ${err.message}`);
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const disableCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraEnabled(false);
    setCameraError('');
  };

  const handleReset = () => {
    setIsActive(false);
    // Keep camera running between sets — user can stop it manually
  };

  const toggleFullscreen = async () => {
    const el = cameraContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  // Keep fullscreen icon in sync with actual state
  React.useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Stop camera stream when the component unmounts
  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-widest mb-2">
            <Dumbbell size={16} /> Rehabilitation Session
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{exercise.title}</h1>
          <p className="text-slate-500 font-medium">{exercise.description}</p>
        </div>
        <button
          onClick={() => (isActive ? handleReset() : setIsActive(true))}
          className={cn(
            'px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg',
            isActive
              ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
          )}
        >
          {isActive ? <RotateCcw size={20} /> : <Play size={20} />}
          {isActive ? 'Reset Session' : 'Start Training'}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Camera view */}
        <div className="lg:col-span-8 space-y-6">
          <div ref={cameraContainerRef} className="relative aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">

            {/* ── Actual video element — mirrored so movement direction matches expectation ── */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ transform: 'scaleX(-1)' }}
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                cameraEnabled ? 'opacity-100' : 'opacity-0'
              )}
            />

            {/* ── Placeholder — shown when camera is off ── */}
            <AnimatePresence>
              {!cameraEnabled && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 px-8"
                >
                  <Camera size={56} className="mb-4 opacity-10" />

                  {cameraError ? (
                    <div className="flex items-start gap-2 bg-red-900/40 border border-red-500/30 rounded-xl px-4 py-3 mb-5 max-w-sm">
                      <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-300 leading-relaxed">{cameraError}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center max-w-xs mb-6">
                      Enable your camera for live body tracking and real-time pose guidance.
                    </p>
                  )}

                  <button
                    onClick={enableCamera}
                    disabled={cameraLoading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-widest"
                  >
                    {cameraLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Enabling…
                      </>
                    ) : (
                      <>
                        <Camera size={14} />
                        Enable Camera
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Skeletal overlay — shown when camera is on AND session is active ── */}
            {cameraEnabled && isActive && (
              <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full opacity-70">
                  <line x1="50%" y1="20%" x2="50%" y2="50%" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                  <circle cx="50%" cy="20%" r="5" fill="#10b981" />
                  <circle cx="50%" cy="50%" r="5" fill="#10b981" />
                  <line x1="50%" y1="50%" x2="40%" y2="80%" stroke="#3b82f6" strokeWidth="4" />
                  <circle cx="40%" cy="80%" r="8" fill="#3b82f6" />
                </svg>
              </div>
            )}

            {/* ── Top status bar ── */}
            <div className="absolute top-6 left-6 flex items-center gap-3 z-10">
              <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  cameraEnabled ? 'bg-red-500 animate-pulse' : 'bg-slate-600'
                )} />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                  {cameraEnabled ? 'Live: Camera Feed' : 'Camera Off'}
                </span>
              </div>
              {isActive && cameraEnabled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl border border-blue-400 flex items-center gap-2"
                >
                  <Cpu size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Pose Detection Active</span>
                </motion.div>
              )}
            </div>

            {/* ── Bottom interaction bar ── */}
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-10">
              <div className="flex gap-2">
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  className="p-3 bg-white/10 rounded-xl text-white backdrop-blur-md hover:bg-white/20 transition-all"
                >
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <button className="p-3 bg-white/10 rounded-xl text-white backdrop-blur-md hover:bg-white/20 transition-all">
                  <Mic size={20} />
                </button>
                {/* Camera toggle */}
                <button
                  onClick={cameraEnabled ? disableCamera : enableCamera}
                  disabled={cameraLoading}
                  title={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
                  className={cn(
                    'p-3 rounded-xl text-white backdrop-blur-md transition-all disabled:opacity-50',
                    cameraEnabled
                      ? 'bg-red-500/80 hover:bg-red-500'
                      : 'bg-white/10 hover:bg-white/20'
                  )}
                >
                  {cameraLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : cameraEnabled
                      ? <CameraOff size={20} />
                      : <Camera size={20} />
                  }
                </button>
              </div>
              <div className="px-4 py-2 bg-green-500 rounded-xl text-white text-xs font-bold shadow-lg flex items-center gap-2">
                <CheckCircle2 size={16} />
                System Calibrated
              </div>
            </div>

          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Repetitions</p>
              <h4 className="text-2xl font-black text-slate-900">{isActive ? '3' : '0'}<span className="text-slate-300 text-sm font-bold ml-1">/ 10</span></h4>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Control</p>
              <h4 className="text-2xl font-black text-green-600">{isActive ? '92%' : '--'}</h4>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Range Shift</p>
              <h4 className="text-2xl font-black text-blue-600">{isActive ? '+12°' : '--'}</h4>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Elapsed</p>
              <h4 className="text-2xl font-black text-slate-900">{isActive ? '01:45' : '00:00'}</h4>
            </div>
          </div>
        </div>

        {/* Instructions & Notes */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Instructions" icon={<Info size={20} className="text-blue-600" />}>
            <ul className="space-y-4">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Safety Warnings" className="bg-red-50 border-red-100">
            <div className="flex gap-3 text-red-700">
              <AlertTriangle className="flex-shrink-0" size={20} />
              <p className="text-xs font-medium leading-relaxed">
                {exercise.safetyNotes} If you feel any sharp pain, stop immediately and contact your physician.
              </p>
            </div>
          </Card>

          <Card title="Session Analysis" subtitle="Real-time movement quality">
            <PlaceholderChart label="Movement Synchronization" />
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Stability</span>
                <span className="text-slate-900">High</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full">
                <div className="h-full w-[90%] bg-blue-500 rounded-full" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
