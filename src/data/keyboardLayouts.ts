import type { KeyboardPreset, Keybind } from './presets';

export type KeyboardSettings = NonNullable<KeyboardPreset['keyboard']>;
export type KeyboardShape = KeyboardSettings['shape'];
export type LabelLayout = KeyboardSettings['labels'];
export type KeyPosition = { rowIndex: number; keyIndex: number };
export type DisplayKey = KeyPosition & { id: string; key: Keybind };
type TemplateKey = { code?: string; units: number; height?: number };

export const keyboardShapes: { value: KeyboardShape; label: string }[] = [
  { value: 'original', label: 'All saved keys (original board)' },
  { value: 'compact', label: '60% compact · ANSI' },
  { value: 'tkl', label: 'Tenkeyless · ANSI' },
  { value: 'full', label: 'Full-size · ANSI' },
];

export const labelLayouts: { value: LabelLayout; label: string }[] = [
  { value: 'original', label: 'Original preset labels' },
  { value: 'qwerty', label: 'US QWERTY' },
  { value: 'azerty', label: 'French AZERTY' },
  { value: 'qwertz', label: 'German QWERTZ' },
];

const usLabels: Record<string, string> = {
  ...Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => [`Key${letter}`, letter])),
  ...Object.fromEntries('0123456789'.split('').map((digit) => [`Digit${digit}`, digit])),
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  Escape: 'Esc', Tab: 'Tab', CapsLock: 'Caps Lock', Enter: 'Enter',
  Backspace: 'Backspace', Space: 'Space', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', AltLeft: 'Alt', AltRight: 'Alt',
  MetaLeft: 'Super', MetaRight: 'Super', ContextMenu: 'Menu',
  ArrowUp: '↑', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→',
  PrintScreen: 'PrtSc', ScrollLock: 'Scroll Lock', Pause: 'Pause',
  Insert: 'Insert', Home: 'Home', PageUp: 'Page Up', Delete: 'Delete', End: 'End', PageDown: 'Page Down',
  NumLock: 'Num Lock', NumpadDivide: 'Num /', NumpadMultiply: 'Num *',
  NumpadSubtract: 'Num -', NumpadAdd: 'Num +', NumpadEnter: 'Num Enter', NumpadDecimal: 'Num .',
  ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`F${index + 1}`, `F${index + 1}`])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`Numpad${index}`, `Num ${index}`])),
};

const localizedLabels: Record<Exclude<LabelLayout, 'original' | 'detected'>, Record<string, string>> = {
  qwerty: usLabels,
  azerty: {
    ...usLabels, KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', KeyM: ',',
    Digit1: '&', Digit2: 'é', Digit3: '"', Digit4: "'", Digit5: '(', Digit6: '-',
    Digit7: 'è', Digit8: '_', Digit9: 'ç', Digit0: 'à', Minus: ')', Equal: '=',
    Backquote: '²', BracketLeft: '^', BracketRight: '$', Backslash: '*',
    Semicolon: 'M', Quote: 'ù', Comma: ';', Period: ':', Slash: '!',
  },
  qwertz: {
    ...usLabels, KeyY: 'Z', KeyZ: 'Y', Minus: 'ß', Equal: '´', Backquote: '^',
    BracketLeft: 'Ü', BracketRight: '+', Backslash: '#', Semicolon: 'Ö', Quote: 'Ä', Slash: '-',
  },
};

const codeByLabel = new Map(Object.entries(usLabels).map(([code, label]) => [label.toUpperCase(), code]));
for (const direction of ['Up', 'Left', 'Down', 'Right']) {
  codeByLabel.set(direction.toUpperCase(), `Arrow${direction}`);
}
const modifierCodes: Record<string, string> = { CTRL: 'Control', SHIFT: 'Shift', ALT: 'Alt', SUPER: 'Meta' };

// Old presets have labels only. Enrich them without moving rows or combination targets.
export function withKeyCodes(preset: KeyboardPreset): KeyboardPreset {
  const occurrences = new Map<string, number>();
  return {
    ...preset,
    rows: preset.rows.map((row) => row.map((key) => {
      if (key.spacer) return key;
      const label = key.label.toUpperCase();
      const occurrence = occurrences.get(label) ?? 0;
      occurrences.set(label, occurrence + 1);
      const modifier = modifierCodes[label];
      const code = modifier
        ? occurrence < 2 ? `${modifier}${occurrence === 0 ? 'Left' : 'Right'}` : undefined
        : codeByLabel.get(label);
      return { ...key, code: key.code ?? code };
    })),
  };
}

const k = (code: string, units = 1, height?: number): TemplateKey => ({ code, units, height });
const gap = (units = 1): TemplateKey => ({ units });
const keys = (...codes: string[]) => codes.map((code) => k(code));
const mainRows: TemplateKey[][] = [
  [...keys('Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'), k('Backspace', 2)],
  [k('Tab', 1.5), ...keys('KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'), k('Backslash', 1.5)],
  [k('CapsLock', 1.75), ...keys('KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'), k('Enter', 2.25)],
  [k('ShiftLeft', 2.25), ...keys('KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'), k('ShiftRight', 2.75)],
  [k('ControlLeft', 1.25), k('MetaLeft', 1.25), k('AltLeft', 1.25), k('Space', 6.25), k('AltRight', 1.25), k('MetaRight', 1.25), k('ContextMenu', 1.25), k('ControlRight', 1.25)],
];
const functionRow = [k('Escape'), gap(), ...keys('F1', 'F2', 'F3', 'F4'), gap(0.5), ...keys('F5', 'F6', 'F7', 'F8'), gap(0.5), ...keys('F9', 'F10', 'F11', 'F12')];
const navigationRows = [
  keys('PrintScreen', 'ScrollLock', 'Pause'),
  keys('Insert', 'Home', 'PageUp'),
  keys('Delete', 'End', 'PageDown'),
  [gap(3)],
  [gap(), k('ArrowUp'), gap()],
  keys('ArrowLeft', 'ArrowDown', 'ArrowRight'),
];
const numpadRows = [
  [gap(4)],
  keys('NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'),
  [...keys('Numpad7', 'Numpad8', 'Numpad9'), k('NumpadAdd', 1, 2)],
  [...keys('Numpad4', 'Numpad5', 'Numpad6'), gap()],
  [...keys('Numpad1', 'Numpad2', 'Numpad3'), k('NumpadEnter', 1, 2)],
  [k('Numpad0', 2), k('NumpadDecimal'), gap()],
];

function getTemplate(shape: Exclude<KeyboardShape, 'original'>): TemplateKey[][] {
  if (shape === 'compact') {
    return [[k('Escape'), ...mainRows[0].slice(1)], ...mainRows.slice(1)];
  }
  return [functionRow, ...mainRows].map((row, index) => [
    ...row, gap(0.5), ...navigationRows[index],
    ...(shape === 'full' ? [gap(0.5), ...numpadRows[index]] : []),
  ]);
}

export function getKeyLabel(key: Keybind, settings?: KeyboardSettings): string {
  if (!key.code || !settings || settings.labels === 'original') return key.label;
  if (settings.labels === 'detected') {
    const detected = settings.detectedLabels?.[key.code];
    return detected ? /^[a-z]$/.test(detected) ? detected.toUpperCase() : detected : key.label;
  }
  return localizedLabels[settings.labels][key.code] ?? key.label;
}

export function getDisplayRows(preset: KeyboardPreset): DisplayKey[][] {
  const originalRows = preset.rows.map((row, rowIndex) => row.map((key, keyIndex) => ({
    id: `${rowIndex}-${keyIndex}`, rowIndex, keyIndex, key,
  })));
  const shape = preset.keyboard?.shape ?? 'original';
  if (shape === 'original') return originalRows;
  const byCode = new Map(originalRows.flat().filter(({ key }) => key.code).map((entry) => [entry.key.code, entry]));
  return getTemplate(shape).map((row, rowIndex) => row.map((slot, keyIndex) => {
    const entry = slot.code ? byCode.get(slot.code) : undefined;
    // Include gaps within wider keys so every template row aligns on the same grid.
    const width = (slot.units * 74 - 10) / 64;
    const height = slot.height ? (slot.height * 74 - 10) / 64 : shape !== 'compact' && rowIndex === 0 ? 0.65 : 1;
    return entry
      ? { ...entry, key: { ...entry.key, width, height } }
      : { id: `spacer-${rowIndex}-${keyIndex}`, rowIndex: -1, keyIndex: -1, key: { label: '', hotkeys: [], spacer: true, width } };
  }));
}

export function setKeyboardShape(preset: KeyboardPreset, shape: KeyboardShape): KeyboardPreset {
  const enriched = withKeyCodes(preset);
  const existingCodes = new Set(enriched.rows.flat().map((key) => key.code));
  const missingKeys: Keybind[] = [];
  if (shape !== 'original') {
    getTemplate(shape).flat().forEach(({ code }) => {
      if (code && !existingCodes.has(code)) {
        missingKeys.push({ code, label: usLabels[code] ?? code, hotkeys: [''] });
        existingCodes.add(code);
      }
    });
  }
  return {
    ...enriched,
    // Append additional keys; existing row-index combination references stay valid.
    rows: [
      ...enriched.rows,
      ...Array.from({ length: Math.ceil(missingKeys.length / 14) }, (_, index) => missingKeys.slice(index * 14, (index + 1) * 14)),
    ],
    keyboard: { labels: 'original', ...enriched.keyboard, shape },
  };
}

type LayoutMapKeyboard = { getLayoutMap: () => Promise<ReadonlyMap<string, string>> };

export async function detectKeyboardLabels(): Promise<Record<string, string>> {
  const keyboard = (navigator as Navigator & { keyboard?: LayoutMapKeyboard }).keyboard;
  if (!window.isSecureContext || !keyboard?.getLayoutMap) {
    throw new Error('Automatic detection is unavailable here. Choose a character layout manually, or use Chrome/Edge over HTTPS or localhost.');
  }
  let map: ReadonlyMap<string, string>;
  try {
    map = await keyboard.getLayoutMap();
  } catch {
    throw new Error('Could not detect keyboard labels. Choose a character layout manually.');
  }
  const labels = Object.fromEntries(map);
  if (!Object.values(labels).some((label) => label.trim())) {
    throw new Error('The browser returned no keyboard labels. Choose a character layout manually.');
  }
  return labels;
}
