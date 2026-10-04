import type { KeyboardPreset } from './presets.ts';

export type KeyOption = { id: string; label: string };

export function getKeyId(rowIndex: number, keyIndex: number): string {
  return `${rowIndex}-${keyIndex}`;
}

function ordinal(value: number): string {
  const lastTwo = value % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th';
  return `${value}${suffix}`;
}

export function getKeyOptions(preset: KeyboardPreset): KeyOption[] {
  const counts = new Map<string, number>();
  const seen = new Map<string, number>();
  preset.rows.flat().filter((key) => !key.spacer).forEach((key) => {
    counts.set(key.label, (counts.get(key.label) ?? 0) + 1);
  });
  return preset.rows.flatMap((row, rowIndex) => row.flatMap((key, keyIndex) => {
    if (key.spacer) return [];
    const occurrence = (seen.get(key.label) ?? 0) + 1;
    seen.set(key.label, occurrence);
    const count = counts.get(key.label) ?? 1;
    const label = key.label || 'Blank key';
    return [{
      id: getKeyId(rowIndex, keyIndex),
      label: count === 1 ? label : count === 2
        ? `${occurrence === 1 ? 'Left' : 'Right'} ${label}`
        : `${ordinal(occurrence)} ${label}`,
    }];
  }));
}

export function getRelatedKeyIds(preset: KeyboardPreset, keyId: string | null): Set<string> {
  const related = new Set<string>();
  if (!keyId) return related;
  related.add(keyId);
  preset.rows.forEach((row, rowIndex) => row.forEach((key, keyIndex) => {
    if (key.spacer) return;
    const currentId = getKeyId(rowIndex, keyIndex);
    key.combinations?.forEach((combination) => {
      if (currentId === keyId) related.add(combination.keyId);
      if (combination.keyId === keyId) related.add(currentId);
    });
  }));
  return related;
}

export function findMatchingKeys(preset: KeyboardPreset, query: string): Set<string> {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = new Set<string>();
  if (!terms.length) return matches;
  const labels = new Map(getKeyOptions(preset).map((option) => [option.id, option.label]));
  const containsQuery = (text: string) => terms.every((term) => text.toLowerCase().includes(term));
  preset.rows.forEach((row, rowIndex) => row.forEach((key, keyIndex) => {
    if (key.spacer) return;
    const keyId = getKeyId(rowIndex, keyIndex);
    if ([labels.get(keyId) ?? key.label, ...key.hotkeys].some(containsQuery)) matches.add(keyId);
    key.combinations?.forEach((combination) => {
      if (containsQuery(`${labels.get(keyId)} ${labels.get(combination.keyId) ?? ''} ${combination.action}`)) {
        matches.add(keyId);
        if (labels.has(combination.keyId)) matches.add(combination.keyId);
      }
    });
  }));
  return matches;
}
