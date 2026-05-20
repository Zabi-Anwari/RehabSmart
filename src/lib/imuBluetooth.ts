/**
 * WebBluetooth client for a generic 6-axis IMU sensor.
 *
 * Designed for a Nordic-UART-style service (1 notify characteristic carrying
 * packed binary samples). Update the UUIDs and packet layout in
 * `IMU_BLE_PROFILE` to match the actual firmware once hardware is selected.
 *
 * Packet layout (little-endian, 14 bytes):
 *   uint32  timestamp_ms
 *   int16   ax  (mg)      → divide by 1000 to get g
 *   int16   ay  (mg)
 *   int16   az  (mg)
 *   int16   gx  (cdps)    → divide by 100 to get deg/s
 *   int16   gy  (cdps)
 *   int16   gz  (cdps)
 */

import type { IMUSample } from "../types";

// Minimal WebBluetooth DOM types — the full surface isn't in TS lib.dom yet.
interface BLEGattCharacteristic extends EventTarget {
  value?: DataView | null;
  startNotifications(): Promise<BLEGattCharacteristic>;
  stopNotifications(): Promise<BLEGattCharacteristic>;
}
interface BLEGattService {
  getCharacteristic(uuid: string): Promise<BLEGattCharacteristic>;
}
interface BLEGattServer {
  connect(): Promise<BLEGattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BLEGattService>;
}
interface BluetoothDevice extends EventTarget {
  name?: string;
  gatt?: BLEGattServer;
}

// Replace these with the actual UUIDs exposed by your IMU firmware.
export const IMU_BLE_PROFILE = {
  serviceUUID:        "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
  notifyCharUUID:     "6e400003-b5a3-f393-e0a9-e50e24dcca9e", // TX (notify)
  optionalServices:   ["battery_service"],
} as const;

export interface BLEIMUSession {
  device: BluetoothDevice;
  stop(): Promise<void>;
}

export class WebBluetoothUnsupportedError extends Error {
  constructor() {
    super("WebBluetooth is not supported in this browser. Use Chrome or Edge over HTTPS / localhost.");
    this.name = "WebBluetoothUnsupportedError";
  }
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth;
}

/**
 * Prompt the user to select an IMU device, subscribe to notifications, and
 * stream parsed IMUSample objects via `onSample`. Throws on user cancellation
 * or if WebBluetooth is unavailable.
 */
export async function connectIMUOverBLE(
  onSample: (s: IMUSample) => void,
  onDisconnect?: (reason: string) => void,
): Promise<BLEIMUSession> {
  if (!isWebBluetoothSupported()) throw new WebBluetoothUnsupportedError();

  // navigator.bluetooth is typed via experimental DOM types — narrow it here.
  const bluetooth = (navigator as Navigator & {
    bluetooth: {
      requestDevice(options: unknown): Promise<BluetoothDevice>;
    };
  }).bluetooth;

  const device = await bluetooth.requestDevice({
    filters: [{ services: [IMU_BLE_PROFILE.serviceUUID] }],
    optionalServices: IMU_BLE_PROFILE.optionalServices,
  });

  if (!device.gatt) throw new Error("Selected device exposes no GATT server.");

  const server          = await device.gatt.connect();
  const service         = await server.getPrimaryService(IMU_BLE_PROFILE.serviceUUID);
  const characteristic  = await service.getCharacteristic(IMU_BLE_PROFILE.notifyCharUUID);

  const handleValueChanged = (event: Event) => {
    const target = event.target as { value?: DataView | null } | null;
    const dv = target?.value;
    if (!dv) return;
    const sample = decodeIMUPacket(dv);
    if (sample) onSample(sample);
  };

  characteristic.addEventListener("characteristicvaluechanged", handleValueChanged);
  await characteristic.startNotifications();

  const handleDisconnect = () => onDisconnect?.("Device disconnected");
  device.addEventListener("gattserverdisconnected", handleDisconnect);

  return {
    device,
    async stop() {
      device.removeEventListener("gattserverdisconnected", handleDisconnect);
      characteristic.removeEventListener("characteristicvaluechanged", handleValueChanged);
      try { await characteristic.stopNotifications(); } catch { /* device already gone */ }
      try { device.gatt?.disconnect(); } catch { /* already disconnected */ }
    },
  };
}

function decodeIMUPacket(dv: DataView): IMUSample | null {
  if (dv.byteLength < 16) return null;
  const t  = dv.getUint32(0, true);
  const ax = dv.getInt16(4, true)  / 1000;
  const ay = dv.getInt16(6, true)  / 1000;
  const az = dv.getInt16(8, true)  / 1000;
  const gx = dv.getInt16(10, true) / 100;
  const gy = dv.getInt16(12, true) / 100;
  const gz = dv.getInt16(14, true) / 100;
  return { t, ax, ay, az, gx, gy, gz };
}
