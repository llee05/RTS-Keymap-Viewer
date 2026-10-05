import type { Keybind, KeyboardPreset } from './presets.ts';
import { getCombinationTargets } from './keyboard.ts';

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
      const targetIds = getCombinationTargets(combination);
      const seen = new Set<string>();
      for (const targetId of targetIds) {
        const target = keys.get(targetId);
        if (!target) {
          errors.push(`${keyName}: combination target ${targetId} does not exist.`);
        } else if (target.spacer) {
          errors.push(`${keyName}: a combination cannot target a spacer.`);
        } else if (targetId === keyId) {
          errors.push(`${keyName}: a combination cannot target itself.`);
        }
        if (seen.has(targetId)) errors.push(`${keyName}: combination target ${targetId} is repeated.`);
        seen.add(targetId);
      }

      const signature = [...targetIds].sort().join(',');
      if (targets.has(signature)) {
        errors.push(`${keyName}: combination target ${targetIds.join(' + ')} is repeated.`);
      }

      targets.add(signature);
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
