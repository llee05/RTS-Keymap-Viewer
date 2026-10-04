import { keyboardProfiles, type KeyboardProfile } from './keyboardProfiles';

type DeviceIdentity = { vendorId: number; productId: number; productName: string };
type BrowserHID = {
  requestDevice: (options: { filters: { usagePage: number; usage: number }[] }) => Promise<DeviceIdentity[]>;
};
type DeviceResult =
  | { kind: 'matched'; profile: KeyboardProfile }
  | { kind: 'unknown'; name: string; identity: string }
  | { kind: 'cancelled' };

export function canIdentifyKeyboard(): boolean {
  return window.isSecureContext && Boolean((navigator as Navigator & { hid?: BrowserHID }).hid?.requestDevice);
}

export async function identifyKeyboard(): Promise<DeviceResult> {
  const hid = (navigator as Navigator & { hid?: BrowserHID }).hid;
  if (!window.isSecureContext || !hid?.requestDevice) {
    throw new Error('Keyboard identification needs desktop Chrome/Edge over HTTPS or localhost. Choose a supported model or a generic shape instead.');
  }
  let devices: DeviceIdentity[];
  try {
    // QMK's vendor Raw HID interface is accessible; standard keyboard reports
    // are browser-protected. Choosing a device only reads its identity.
    devices = await hid.requestDevice({ filters: [{ usagePage: 0xff60, usage: 0x61 }] });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return { kind: 'cancelled' };
    throw new Error('The browser could not share this device. Choose a supported model or a generic shape instead.', { cause: error });
  }
  const device = devices[0];
  if (!device) return { kind: 'cancelled' };
  const profile = keyboardProfiles.find(({ vendorId, productId }) =>
    vendorId === device.vendorId && productId === device.productId,
  );
  if (profile) return { kind: 'matched', profile };
  const hex = (value: number) => value.toString(16).padStart(4, '0').toUpperCase();
  return {
    kind: 'unknown', name: device.productName || 'Selected device',
    identity: `${hex(device.vendorId)}:${hex(device.productId)}`,
  };
}
