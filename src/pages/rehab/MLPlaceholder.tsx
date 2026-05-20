import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Cpu, Camera, Bluetooth,
  Layers, Zap, AlertCircle, Play, Square,
  CheckCircle2, XCircle, Loader2, BluetoothSearching, Plug,
  Activity, Wifi, WifiOff, GitMerge,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { RehabType } from '../../types';
import { REHAB_MODULES, ML_PIPELINES } from '../../constants';
import { useKneePipeline } from '../../hooks/useKneePipeline';
import { useIMUPipeline } from '../../hooks/useIMUPipeline';
import { IMUBodyView3D } from '../../components/IMUBodyView3D';
import {
  rehabApi,
  type CombinedPrediction,
  type ElbowCombinedPrediction,
  type LegCombinedPrediction,
} from '../../lib/rehabApi';

type AnyFusedPrediction = CombinedPrediction | ElbowCombinedPrediction | LegCombinedPrediction;

function isValidRehabType(t: string | undefined): t is RehabType {
  return t === 'knee' || t === 'leg' || t === 'elbow';
}

const RING_STYLES: Record<RehabType, { btn: string; spin: string; overlay: string; bar: string }> = {
  knee:  { btn: 'bg-emerald-500 hover:bg-emerald-600', spin: 'text-emerald-400', overlay: 'text-emerald-400', bar: 'bg-emerald-500' },
  leg:   { btn: 'bg-indigo-500  hover:bg-indigo-600',  spin: 'text-indigo-400',  overlay: 'text-indigo-400',  bar: 'bg-indigo-500'  },
  elbow: { btn: 'bg-orange-500  hover:bg-orange-600',  spin: 'text-orange-400',  overlay: 'text-orange-400',  bar: 'bg-orange-500'  },
};


// ── Live Camera Panel ─────────────────────────────────────────────────────────
type CameraHookData = ReturnType<typeof useKneePipeline>;
function LiveCameraPanel({ rehabType, cam }: { rehabType: RehabType; cam: CameraHookData }) {
  const { t } = useTranslation();
  const {
    videoRef, canvasRef,
    status, prediction, error, isServerOnline,
    startCamera, stopCamera,
    repCount, formScore, kneeAngle,
  } = cam;

  const ring       = RING_STYLES[rehabType];
  const jointLabel = rehabType === 'elbow' ? t('ml.camera.metrics.elbowAngle') : t('ml.camera.metrics.kneeAngle');
  const isRunning  = status === 'running';
  const isInit     = status === 'initializing';
  const moduleLabel = t(`rehab.${rehabType}`);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <Camera size={18} className="text-slate-400" />
        <div>
          <h3 className="font-bold text-slate-900">{t('ml.camera.title', { module: moduleLabel })}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{t('ml.camera.subtitle', { module: moduleLabel, type: rehabType })}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase',
            isServerOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500',
          )}>
            {isServerOnline ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            API {isServerOnline ? t('session.serverOnline') : t('session.serverOffline')}
          </div>
          <button
            onClick={isRunning ? stopCamera : startCamera}
            disabled={isInit}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all text-white',
              isRunning ? 'bg-red-500 hover:bg-red-600' : ring.btn,
              isInit && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isInit
              ? <><Loader2 size={12} className="animate-spin" /> {t('common.loading')}</>
              : isRunning
              ? <><Square size={12} fill="white" /> {t('ml.camera.stopCamera')}</>
              : <><Play  size={12} fill="white" /> {t('ml.camera.startCamera')}</>
            }
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video">
          {!isRunning && !isInit && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <Camera size={40} className="text-slate-700" />
              <p className="text-sm font-bold text-slate-500">{t('ml.camera.inactiveTitle')}</p>
              <p className="text-xs text-slate-600 text-center max-w-xs">{t('ml.camera.inactiveDesc')}</p>
            </div>
          )}
          {isInit && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <Loader2 size={32} className={cn('animate-spin', ring.spin)} />
              <p className="text-sm font-bold text-slate-300">{t('ml.camera.loadingTitle')}</p>
              <p className="text-xs text-slate-500">{t('ml.camera.loadingSubtitle')}</p>
            </div>
          )}
          <video ref={videoRef as React.RefObject<HTMLVideoElement>} className="absolute inset-0 w-full h-full object-contain" playsInline muted />
          <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          {isRunning && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500 rounded-full text-xs font-bold text-white shadow">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {t('ml.camera.liveBadge')}
            </div>
          )}
          {prediction?.skeleton && (
            <div className="absolute bottom-3 left-3 right-3 flex gap-2 flex-wrap">
              <div className="px-3 py-1.5 bg-black/70 backdrop-blur rounded-xl text-xs text-white font-mono">
                Exercise: <span className={cn('font-bold', ring.overlay)}>{prediction.skeleton.exercise_type}</span>
                <span className="ml-2 text-slate-400">({Math.round(prediction.skeleton.exercise_confidence * 100)}%)</span>
              </div>
              <div className={cn(
                'px-3 py-1.5 bg-black/70 backdrop-blur rounded-xl text-xs font-bold',
                prediction.skeleton.correctness === 'correct' ? 'text-green-400' : 'text-red-400',
              )}>
                {prediction.skeleton.correctness === 'correct'
                  ? `✓ ${t('ml.camera.correctForm')}`
                  : `✗ ${t('ml.camera.checkForm')}`}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: t('ml.camera.metrics.repCount'),    value: isRunning ? String(repCount)                        : '--', unit: t('exercises.reps').toLowerCase() },
            { label: jointLabel,                          value: isRunning && kneeAngle !== null ? String(kneeAngle) : '--', unit: '°' },
            { label: t('ml.camera.metrics.formScore'),   value: isRunning && formScore !== null ? String(formScore)  : '--', unit: '%' },
            { label: t('ml.camera.metrics.correctness'), value: prediction?.skeleton?.correctness ?? '--',                  unit: '' },
          ].map((m) => (
            <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-1">{m.label}</p>
              <p className={cn('text-lg font-extrabold', m.value === '--' ? 'text-slate-300' : 'text-slate-900')}>{m.value}</p>
              {m.unit && <p className="text-[10px] text-slate-400">{m.unit}</p>}
            </div>
          ))}
        </div>

        {prediction?.skeleton?.warnings?.length ? (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            {prediction.skeleton.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 flex items-center gap-2">
                <AlertCircle size={12} className="flex-shrink-0" />{w}
              </p>
            ))}
          </div>
        ) : null}

        {prediction?.skeleton?.exercise_proba && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('ml.camera.classification')}</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(prediction.skeleton.exercise_proba)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([label, prob]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                        <span className="font-mono">{label}</span>
                        <span>{Math.round((prob as number) * 100)}%</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-300', ring.bar)}
                          style={{ width: `${(prob as number) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Fused Prediction Panel ────────────────────────────────────────────────────
function FusedPanel({ rehabType, fused }: { rehabType: RehabType; fused: AnyFusedPrediction | null }) {
  const ring = RING_STYLES[rehabType];
  if (!fused) return null;
  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-bold',
      'bg-white border-slate-200 shadow-sm',
    )}>
      <GitMerge size={16} className="text-slate-400 flex-shrink-0" />
      <span className="text-slate-500 text-xs font-medium">Fused exercise type:</span>
      <span className="font-extrabold text-slate-900">{fused.fused_exercise_type ?? '--'}</span>
      {fused.fused_confidence != null && (
        <span className={cn('ml-auto text-xs px-2 py-0.5 rounded-full', ring.btn, 'text-white')}>
          {Math.round(fused.fused_confidence * 100)}%
        </span>
      )}
    </div>
  );
}

// ── Live IMU Panel ────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) {
    return (
      <div className="flex gap-0.5 h-6 items-center">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-0.5 bg-slate-700 rounded-full"
            style={{ height: `${8 + Math.sin(i * 0.8) * 4}px`, opacity: 0.4 }} />
        ))}
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <div className="flex gap-0.5 h-6 items-end">
      {values.map((v, i) => {
        const norm = (v - min) / range;
        return <div key={i} className="w-0.5 rounded-full" style={{ height: `${4 + norm * 20}px`, background: color }} />;
      })}
    </div>
  );
}

type IMUHookData = ReturnType<typeof useIMUPipeline>;
function LiveIMUPanel({ rehabType, imu }: { rehabType: RehabType; imu: IMUHookData }) {
  const { t } = useTranslation();
  const {
    status, device, error, bluetoothSupported, isServerOnline,
    repCount, jointAngle, rangeOfMotion, smoothness,
    accelSparkline, gyroSparkline,
    prediction, formScore,
    connect, disconnect,
  } = imu;

  const ring         = RING_STYLES[rehabType];
  const moduleLabel  = t(`rehab.${rehabType}`);
  const isStreaming  = status === 'streaming';
  const isConnecting = status === 'connecting' || status === 'pairing';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <Bluetooth size={18} className="text-slate-400" />
        <div>
          <h3 className="font-bold text-slate-900">{t('ml.imu.title', { module: moduleLabel })}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{t('ml.imu.instruction')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Server status */}
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase',
            isServerOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500',
          )}>
            {isServerOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
            API {isServerOnline ? t('session.serverOnline') : t('session.serverOffline')}
          </div>

          {!isStreaming ? (
            <>
              <button onClick={() => void connect('demo')} disabled={isConnecting}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  'bg-slate-900 hover:bg-slate-800 text-white',
                  isConnecting && 'opacity-50 cursor-not-allowed')}>
                <Plug size={12} /> {t('ml.imu.demo')}
              </button>
              <button onClick={() => void connect('ble')} disabled={isConnecting || !bluetoothSupported}
                title={!bluetoothSupported ? 'WebBluetooth requires Chrome/Edge' : undefined}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                  bluetoothSupported ? cn(ring.btn, 'text-white') : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                  isConnecting && 'opacity-50 cursor-not-allowed')}>
                {isConnecting
                  ? <><Loader2 size={12} className="animate-spin" /> {t('common.loading')}</>
                  : <><BluetoothSearching size={12} /> {t('ml.imu.ble')}</>}
              </button>
            </>
          ) : (
            <button onClick={() => void disconnect()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white">
              <Square size={12} fill="white" /> {t('ml.imu.disconnect')}
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* 3D body visualisation */}
        <div style={{ height: '340px' }}>
          <IMUBodyView3D
            rehabType={rehabType}
            jointAngle={jointAngle}
            rangeOfMotion={rangeOfMotion}
            isStreaming={isStreaming}
          />
        </div>

        {/* Device status + sparklines */}
        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('w-1.5 h-1.5 rounded-full',
              isStreaming  ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]' :
              isConnecting ? 'bg-amber-400 animate-pulse' :
              status === 'error' ? 'bg-red-500' : 'bg-slate-600')} />
            <p className="text-xs font-bold text-white">{device?.name ?? t('ml.imu.noDevice')}</p>
            <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {device?.transport ?? 'idle'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-0.5">
                <span>{t('ml.imu.accel')}</span>
                <span>{isStreaming && accelSparkline.length
                  ? `${accelSparkline[accelSparkline.length - 1].toFixed(2)} g` : '-- g'}</span>
              </div>
              <Sparkline values={accelSparkline} color="rgba(74, 222, 128, 0.9)" />
            </div>
            <div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-0.5">
                <span>{t('ml.imu.gyro')}</span>
                <span>{isStreaming && gyroSparkline.length
                  ? `${gyroSparkline[gyroSparkline.length - 1].toFixed(0)} °/s` : '-- °/s'}</span>
              </div>
              <Sparkline values={gyroSparkline} color="rgba(250, 204, 21, 0.9)" />
            </div>
          </div>
        </div>

        {/* Live metrics */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: t('ml.imu.metrics.repCount'),   value: isStreaming ? String(repCount)        : '--', unit: t('exercises.reps').toLowerCase() },
            { label: t('ml.imu.metrics.jointAngle'), value: isStreaming ? `${jointAngle}`         : '--', unit: '°' },
            { label: t('ml.imu.metrics.rom'),        value: isStreaming ? `${rangeOfMotion}`      : '--', unit: '°' },
            { label: t('ml.imu.metrics.smoothness'), value: isStreaming ? `${smoothness}`         : '--', unit: '%' },
          ].map((m) => (
            <div key={m.label} className="p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
              <p className="text-xs text-slate-400 font-medium mb-1">{m.label}</p>
              <p className={cn('text-lg font-extrabold', m.value === '--' ? 'text-slate-300' : 'text-slate-900')}>{m.value}</p>
              {m.unit && <p className="text-[10px] text-slate-400">{m.unit}</p>}
            </div>
          ))}
        </div>

        {/* ML quality result */}
        {isStreaming && prediction && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold',
              prediction.quality_label === 'correct'    ? 'bg-emerald-100 text-emerald-700' :
              prediction.quality_label === 'acceptable' ? 'bg-blue-100 text-blue-700'      :
              'bg-amber-100 text-amber-700')}>
              <Activity size={11} />
              {prediction.quality_label === 'correct'      ? 'Good form'
                : prediction.quality_label === 'acceptable' ? 'Acceptable'
                : prediction.quality_label === 'shaky'      ? 'Too jerky — slow down'
                : prediction.quality_label === 'too_fast'   ? 'Too fast'
                : prediction.quality_label === 'low_amplitude' ? 'Low amplitude'
                : prediction.quality_label}
            </div>
            {formScore !== null && (
              <span className="text-xs font-bold text-slate-600">
                Form score: <span className="text-slate-900">{formScore}%</span>
              </span>
            )}
          </div>
        )}

        {/* Warnings from ML */}
        {isStreaming && prediction?.warnings?.length ? (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            {prediction.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 flex items-center gap-2">
                <AlertCircle size={12} className="flex-shrink-0" />{w}
              </p>
            ))}
          </div>
        ) : null}

        {!isStreaming && !error && (
          <p className="mt-3 text-xs text-slate-400 text-center">
            Connect a sensor above to stream live IMU data with real-time quality analysis.
          </p>
        )}
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────
export function MLPlaceholder() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!isValidRehabType(type)) {
    navigate('/onboarding');
    return null;
  }

  return <MLContent rehabType={type} />;
}

function MLContent({ rehabType }: { rehabType: RehabType }) {
  const { t } = useTranslation();

  // Both hooks live here so we can coordinate the combined endpoint
  const cam = useKneePipeline({ rehabType });
  const imu = useIMUPipeline({ rehabType });

  const [fusedPrediction, setFusedPrediction] = useState<AnyFusedPrediction | null>(null);
  const fusedTimerRef = useRef<number | null>(null);

  const bothActive = cam.status === 'running' && imu.status === 'streaming';

  // Every time a new IMU prediction arrives (once per 1-s window) and camera
  // is also running, call predictCombined to get the fused exercise type.
  const callCombined = useCallback(async () => {
    const win = imu.getLastWindow();
    if (!win) return;
    try {
      const result = await rehabApi[rehabType].predictCombined({ imu_window: win, imu_fs: 50 });
      setFusedPrediction(result);
    } catch {
      // Combined endpoint errors are non-fatal; individual panels still work.
    }
  }, [rehabType, imu]);

  // Fire combined call whenever both are active and an IMU prediction lands
  useEffect(() => {
    if (!bothActive) { setFusedPrediction(null); return; }
    if (fusedTimerRef.current) window.clearInterval(fusedTimerRef.current);
    fusedTimerRef.current = window.setInterval(() => { void callCombined(); }, 1200);
    return () => {
      if (fusedTimerRef.current) window.clearInterval(fusedTimerRef.current);
    };
  }, [bothActive, callCombined]);

  const mod        = REHAB_MODULES[rehabType];
  const { colors } = mod;
  const pipelines  = ML_PIPELINES[rehabType];
  const moduleLabel = t(`rehab.${rehabType}`);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className={cn('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-2', colors.badge)}>
          <Cpu size={12} />
          {t('ml.badge')}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('ml.title', { module: moduleLabel })}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('ml.description', { module: moduleLabel })}</p>
      </motion.div>

      {/* System status banner */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
        className={cn('flex items-start gap-4 p-5 rounded-2xl border',
          rehabType === 'knee'  && 'bg-emerald-950 border-emerald-800',
          rehabType === 'leg'   && 'bg-indigo-950  border-indigo-800',
          rehabType === 'elbow' && 'bg-orange-950  border-orange-800',
        )}>
        <div className={cn('p-3 rounded-xl flex-shrink-0',
          rehabType === 'knee'  && 'bg-emerald-900',
          rehabType === 'leg'   && 'bg-indigo-900',
          rehabType === 'elbow' && 'bg-orange-900',
        )}>
          <Zap size={20} className={cn(
            rehabType === 'knee'  && 'text-emerald-400',
            rehabType === 'leg'   && 'text-indigo-400',
            rehabType === 'elbow' && 'text-orange-400',
          )} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white mb-1">{t('ml.banner.title', { module: moduleLabel })}</p>
          <p className="text-sm leading-relaxed" style={{
            color: rehabType === 'knee'  ? '#6ee7b7'
                 : rehabType === 'leg'   ? '#a5b4fc'
                 : '#fdba74',
          }}>
            {t('ml.banner.description', { module: moduleLabel })}
          </p>
        </div>
        <div className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest',
          rehabType === 'knee'  && 'bg-emerald-800 text-emerald-300',
          rehabType === 'leg'   && 'bg-indigo-800  text-indigo-300',
          rehabType === 'elbow' && 'bg-orange-800  text-orange-300',
        )}>
          {t('ml.banner.badge')}
        </div>
      </motion.div>

      {/* Live Camera Panel */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <LiveCameraPanel rehabType={rehabType} cam={cam} />
      </motion.div>

      {/* Fused prediction — appears only when both camera and IMU are streaming */}
      {bothActive && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <FusedPanel rehabType={rehabType} fused={fusedPrediction} />
        </motion.div>
      )}

      {/* ML Pipelines list */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <Layers size={18} className="text-slate-400" />
          <div>
            <h3 className="font-bold text-slate-900">ML Pipelines — {moduleLabel}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('ml.banner.description', { module: moduleLabel })}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {pipelines.map((pipeline, i) => (
            <motion.div key={pipeline.pipelineId}
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              className="px-6 py-5 flex items-start gap-4 hover:bg-slate-50 transition-colors">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colors.light)}>
                <Cpu size={18} className={colors.text} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn('w-2 h-2 rounded-full',
                    pipeline.status === 'active'
                      ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]'
                      : 'bg-slate-300',
                  )} />
                  <p className="font-semibold text-slate-900 text-sm">{pipeline.name}</p>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest',
                    pipeline.status === 'active'
                      ? cn(colors.light, colors.text)
                      : 'bg-slate-100 text-slate-400',
                  )}>
                    {pipeline.status === 'active' ? 'Active' : 'Not connected'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{pipeline.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Live IMU Panel */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <LiveIMUPanel rehabType={rehabType} imu={imu} />
      </motion.div>
    </div>
  );
}
