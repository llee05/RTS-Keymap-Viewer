// src/data/presets.ts

import { defaultPresets } from "./defaultPresets.ts";
import { validatePreset } from './presetValidation.ts';

export type Keybind = {
  label: string;
  hotkeys: string[];
  combinations?: KeyCombination[];
  width?: number;
  height?: number;
  spacer?: boolean;
};

export type KeyCombination = {
  keyId: string;
  additionalKeyIds?: string[];
  action: string;
};

export type KeyboardPreset = {
  id: string;
  name: string;
  game: string;
  rows: Keybind[][];
};

const DATABASE_NAME = "rts-keymap-viewer";
const DATABASE_VERSION = 1;
const PRESET_STORE = "presets";

function openPresetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PRESET_STORE)) {
        database.createObjectStore(PRESET_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeToStore(database: IDBDatabase, write: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PRESET_STORE, 'readwrite');
    const store = transaction.objectStore(PRESET_STORE);

    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Database transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('Database transaction failed'));

    try {
      write(store);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

async function seedDefaultPresets(database: IDBDatabase) {
  defaultPresets.forEach(validatePreset);
  await writeToStore(database, (store) => defaultPresets.forEach((preset) => store.put(preset)));
}

function cloneKeybind(keybind: Keybind): Keybind {
  return {
    ...keybind,
    hotkeys: [...keybind.hotkeys],
    combinations: keybind.combinations?.map((combination) => ({
      ...combination,
      ...(combination.additionalKeyIds ? { additionalKeyIds: [...combination.additionalKeyIds] } : {}),
    })),
  };
}

function hasFunctionRow(preset: KeyboardPreset): boolean {
  return preset.rows[0]?.some((keybind) => keybind.label === "F1") ?? false;
}

function addMissingDefaultRows(preset: KeyboardPreset): KeyboardPreset {
  const defaultPreset = defaultPresets.find((currentPreset) => currentPreset.id === preset.id);

  if (!defaultPreset || hasFunctionRow(preset)) {
    return preset;
  }

  const functionRow = defaultPreset.rows[0].map(cloneKeybind);

  return {
    ...preset,
    rows: [functionRow, ...preset.rows],
  };
}

const arrowLabelReplacements = new Map([
  ["UP", "↑"],
  ["LEFT", "←"],
  ["DOWN", "↓"],
  ["RIGHT", "→"],
]);

function replaceArrowLabels(preset: KeyboardPreset): KeyboardPreset {
  if (!defaultPresets.some((defaultPreset) => defaultPreset.id === preset.id)) {
    return preset;
  }

  let changed = false;
  const rows = preset.rows.map((row) =>
    row.map((keybind) => {
      const replacement = arrowLabelReplacements.get(keybind.label);

      if (!replacement) {
        return keybind;
      }

      changed = true;
      return {
        ...keybind,
        label: replacement,
      };
    }),
  );

  return changed ? { ...preset, rows } : preset;
}

function migratePreset(preset: KeyboardPreset): KeyboardPreset {
  return replaceArrowLabels(addMissingDefaultRows(preset));
}

export async function loadPresets(): Promise<KeyboardPreset[]> {
  const database = await openPresetDatabase();
  try {
    const transaction = database.transaction(PRESET_STORE, "readonly");
    const store = transaction.objectStore(PRESET_STORE);
    const presets = await requestToPromise<KeyboardPreset[]>(store.getAll());

    await seedDefaultPresets(database);

    if (presets.length > 0) {
      const defaultPresetIds = new Set(defaultPresets.map((preset) => preset.id));
      const customPresets = presets
        .filter((preset) => !defaultPresetIds.has(preset.id))
        .map(migratePreset);

      return [...defaultPresets, ...customPresets];
    }

    return defaultPresets;
  } finally {
    database.close();
  }
}

export async function savePreset(preset: KeyboardPreset): Promise<void> {
  await savePresets([preset]);
}

export async function savePresets(presets: KeyboardPreset[]): Promise<void> {
  presets.forEach(validatePreset);
  const database = await openPresetDatabase();
  try {
    await writeToStore(database, (store) => presets.forEach((preset) => store.put(preset)));
  } finally {
    database.close();
  }
}

export async function deletePreset(id: string): Promise<void> {
  if (defaultPresets.some((preset) => preset.id === id)) throw new Error('Bundled presets cannot be deleted.');
  const database = await openPresetDatabase();
  try {
    await writeToStore(database, (store) => { store.delete(id); });
  } finally {
    database.close();
  }
}
