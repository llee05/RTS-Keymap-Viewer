import type { KeyboardPreset, KeyCombination } from './presets.ts';

export type KeyOption = { id: string; label: string };

export function getKeyId(rowIndex: number, keyIndex: number): string {
  return `${rowIndex}-${keyIndex}`;
}

export function getCombinationTargets(combination: KeyCombination): string[] {
  return [combination.keyId, ...(combination.additionalKeyIds ?? [])];
}

export function getCombinationLabel(label: string, combination: KeyCombination, labels: Map<string, string>): string {
  return [label, ...getCombinationTargets(combination).map((id) => labels.get(id) ?? id)].join(' + ');
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
  preset.rows.forEach((row, rowIndex) => row.forEach((key, keyIndex) => {
    if (key.spacer) return;
    const currentId = getKeyId(rowIndex, keyIndex);
    key.combinations?.forEach((combination) => {
      const participants = [currentId, ...getCombinationTargets(combination)];
      if (participants.includes(keyId)) participants.forEach((id) => related.add(id));
    });
  }));
  return related;
}

export type CommandEntry = {
  id: string;
  ownerId: string;
  keyIds: string[];
  action: string;
  shortcut: string;
  category: string;
  context: string;
  combination: boolean;
};

export function getCommandEntries(preset: KeyboardPreset): CommandEntry[] {
  const labels = new Map(getKeyOptions(preset).map((option) => [option.id, option.label]));
  return preset.rows.flatMap((row, rowIndex) => row.flatMap((key, keyIndex) => {
    if (key.spacer) return [];
    const ownerId = getKeyId(rowIndex, keyIndex);
    const label = labels.get(ownerId) ?? key.label;
    const commands: CommandEntry[] = key.hotkeys.filter((action) => action.trim()).map((action, index) => ({
      id: `${ownerId}:command-${index}`, ownerId, keyIds: [ownerId], action, shortcut: label,
      category: key.category?.trim() || 'Uncategorized', context: key.context?.trim() || '', combination: false,
    }));
    const combinations: CommandEntry[] = (key.combinations ?? []).map((combination, index) => ({
      id: `${ownerId}:combination-${index}`, ownerId,
      keyIds: [...new Set([ownerId, ...getCombinationTargets(combination)].filter((id) => labels.has(id)))],
      action: combination.action || 'No action specified', shortcut: getCombinationLabel(label, combination, labels),
      category: combination.category?.trim() || key.category?.trim() || 'Uncategorized',
      context: combination.context?.trim() || '', combination: true,
    }));
    return [...commands, ...combinations];
  }));
}

function normalizeSearch(text: string): string {
  return text.toLowerCase().replace(/\bcontrol\b/g, 'ctrl').replace(/\bescape\b/g, 'esc').trim().replace(/\s+/g, ' ');
}

export function displayShortcut(shortcut: string): string {
  return shortcut.split(' + ').sort((a, b) => {
    const modifier = (label: string) => /\b(ctrl|control|shift|alt|super|meta)\b/i.test(label) ? 0 : 1;
    return modifier(a) - modifier(b);
  }).join(' + ');
}

function parseChordQuery(preset: KeyboardPreset, normalized: string): { chord: string[]; textTerms: string[] } | null {
  if (!normalized.includes('+')) return null;
  const rawParts = normalized.split('+').map((part) => part.trim()).filter(Boolean);
  if (rawParts.length < 2) return null;

  const keyLabels = new Set<string>();
  for (const option of getKeyOptions(preset)) {
    const norm = normalizeSearch(option.label);
    keyLabels.add(norm);
    keyLabels.add(norm.replace(/^(left|right) /, ''));
  }
  for (const row of preset.rows) {
    for (const key of row) {
      if (key.label) {
        const norm = normalizeSearch(key.label);
        keyLabels.add(norm);
        keyLabels.add(norm.replace(/^(left|right) /, ''));
      }
    }
  }
  for (const alias of ['ctrl', 'control', 'shift', 'alt', 'super', 'meta', 'cmd', 'command', 'esc', 'escape']) {
    keyLabels.add(alias);
  }

  const textTerms: string[] = [];
  const chord: string[] = [];

  const firstWords = rawParts[0].split(/\s+/).filter(Boolean);
  if (!firstWords.length) return null;
  let firstLabelLength = firstWords.length;
  while (firstLabelLength > 1 && !keyLabels.has(firstWords.slice(-firstLabelLength).join(' '))) firstLabelLength--;
  chord.push(firstWords.slice(-firstLabelLength).join(' '));
  textTerms.push(...firstWords.slice(0, -firstLabelLength));

  for (let i = 1; i < rawParts.length - 1; i++) {
    const part = rawParts[i].trim();
    if (!part) return null;
    chord.push(part);
  }

  const lastWords = rawParts[rawParts.length - 1].split(/\s+/).filter(Boolean);
  if (!lastWords.length) return null;
  let lastLabelLength = lastWords.length;
  while (lastLabelLength > 1 && !keyLabels.has(lastWords.slice(0, lastLabelLength).join(' '))) lastLabelLength--;
  chord.push(lastWords.slice(0, lastLabelLength).join(' '));
  textTerms.push(...lastWords.slice(lastLabelLength));

  return { chord, textTerms };
}

export function findCommandResults(preset: KeyboardPreset, query: string, category = ''): CommandEntry[] {
  const normalized = normalizeSearch(query);
  if (!normalized && !category) return [];
  const terms = normalized.split(/\s+/).filter(Boolean);
  const parsedChord = parseChordQuery(preset, normalized);
  const contains = (text: string) => terms.every((term) => normalizeSearch(text).includes(term));
  const entries = getCommandEntries(preset);
  // Keys without commands remain discoverable by their label.
  const assigned = new Set(entries.flatMap((entry) => entry.keyIds));
  for (const option of getKeyOptions(preset)) {
    if (normalized && !assigned.has(option.id)) entries.push({ id: `${option.id}:unassigned`, ownerId: option.id, keyIds: [option.id],
      action: 'Unassigned', shortcut: option.label, category: 'Uncategorized', context: '', combination: false });
  }
  return entries.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (parsedChord && parsedChord.chord.length > 1) {
      const compact = (text: string) => normalizeSearch(text).replace(/\s*\+\s*/g, '+');
      if (compact(entry.action).includes(compact(query))) return true;
      const parts = normalizeSearch(entry.shortcut).split(' + ');
      if (parts.length !== parsedChord.chord.length) return false;
      const requested = [...parsedChord.chord].sort();
      const actual = parts.map((part) => parsedChord.chord.some((term) => term === part) ? part : part.replace(/^(left|right) /, '')).sort();
      if (!actual.every((part, index) => part === requested[index])) return false;
      const haystack = `${entry.shortcut} ${entry.action} ${entry.context} ${entry.category}`;
      return parsedChord.textTerms.every((term) => normalizeSearch(haystack).includes(term));
    }
    return contains(`${entry.shortcut} ${entry.action} ${entry.context} ${entry.category}`);
  });
}

export function findMatchingKeys(preset: KeyboardPreset, query: string, category = ''): Set<string> {
  return new Set(findCommandResults(preset, query, category).flatMap((entry) => entry.keyIds));
}

export function getBindingSignature(keyIds: string[], context = ''): string {
  return [...new Set(keyIds)].sort().join(',') + ':' + context.trim().toLowerCase().replace(/\s+/g, ' ');
}
