import { useCallback, useReducer, type SetStateAction } from 'react';
import type { KeyboardPreset } from '../data/presets';

type History = { past: KeyboardPreset[]; present: KeyboardPreset | null; future: KeyboardPreset[] };
type Action = { type: 'change'; value: SetStateAction<KeyboardPreset | null> } | { type: 'undo' | 'redo' };
const empty: History = { past: [], present: null, future: [] };

function reduce(history: History, action: Action): History {
  if (action.type === 'change') {
    const next = typeof action.value === 'function' ? action.value(history.present) : action.value;
    if (!next) return empty;
    if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
    return { past: history.present ? [...history.past, history.present].slice(-100) : [], present: next, future: [] };
  }
  if (!history.present) return history;
  if (action.type === 'undo') {
    const previous = history.past.at(-1);
    return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history;
  }
  const next = history.future[0];
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) } : history;
}

export function useDraft() {
  const [history, dispatch] = useReducer(reduce, empty);
  const setDraft = useCallback((value: SetStateAction<KeyboardPreset | null>) => dispatch({ type: 'change', value }), []);
  return { draft: history.present, setDraft, canUndo: !!history.past.length, canRedo: !!history.future.length,
    undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }) };
}
