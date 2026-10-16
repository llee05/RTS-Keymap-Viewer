# AGENTS.md

## Project overview

RTS Keymap Viewer is a browser-only React 19 and TypeScript 6 application built with Vite 8. It displays RTS commands on a visual keyboard, with separate View and Edit screens, searchable commands, recorded or on-screen hotkey entry, custom presets, JSON backups, and three colour themes. The current bundled layout is **Age of Empires IV Default**. There is no backend; saved presets use IndexedDB, while selection, draft recovery, and theme preferences use localStorage. The app is a reference tool and does not change bindings in a game.

## Code map

- `src/App.tsx` owns hash-based View/Edit navigation, preset selection, draft recovery, import/export, saving/deletion, and component coordination.
- `src/hooks/useDraft.ts` owns draft state and bounded undo/redo history.
- `src/components/` contains preset controls, keyboard/search rendering, key editors, portal tooltips, and a reusable native dialog with focus restoration. `HotkeyRecorder.tsx` and `KeyPicker.tsx` support physical recording and on-screen participant selection; `HotkeyAdvancedOptions.tsx` shares collapsed category/context fields between hotkey dialogs.
- `src/App.css` styles the app, keyboard, editors, tooltips, and responsive layout. `src/index.css` defines global styles and the Midnight, Forest, and Ember theme variables. `src/components/ThemePicker.tsx` and `src/data/theme.ts` manage theme selection, application, and persistence.
- `src/main.tsx` mounts the application in React StrictMode.
- `src/data/defaultPresets.ts` is the source of bundled layouts and commands.
- `src/data/presets.ts` defines `KeyboardPreset`, `Keybind`, and `KeyCombination`, and handles IndexedDB loading, saving, seeding, and migration helpers.
- `src/data/presetEditing.ts` handles draft cloning, blank/custom presets, IDs, updates, and normalization; `keyboard.ts` handles key labels, command results, categories, combinations, and canonical shortcut signatures.
- `src/data/hotkeyCapture.ts` maps physical keyboard codes, detects conflicts, and assigns recorded commands to drafts. `src/data/presetValidation.ts` validates names, game labels, combination references, and shortcut conflicts before saving.
- `src/data/presetTransfer.ts` validates imported JSON and serializes bounded backup parts. Imports always create new custom IDs and save batches atomically.
- `src/data/browserState.ts` handles optional localStorage selection and validated recovery of unfinished drafts, preserving raw text.
- `tests/*.test.ts` contains Node regression tests. `tests/browser/*.spec.ts` and `playwright.config.ts` cover desktop/mobile interaction, screen navigation, themes, recovery, persistence, backups, and error handling; `tests/browser/helpers.ts` shares browser setup helpers.
- `public/` contains static assets; `src/assets/` contains source assets.
- `vite.config.ts` sets the React plugin and `/RTS-Keymap-Viewer/` base path.
- `.github/workflows/deploy.yml` runs lint, Node tests, the build, and browser tests on pull requests, pushes to `main`, and manual runs. Pushes and manual runs deploy `dist/` after checks pass, using Node.js 22.

## Preset data and persistence

- A `KeyboardPreset` has `id`, `name`, `game`, and `rows: Keybind[][]`, with optional `source` and `version` provenance. Each key has a `label` and `hotkeys: string[]`, with optional combinations, dimensions, spacer, category, and context metadata. Name and game must contain text and are trimmed on save.
- A `KeyCombination` has `keyId`, `action`, optional `additionalKeyIds` for three or more participants, and optional category/context. Targets use zero-based `rowIndex-keyIndex` positions, including spacer entries. Keep all references valid when inserting, moving, or removing keys or rows, and consider existing saved custom layouts. Preserve compatibility with two-key presets and version 1 backups.
- Width uses keyboard units on a 74px pitch: `width * (64px + 10px) - 10px`, clamped to at least 1px, so wide keys include the gutters they span. Height remains a multiple of 64px; both dimensions default to 1. Keep the shared size/gap variables in `.keyboard` consistent. Spacer entries use the same width rule, never shrink, and are excluded from focus and combination pickers. The bundled rows span 15 units with an inverted-T arrow cluster; preserve their alignment without changing key indices or rewriting saved custom layouts.
- The editor preserves raw command text while typing. Normalization on save parses one command per line, trims whitespace, removes empty lines, and represents an unassigned key as `hotkeys: ['']`. Do not normalize the live draft or destroy retryable text after a failed save.
- Combination pickers distinguish repeated labels as Left/Right for two occurrences or by ordinal for more. Self-targets and repeated targets on the same key are excluded.
- Validate combinations across owners and key order: the complete participant set must be unique within each context, ignoring context case and extra whitespace. Targets must exist and cannot be spacers, self-targets, or repeated targets. Preserve invalid legacy custom combinations for repair, explain errors, and block saving until valid.
- Imports accept a version 1 backup, a single preset, or an array, with at most 2 MiB of UTF-8 JSON and 1–100 presets. Each preset allows 1–30 nonempty rows, at most 500 entries including spacers, and dimensions greater than 0 and at most 30. Exported library parts must meet the same byte/count limits; an individually oversized preset fails export.
- IndexedDB uses database `rts-keymap-viewer`, version 1, and object store `presets`, keyed by preset `id`. Use the storage helpers in `src/data/presets.ts` for persistence changes.
- `loadPresets()` reseeds bundled presets on every load and returns source defaults followed by stored custom presets. Changes saved under a bundled preset ID reset on reload; custom IDs persist. Preserve this behavior unless the task explicitly changes it, and keep README guidance consistent.
- Existing migration helpers cover missing function rows and legacy arrow labels for bundled IDs. Stored bundled records are currently replaced by source defaults during loading; custom records pass through these helpers unchanged.
- Editing uses a deep-cloned draft, including nested hotkey arrays, combination objects, and `additionalKeyIds`. Keep saved presets immutable. Undo/redo retains up to 100 previous draft states within the session; recovery does not restore history.
- Save updates storage and the active preset only after the transaction commits; failures retain the draft. Lock editing, cancellation, and repeat operations while saving. Bundled drafts offer temporary session saving or **Save as custom** with a fresh ID.
- Cancel confirms discard for changed drafts. Save or confirmed discard clears recovery. localStorage keys are `rts-keymap-active`, `rts-keymap-draft`, and `rts-keymap-theme`; storage is scoped to browser profile and origin. Keep recovery raw and separate from normalized imports, handle blocked/full storage, and retain the unsaved-navigation warning.
- If IndexedDB is unavailable, keep the bundled board viewable, searchable, and exportable. Disable edits/imports/deletion until **Edit → Retry storage** succeeds without clearing custom presets. A failed theme preference write must still allow session theme changes.

## Screens and interaction

- Default to View (`#view` or no hash); Edit uses `#edit`. Returning to View shows saved data while retaining an open draft. Keep layout selection locked while a draft exists, including on View. Hash navigation closes editor dialogs and supports browser back/forward.
- **New preset** on View and **Blank preset** under Edit's **More preset actions** preserve the physical keyboard shape and clear assignments/provenance. **Clone preset** retains assignments. Block new drafts while storage is loading/unavailable, an operation is active, or recovery is pending.
- **Add hotkey** can start a draft from the active layout. Record physical keyboard codes only while recording is active and focused; treat navigation keys as bindings until all keys are released. Preserve sided modifiers and reject unsupported/ambiguous keys. Keep on-screen selection available for touch and intercepted shortcuts.
- Use the existing terms **Command**, **Commands for [key] alone**, **Commands with other keys**, and **Combination command**. Optional category/context inputs stay collapsed under **Advanced options**. Key-level metadata applies to all single-key commands on that key; combinations can have their own metadata, and category falls back to the owning key's category.
- Search results represent commands, match shortcut notation and metadata, and focus/scroll the owning key when activated. Preserve Enter cycling, Escape clearing, category filters, and highlighting of every combination participant.

## Working guidelines

- Keep changes focused on the requested behavior and preserve unrelated work in the working tree.
- Prefer small, reusable React components and typed data structures over duplicated markup or untyped values.
- Keep UI behavior accessible to pointer, touch, and keyboard users. Keys are focusable; hover/tap/focus reveals commands outside an active draft, and click/Enter/Space opens editors while editing. Preserve arrow-key and Home/End navigation that skips spacers, visible focus styles, dialog focus containment/restoration, control labels, and the live database status message.
- Combinations highlight related keys in either direction. View-mode tooltips render through a portal into `document.body` and dismiss on scroll or resize; preserve this behavior when changing the scrollable keyboard.
- Match the existing dark visual language and responsive behavior across all three themes. Use CSS theme variables for UI, dialogs, and portal tooltips; keep command and combination markers distinguishable and respect reduced-motion preferences. The mobile breakpoint is 700px, and the keyboard scrolls horizontally rather than shrinking its keys. Keep navigation clear of the theme picker on narrow screens.
- Do not add dependencies unless they provide a clear benefit that cannot be achieved cleanly with the existing stack.
- Use `rg` or `rg --files` for repository searches.
- Keep README.md current when changing features, storage semantics, development commands, or deployment behavior.
- Keep README's copyright section at the end, distinguish project attribution from third-party game/dependency rights, and do not introduce or change a project license without an explicit request.

## Development

Install the locked dependencies with `npm ci`, then use `npm run dev`. The local URL normally includes `/RTS-Keymap-Viewer/`. `npm run build` runs `tsc -b` followed by Vite and outputs `dist/`; `npm run preview` serves that build.

Use Node.js 22.13 or later in the 22.x line, or Node.js 24 or later, to satisfy the locked Vite and ESLint requirements. `npm test` uses Node's built-in test runner; `npm run test:coverage` reports coverage for the data modules it exercises. Storage unit tests drive boundary events through a controlled stub; browser tests cover real IndexedDB persistence and rollback. `npm run test:e2e` uses Playwright against the production build; install Chromium with `npx playwright install chromium` once and leave preview port 4173 free.

## Validation

Run the checks relevant to the change before handing it off:

```bash
npm run lint
npm test
npx tsc -b
npm run build
npm run test:e2e
```

Use a Node.js version supported by the installed Vite release. If a full build cannot run because of the local runtime, report that clearly and still run the independent TypeScript and lint checks.

For documentation-only changes, verify documented commands, paths, and behavior against the source and run `git diff --check`; application tests are not required unless code, configuration, or runtime behavior also changes.

For UI or persistence changes, also check the affected behavior in the browser: hover and keyboard focus, combination highlighting, new/edit/save/cancel flows, custom preset persistence after reload, and small-screen scrolling as relevant. Use a custom preset when checking persistence, since bundled presets reset on load. Exercise load/save error handling when changing storage code.

When affected, also check View/Edit navigation and retained drafts, undo/redo and reload recovery, physical/on-screen shortcut entry, conflict repair, bounded backup parts, and theme persistence and portal styling on desktop and mobile.

Keep the Vite base path aligned with the hosting path when changing deployment configuration. The Pages workflow runs lint, Node tests, the build, and desktop/mobile Chromium browser tests before deployment. Pull requests run checks without deploying.

## Git workflow

- After completing a task and running the relevant validation, stage its changes with `git add <paths>` and create a commit with `git commit`. Do this by default unless the user explicitly asks to leave changes uncommitted.
- Review `git status`, the intended diff, and `git diff --cached` before committing. Stage explicit file paths so the commit includes only changes for the task.
- Do not alter, discard, or include unrelated user changes.
- Write concise, imperative commit subjects that describe the user-facing or technical outcome.
- Never attribute a commit to AI or mention AI assistance in its message.
- Split each task into appropriately scoped, cohesive commits.
- Leave pushing to the user. Do not run `git push` unless the user explicitly asks for it.
- Include the commit hash and a brief summary in the final handoff.
