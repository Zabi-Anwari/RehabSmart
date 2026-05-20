/**
 * useIMU
 *
 * React hook that streams IMU samples from either a synthetic demo source or a
 * real WebBluetooth device and derives live rehab metrics (rep count, joint
 * angle, range of motion, smoothness) for display.
 *
 * Live-only — does not yet POST to /api/knee/imu/predict because the single
 * sensor produces 6 channels and the server expects a 45-channel multi-sensor
 * window. See TODO at the bottom for that integration.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IMUSample,
  IMUTransport,
  IMUConnectionStatus,
  IMULiveMetrics,
  IMUDeviceInfo,
} from "../types";
import { startDemoIMUSource, type IMUDemoController } from "../lib/imuDemoSource";
import {
  connectIMUOverBLE,
  isWebBluetoothSupported,
  type BLEIMUSession,
} from "../lib/imuBluetooth";

const SPARKLINE_LENGTH       = 40;
const REP_PEAK_THRESHOLD_DPS = 80;   // gyro magnitude that counts as motion onset
const REP_REFRACTORY_MS      = 600;  // ignore peaks within this window

const EMPTY_METRICS: IMULiveMetrics = {
  repCount: 0,
  jointAngle: 0,
  rangeOfMotion: 0,
  smoothness: 0,
  accelSparkline: [],
  gyroSparkline: [],
  sampleCount: 0,
};

export interface UseIMUReturn {
  status: IMUConnectionStatus;
  device: IMUDeviceInfo | null;
  metrics: IMULiveMetrics;
  error: string | null;
  bluetoothSupported: boolean;
  connect(transport: IMUTransport): Promise<void>;
  disconnect(): Promise<void>;
}

export function useIMU(): UseIMUReturn {
  const [status,  setStatus]  = useState<IMUConnectionStatus>("disconnected");
  const [device,  setDevice]  = useState<IMUDeviceInfo | null>(null);
  const [metrics, setMetrics] = useState<IMULiveMetrics>(EMPTY_METRICS);
  const [error,   setError]   = useState<string | null>(null);

  // Refs hold mutable session + integrator state so we don't re-render on every sample.
  const demoRef        = useRef<IMUDemoController | null>(null);
  const bleRef         = useRef<BLEIMUSession | null>(null);
  const jointAngleRef  = useRef(0);
  const minAngleRef    = useRef(Infinity);
  const maxAngleRef    = useRef(-Infinity);
  const lastTimeRef    = useRef<number | null>(null);
  const lastGyroMagRef = useRef(0);
  const lastRepTRef    = useRef(-Infinity);
  const jerkSumRef     = useRef(0);
  const jerkCountRef   = useRef(0);
  const repCountRef    = useRef(0);
  const sampleCountRef = useRef(0);
  const accelSparkRef  = useRef<number[]>([]);
  const gyroSparkRef   = useRef<number[]>([]);

  const resetIntegrator = useCallback(() => {
    jointAngleRef.current  = 0;
    minAngleRef.current    = Infinity;
    maxAngleRef.current    = -Infinity;
    lastTimeRef.current    = null;
    lastGyroMagRef.current = 0;
    lastRepTRef.current    = -Infinity;
    jerkSumRef.current     = 0;
    jerkCountRef.current   = 0;
    repCountRef.current    = 0;
    sampleCountRef.current = 0;
    accelSparkRef.current  = [];
    gyroSparkRef.current   = [];
    setMetrics(EMPTY_METRICS);
  }, []);

  const handleSample = useCallback((s: IMUSample) => {
    const accelMag = Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
    const gyroMag  = Math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz);

    // Integrate gyro X to get an approximate flexion angle (degrees).
    if (lastTimeRef.current !== null) {
      const dtSec = Math.max(0, (s.t - lastTimeRef.current) / 1000);
      jointAngleRef.current += s.gx * dtSec;
      const dGyro = gyroMag - lastGyroMagRef.current;
      jerkSumRef.current   += dGyro * dGyro;
      jerkCountRef.current += 1;
    }
    lastTimeRef.current    = s.t;
    lastGyroMagRef.current = gyroMag;

    if (jointAngleRef.current < minAngleRef.current) minAngleRef.current = jointAngleRef.current;
    if (jointAngleRef.current > maxAngleRef.current) maxAngleRef.current = jointAngleRef.current;

    // Simple peak-based rep counter on gyro magnitude.
    if (
      gyroMag > REP_PEAK_THRESHOLD_DPS &&
      s.t - lastRepTRef.current > REP_REFRACTORY_MS
    ) {
      repCountRef.current += 1;
      lastRepTRef.current = s.t;
    }

    sampleCountRef.current += 1;

    accelSparkRef.current.push(accelMag);
    if (accelSparkRef.current.length > SPARKLINE_LENGTH) accelSparkRef.current.shift();
    gyroSparkRef.current.push(gyroMag);
    if (gyroSparkRef.current.length > SPARKLINE_LENGTH)  gyroSparkRef.current.shift();

    // Push to React state at the sample rate; React batches automatically.
    const jerkRms = jerkCountRef.current > 0
      ? Math.sqrt(jerkSumRef.current / jerkCountRef.current)
      : 0;
    const smoothness = Math.max(0, Math.min(100, 100 - jerkRms * 0.4));
    const rom = maxAngleRef.current === -Infinity
      ? 0
      : Math.abs(maxAngleRef.current - minAngleRef.current);

    setMetrics({
      repCount:       repCountRef.current,
      jointAngle:     Math.round(jointAngleRef.current * 10) / 10,
      rangeOfMotion:  Math.round(rom * 10) / 10,
      smoothness:     Math.round(smoothness),
      accelSparkline: accelSparkRef.current.slice(),
      gyroSparkline:  gyroSparkRef.current.slice(),
      sampleCount:    sampleCountRef.current,
    });
  }, []);

  const cleanup = useCallback(async () => {
    demoRef.current?.stop();
    demoRef.current = null;
    if (bleRef.current) {
      try { await bleRef.current.stop(); } catch { /* swallow */ }
      bleRef.current = null;
    }
  }, []);

  const connect = useCallback(async (transport: IMUTransport) => {
    setError(null);
    await cleanup();
    resetIntegrator();
    setStatus(transport === "ble" ? "pairing" : "connecting");

    try {
      if (transport === "demo") {
        demoRef.current = startDemoIMUSource(handleSample);
        setDevice({
          name: "Demo Sensor",
          transport: "demo",
          connectedAt: new Date().toISOString(),
        });
      } else {
        const session = await connectIMUOverBLE(handleSample, (reason) => {
          setStatus("disconnected");
          setError(reason);
          setDevice(null);
          bleRef.current = null;
        });
        bleRef.current = session;
        setDevice({
          name: session.device.name ?? "IMU Sensor",
          transport: "ble",
          connectedAt: new Date().toISOString(),
        });
      }
      setStatus("streaming");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
      await cleanup();
    }
  }, [cleanup, handleSample, resetIntegrator]);

  const disconnect = useCallback(async () => {
    await cleanup();
    setDevice(null);
    setStatus("disconnected");
    resetIntegrator();
  }, [cleanup, resetIntegrator]);

  useEffect(() => {
    return () => { void cleanup(); };
  }, [cleanup]);

  return {
    status,
    device,
    metrics,
    error,
    bluetoothSupported: isWebBluetoothSupported(),
    connect,
    disconnect,
  };
}

// TODO: When a 7-8 sensor array is available, accumulate samples into a
// (50, 45) window and POST to rehabApi.knee.predictIMU. The current hook
// surfaces live UI metrics only.
