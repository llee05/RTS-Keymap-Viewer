import type { Keybind, KeyboardPreset } from './presets.ts';

export function getPresetValidationErrors(preset: KeyboardPreset): string[] {
  const keys = new Map<string, Keybind>(
    preset.rows.flatMap((row, rowIndex) =>
      row.map((key, keyIndex) => [`${rowIndex}-${keyIndex}`, key] as const),
    ),
  );
  const errors: string[] = [];

  for (const [keyId, key] of keys) {
    const targets = new Set<string>();
    const keyName = `${key.label || 'Blank key'} (${keyId})`;

    for (const combination of key.combinations ?? []) {
      const target = keys.get(combination.keyId);

      if (!target) {
        errors.push(`${keyName}: combination target ${combination.keyId} does not exist.`);
      } else if (target.spacer) {
        errors.push(`${keyName}: a combination cannot target a spacer.`);
      } else if (combination.keyId === keyId) {
        errors.push(`${keyName}: a combination cannot target itself.`);
      }

      if (targets.has(combination.keyId)) {
        errors.push(`${keyName}: combination target ${combination.keyId} is repeated.`);
      }

      targets.add(combination.keyId);
    }
  }

  return errors;
}

export function validatePreset(preset: KeyboardPreset): void {
  const errors = getPresetValidationErrors(preset);

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
