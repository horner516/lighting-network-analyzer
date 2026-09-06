export type DeviceType = 'Console' | 'Node' | 'Switch';
export type ManualDevice = { name: string; ip: string; source: 'manual'; state: 'Unverified'; deviceType: DeviceType };
export const savedDevicesKey = 'lux-link-manual-devices';

export function normalizeIp(value: string): string | null {
  const parts = value.trim().split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    ? parts.map(Number).join('.') : null;
}

export function manualDevice(name: string, ip: string, deviceType: DeviceType = 'Node'): ManualDevice {
  return { name: name.trim() || `Device ${ip}`, ip, source: 'manual', state: 'Unverified', deviceType };
}

export function restoreManualDevices(serialized: string): ManualDevice[] {
  try {
    const saved = JSON.parse(serialized);
    if (!Array.isArray(saved)) return [];
    const result: ManualDevice[] = [];
    for (const item of saved) {
      if (!item || (item.source !== 'manual' && item.model !== 'Manually added device') || typeof item.ip !== 'string') continue;
      const ip = normalizeIp(item.ip);
      if (!ip || result.some(device => device.ip === ip)) continue;
      const deviceType: DeviceType = item.deviceType === 'Console' || item.deviceType === 'Switch' ? item.deviceType : 'Node';
      result.push(manualDevice(typeof item.name === 'string' ? item.name : '', ip, deviceType));
    }
    return result;
  } catch { return []; }
}
