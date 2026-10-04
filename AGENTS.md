# AGENTS.md

## Project overview

RTS Keymap Viewer is a browser-only React 19 and TypeScript 6 application built with Vite 8. It displays RTS commands on a visual keyboard and supports viewing, cloning, and editing presets. The current bundled layout is **Age of Empires IV Default**. There is no backend; presets are persisted locally through IndexedDB.

## Code map

- `src/App.tsx` owns preset selection, view/edit modes, draft cloning, key editors, combination highlighting, and tooltip positioning. The current UI is implemented in this component.
- `src/App.css` styles the app, keyboard, editors, tooltips, and responsive layout. `src/index.css` defines global styles and theme variables.
- `src/main.tsx` mounts the application in React StrictMode.
- `src/data/defaultPresets.ts` is the source of bundled layouts and commands.
- `src/data/presets.ts` defines `KeyboardPreset`, `Keybind`, and `KeyCombination`, and handles IndexedDB loading, saving, seeding, and migration helpers.
- `public/` contains static assets; `src/assets/` contains source assets.
- `vite.config.ts` sets the React plugin and `/RTS-Keymap-Viewer/` base path.
- `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on pushes to `main` and manual runs, using Node.js 22.

## Preset data and persistence

- A `KeyboardPreset` has `id`, `name`, `game`, and `rows: Keybind[][]`. Each key has a `label` and `hotkeys: string[]`, with optional combinations, width, height, and spacer metadata.
- Combination targets use `keyId` values in zero-based `rowIndex-keyIndex` form. Positions include spacer entries. Keep references valid when inserting, moving, or removing keys or rows, and consider existing saved custom layouts.
- Width and height are multipliers of a 64px base key size; both default to 1. Spacer entries reserve horizontal space and are excluded from focus and combination pickers.
- The editor parses one command per line, trims whitespace, removes empty lines, and represents an unassigned key as `hotkeys: ['']`.
- Combination pickers distinguish repeated labels as Left/Right for two occurrences or by ordinal for more. Self-targets and repeated targets on the same key are excluded.
- IndexedDB uses database `rts-keymap-viewer`, version 1, and object store `presets`, keyed by preset `id`. Use the storage helpers in `src/data/presets.ts` for persistence changes.
- `loadPresets()` reseeds bundled presets on every load and returns source defaults followed by stored custom presets. Changes saved under a bundled preset ID reset on reload; custom IDs persist. Preserve this behavior unless the task explicitly changes it, and keep README guidance consistent.
- Existing migration helpers cover missing function rows and legacy arrow labels for bundled IDs. Stored bundled records are currently replaced by source defaults during loading; custom records pass through these helpers unchanged.
- Editing uses a deep-cloned draft, including nested hotkey arrays and combination objects. Save updates storage and the active preset; Cancel discards the draft. Preserve the separation between drafts and saved data.

## Working guidelines

- Keep changes focused on the requested behavior and preserve unrelated work in the working tree.
- Prefer small, reusable React components and typed data structures over duplicated markup or untyped values.
- Keep UI behavior accessible to both pointer and keyboard users. Keys are focusable; hover/focus reveals commands in view mode, and click/Enter/Space opens editors in edit mode. Preserve visible focus styles, control labels, and the live database status message.
- Combinations highlight related keys in either direction. View-mode tooltips render through a portal into `document.body` and dismiss on scroll or resize; preserve this behavior when changing the scrollable keyboard.
- Match the existing dark visual language, CSS theme variables, and responsive behavior. The mobile breakpoint is 700px, and the keyboard scrolls horizontally rather than shrinking its keys.
- Do not add dependencies unless they provide a clear benefit that cannot be achieved cleanly with the existing stack.
- Use `rg` or `rg --files` for repository searches.
- Keep README.md current when changing features, storage semantics, development commands, or deployment behavior.

## Development

Install the locked dependencies with `npm ci`, then use `npm run dev`. The local URL normally includes `/RTS-Keymap-Viewer/`. `npm run build` runs `tsc -b` followed by Vite and outputs `dist/`; `npm run preview` serves that build.

Use Node.js 22.13 or later in the 22.x line, or Node.js 24 or later, to satisfy the locked Vite and ESLint requirements. There is currently no automated test runner configured.

## Validation

Run the checks relevant to the change before handing it off:

```bash
npm run lint
npx tsc -b
npm run build
```

Use a Node.js version supported by the installed Vite release. If a full build cannot run because of the local runtime, report that clearly and still run the independent TypeScript and lint checks.

For UI or persistence changes, also check the affected behavior in the browser: hover and keyboard focus, combination highlighting, new/edit/save/cancel flows, custom preset persistence after reload, and small-screen scrolling as relevant. Use a custom preset when checking persistence, since bundled presets reset on load. Exercise load/save error handling when changing storage code.

Keep the Vite base path aligned with the hosting path when changing deployment configuration. The Pages workflow currently runs the build; lint is a separate local check.

## Git workflow

- After completing a task and running the relevant validation, stage its changes with `git add <paths>` and create a commit with `git commit`. Do this by default unless the user explicitly asks to leave changes uncommitted.
- Review `git status`, the intended diff, and `git diff --cached` before committing. Stage explicit file paths so the commit includes only changes for the task.
- Do not alter, discard, or include unrelated user changes.
- Write concise, imperative commit subjects that describe the user-facing or technical outcome.
- Never attribute a commit to AI or mention AI assistance in its message.
- Split each task into appropriately scoped, cohesive commits.
- Leave pushing to the user. Do not run `git push` unless the user explicitly asks for it.
- Include the commit hash and a brief summary in the final handoff.
