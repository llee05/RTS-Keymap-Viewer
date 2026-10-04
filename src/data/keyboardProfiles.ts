export type ProfileKey = {
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export type KeyboardProfile = {
  id: string;
  name: string;
  shape: 'compact' | 'tkl' | 'full';
  vendorId: number;
  productId: number;
  keys: ProfileKey[];
};

const key = (code: string, x: number, y: number, width = 1, height = 1, label?: string): ProfileKey =>
  ({ code, x, y, width, height, label });

function row(codes: string[], y: number, x = 0, widths: Record<string, number> = {}): ProfileKey[] {
  return codes.map((code) => {
    const width = widths[code] ?? 1;
    const placed = key(code, x, y, width);
    x += width;
    return placed;
  });
}

function mainKeys(compact: boolean): ProfileKey[] {
  const offset = compact ? 0 : 1.25;
  return [
    ...row([compact ? 'Escape' : 'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'], offset, 0, { Backspace: 2 }),
    ...row(['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'], offset + 1, 0, { Tab: 1.5, Backslash: 1.5 }),
    ...row(['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'], offset + 2, 0, { CapsLock: 1.75, Enter: 2.25 }),
    ...row(['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'], offset + 3, 0, { ShiftLeft: 2.25, ShiftRight: 2.75 }),
    ...row(['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', compact ? 'Fn' : 'MetaRight', compact ? 'Fn2' : 'Fn', 'ControlRight'], offset + 4, 0, {
      ControlLeft: 1.25, MetaLeft: 1.25, AltLeft: 1.25, Space: 6.25,
      AltRight: 1.25, MetaRight: 1.25, Fn: 1.25, Fn2: 1.25, ControlRight: 1.25,
    }).map((placed) => compact && placed.code === 'Fn' ? { ...placed, label: 'Fn1' } : placed),
  ];
}

function tklKeys(): ProfileKey[] {
  return [
    key('Escape', 0, 0),
    ...Array.from({ length: 12 }, (_, index) => key(`F${index + 1}`, 2 + index + Math.floor(index / 4) * 0.5, 0)),
    key('PrintScreen', 15.25, 0),
    // These factory keys do not emit standard keyboard events. They remain clickable.
    key('KeychronAssistant', 16.25, 0, 1, 1, 'Assistant'),
    key('KeychronBacklight', 17.25, 0, 1, 1, 'Light'),
    ...mainKeys(false),
    ...row(['Insert', 'Home', 'PageUp'], 1.25, 15.25),
    ...row(['Delete', 'End', 'PageDown'], 2.25, 15.25),
    key('ArrowUp', 16.25, 4.25),
    ...row(['ArrowLeft', 'ArrowDown', 'ArrowRight'], 5.25, 15.25),
  ];
}

// Geometry and USB identities verified against QMK's Keychron ANSI definitions.
// Sources: https://github.com/qmk/qmk_firmware/tree/master/keyboards/keychron
// The identities exclude encoder, ISO, JIS, and Max variants. Codes use the
// factory Windows base layout; this catalog does not read firmware remappings.
export const keyboardProfiles: KeyboardProfile[] = [
  { id: 'keychron-v4-ansi', name: 'Keychron V4 · ANSI · 61 keys', shape: 'compact', vendorId: 0x3434, productId: 0x0340, keys: mainKeys(true) },
  { id: 'keychron-v3-ansi', name: 'Keychron V3 · ANSI · 87 keys', shape: 'tkl', vendorId: 0x3434, productId: 0x0330, keys: tklKeys() },
  {
    id: 'keychron-v6-ansi', name: 'Keychron V6 · ANSI · 108 keys', shape: 'full', vendorId: 0x3434, productId: 0x0360,
    keys: [
      ...tklKeys(),
      ...row(['F13', 'F14', 'F15', 'F16'], 0, 18.5),
      ...row(['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'], 1.25, 18.5),
      ...row(['Numpad7', 'Numpad8', 'Numpad9'], 2.25, 18.5),
      key('NumpadAdd', 21.5, 2.25, 1, 2),
      ...row(['Numpad4', 'Numpad5', 'Numpad6'], 3.25, 18.5),
      ...row(['Numpad1', 'Numpad2', 'Numpad3'], 4.25, 18.5),
      key('NumpadEnter', 21.5, 4.25, 1, 2),
      key('Numpad0', 18.5, 5.25, 2), key('NumpadDecimal', 20.5, 5.25),
    ],
  },
];

export function getKeyboardProfile(id?: string): KeyboardProfile | undefined {
  return keyboardProfiles.find((profile) => profile.id === id);
}

export function getProfileSize(profile: KeyboardProfile): { width: number; height: number } {
  return {
    width: Math.max(...profile.keys.map((placed) => placed.x + placed.width)) * 74 - 10,
    height: Math.max(...profile.keys.map((placed) => placed.y + placed.height)) * 74 - 10,
  };
}
