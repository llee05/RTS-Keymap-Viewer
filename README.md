# RTS Keymap Viewer

A browser-based keyboard reference for real-time strategy games, built with React 19, TypeScript 6, and Vite 8. View commands on a visual keyboard and create custom reference layouts.

## Current features

- One bundled preset: **Age of Empires IV Default**, including function keys, arrow keys, and keys with different widths and heights.
- Command tooltips on key hover, touch, or keyboard focus, including combinations owned by other participating keys.
- Arrow-key navigation across the keyboard, persistent assignment markers, and reduced-motion support.
- An **Add hotkey** button that records pressed keys and combinations and places commands on the keyboard automatically.
- Highlighting of every participating key in combinations, including shortcuts such as Ctrl+Shift+R.
- Command results with shortcut labels, category filtering, combination highlighting, and a **Next match** button. Search accepts notation such as `Ctrl+A` and `Control + A`.
- Persistent markers for assigned commands and combinations.
- Custom presets cloned from the active layout or created blank, with editable names, game labels, commands, combinations, categories, contexts, sources, and versions.
- Undo/redo, an unsaved indicator, discard confirmation, browser exit warnings, and recoverable drafts.
- Remembered active layouts and a bundled reference fallback with storage retry.
- JSON import/export, full-library backups, and custom-preset deletion with confirmation.
- Accessible key editor dialogs with keyboard focus containment, Escape dismissal, and focus restoration.
- Browser-local persistence through IndexedDB.
- A dark interface with responsive controls and a horizontally scrollable keyboard on smaller screens.

Editing a preset changes the reference board. Configure the actual game bindings separately in the game.

## Using the viewer

The app opens in **View**, with layout selection, search, and a reference keyboard. The **View** and **Edit** text links switch screens; `#edit` can also be bookmarked. Preset actions, backup management, recovery actions, and storage retry are available on **Edit**. Returning to View shows the saved layout and retains any open draft for when you return to Edit. Layout selection stays locked while a draft is open.

1. Choose **Active layout**. Hover, tap, or focus a key to see its commands and every combination that uses it. Press Escape to dismiss the tooltip. Scrolling the page or keyboard, or resizing the window, also dismisses it. Use arrow keys to move between nearby keys, skipping spacers; Home and End go to the first and last key in the row. Tab navigation remains available.
2. Open **Edit**, then select **Add hotkey** and enter a **Command**. Either select **Record hotkey**, hold the keys together and release all keys, or expand **Choose keys on screen** and select every participating key. The on-screen picker works with touch and keyboard navigation. Add an optional category or context, then select **Add hotkey**. An existing combination in the same context offers **Replace hotkey**. Single-key commands are appended; their category and context describe all commands on that key.
3. On **Edit**, select **Clone preset** to copy the current assignments, or open **More preset actions → Blank preset** to copy only the physical keyboard shape. **Edit preset** edits the active layout directly. Name and Game must contain text; saving trims both fields. **Source and version** holds optional provenance, such as a reference URL, game patch, or personal revision.
4. In edit mode, click a key or press Enter/Space on it. Enter one command per line and optionally classify that key's commands. Create combinations using **Combination key** or **Choose multiple combination keys**. Existing combinations offer **Change keys, category or context**, allowing their participants to be edited without re-recording. **Close editor** or Escape retains changes in the draft.
5. **Undo** and **Redo** step through draft changes (up to 100 previous states). The indicator distinguishes **Unsaved changes** from **No changes yet**. **Cancel** asks for confirmation when the draft differs from the saved preset. Escape or **Keep editing** dismisses that confirmation without discarding work.
6. Select **Save preset** for custom drafts. For bundled layouts, **Save as custom** keeps a persistent copy, while **Save for this session** keeps temporary edits that reset on reload. Saving disables editing and cancellation until the transaction completes; failed saves retain the draft for retry.

Recording only listens while its button is focused and active; typing the command does not record a hotkey. During recording, Tab, Escape, Enter, and Space are treated as bindings. Release all keys to resume dialog navigation, or select **Stop recording**. Recording uses physical keyboard codes matched to the displayed layout (the bundled board uses US QWERTY positions). Unsupported or ambiguous keys are rejected; keys intercepted by the operating system or browser cannot be recorded. **Choose keys on screen** is available when recording is unsuitable, including touch-only devices.

Spaces and line breaks are preserved while typing. Saving trims each command, removes empty lines, and treats an empty command list as unassigned. Combination targets must exist, must be real keys, and cannot target the owning key or repeat within a combination. The complete set of participating keys must be unique across the preset within each context. Use distinct contexts to retain separate assignments, for example General and Spectator. Context comparison ignores case and extra whitespace. Invalid combinations in existing custom presets are preserved, explained, and editable; saving is disabled until they are repaired. Imports use the same conflict checks and remain atomic.

Draft recovery is separate from saved presets. Changes are copied to browser-local storage as you edit. Reloading offers **Restore draft** or **Discard recovery**, preserving unfinished fields and raw command text. Browsers normally warn before navigating away with changes after user interaction; mobile browsers may omit that prompt, so recovery remains useful. Saving or confirming discard removes the recovery copy. If recovery storage is unavailable or full, the app explains that edits need to be saved before closing. Undo history is limited to the current session and is not recovered after reload.

### Finding commands

**Search commands or keys** matches command text, key labels, shortcut notation, categories, and contexts. Search ignores case and extra spaces. **Command category** filters the results. Each result shows a command and its shortcut, with category/context details; the count refers to commands rather than the number of participating keys. Select a result link, or press Enter in the search field, to focus the owning key and scroll it into view. Enter cycles through results; Escape in the search field clears the query and category. A matching combination highlights every participant. The Edit screen also provides **Next match** and **Clear search** buttons.

Blue markers indicate assigned commands; purple markers indicate combination participants, including incoming combinations. The legend stays visible on mobile, where the keyboard retains full-size keys and scrolls sideways. On Edit, backup and management controls are collapsed under **More preset actions** to keep the board easier to reach.

### Backups and preset management

On **Edit**, with no draft open, expand **More preset actions**. **Export preset** downloads the active layout as JSON, including its name, game, commands, combinations, categories, contexts, source/version metadata, key sizes, and spacers. Use **Import presets** in another browser to restore it. Each import creates a new custom copy with a fresh ID and keeps the original name and game; existing presets and bundled layouts are never overwritten. Imports are validated before saving, and a batch is saved in a single transaction so a failed import does not leave partial copies.

**Export all presets** backs up the full library, including the bundled layout. Large libraries are split into files of at most 100 presets and 2 MB each; the dialog offers an explicit download for every part. Import every part to restore the full library. A single preset over 2 MB must be shortened before export.

The importer accepts an exported version 1 backup (`format: "rts-keymap-viewer"`, `version: 1`, `presets: [...]`), a single `KeyboardPreset`, or an array of presets. Files must be no larger than 2 MB and contain 1–100 presets. Each preset must have 1–30 nonempty rows, at most 500 key entries, and valid combination references; optional width and height must be positive multipliers no greater than 30.

**Delete preset** is available for custom layouts only. Confirm the named layout in the dialog to delete it from this browser, or select **Cancel** or press Escape to keep it. Export a layout before deleting it if you want a backup.

### Saved presets

Presets are stored in the browser's IndexedDB database `rts-keymap-viewer`, in the `presets` object store. Saved custom presets survive reloads in the same browser profile and origin; different hosts or ports have separate storage. Clearing the site's browser storage removes custom presets.

**Bundled presets are refreshed from source every time the app loads.** Edits saved directly to a bundled preset apply for the current session and reset on reload. The app explains this beside the preset controls. Use **Clone preset** or **Save as custom** to keep a customized version across reloads. **Save as custom** saves the edited draft with a new custom ID and adds “(Custom)” to its name.

The active layout is remembered for the same browser profile and origin. If that layout no longer exists, the bundled default is selected. The selection and recovery draft use localStorage (`rts-keymap-active` and `rts-keymap-draft`); saved presets still use IndexedDB. Clearing site storage removes all three.

The status message reports loading, editing, saving, and errors. If IndexedDB fails, the bundled board remains available to view, search, and export. Editing, importing, and deletion are disabled until **Edit → Retry storage** reconnects successfully. Existing custom layouts are not cleared during recovery.

## Local development

Use npm with **Node.js 22.13 or later in the 22.x line, or Node.js 24 or later**, to satisfy the locked Vite and ESLint runtime requirements.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/RTS-Keymap-Viewer/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot module replacement. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run Node regression tests for validation, search, draft isolation, preset import/export, and storage transaction handling. |
| `npm run test:coverage` | Run the unit suite and report coverage for the data modules it exercises. |
| `npm run test:e2e` | Run Playwright regression tests against the production build in desktop and mobile Chromium. |
| `npx tsc -b` | Check the application and Vite configuration types. |
| `npm run build` | Run TypeScript checks and build static assets into `dist/`. |
| `npm run preview` | Serve the production build locally after building. |

Before handing off changes, run:

```bash
npm run lint
npm test
npx tsc -b
npm run build
npm run test:e2e
```

Install Chromium once before running browser tests:

```bash
npx playwright install chromium
```

On Linux systems missing browser libraries, use `npx playwright install --with-deps chromium`. The browser suite starts and stops Vite preview on `http://127.0.0.1:4173/RTS-Keymap-Viewer/`, so build first and leave that port free. Each test uses its own temporary browser profile and IndexedDB database. Failed browser runs leave traces in `test-results/`.

Storage unit tests drive database request and transaction events through a controlled stub to check commit timing, error propagation, and connection cleanup. The browser suite verifies persistence and rollback using real IndexedDB. Unit coverage reports describe the data modules; React components are exercised by the browser suite.

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Preset selection, draft state, import/export, saving/deletion, and component coordination. |
| `src/components/PresetControls.tsx` | Preset selection, edit controls, and backup/management actions. |
| `src/components/Keyboard.tsx` | Keyboard buttons, assignment markers, combination/search highlighting, and tooltip lifecycle. |
| `src/components/CommandSearch.tsx` | Search input, result count, and navigation controls. |
| `src/components/KeyEditor.tsx` | Command and combination editing in a dialog. |
| `src/components/HotkeyRecorder.tsx` | Command entry, focused key recording, and detected binding previews. |
| `src/components/KeyTooltip.tsx` | Portal tooltips positioned within the viewport and linked to keys. |
| `src/components/Dialog.tsx` | Native modal dialog lifecycle, Tab containment, dismissal, and focus restoration. |
| `src/App.css` | App layout, keyboard, editors, tooltips, and responsive styles. |
| `src/index.css` | Global styles and theme variables. |
| `src/main.tsx` | React entry point with StrictMode. |
| `src/data/defaultPresets.ts` | Bundled keyboard layouts and commands. |
| `src/data/presets.ts` | Preset types, IndexedDB storage, seeding, and migration helpers. |
| `src/data/presetValidation.ts` | Combination validation before saving and explanations for invalid saved combinations. |
| `src/data/presetEditing.ts` | Deep cloning, draft updates, custom IDs, and command normalization. |
| `src/data/keyboard.ts` | Key labels, command results, categories, related keys, and canonical shortcut signatures. |
| `src/data/browserState.ts` | Optional localStorage selection and validated draft recovery. |
| `src/hooks/useDraft.ts` | Bounded undo/redo history without mutating saved presets. |
| `src/components/KeyPicker.tsx` | Searchable on-screen selection of shortcut participants. |
| `src/data/hotkeyCapture.ts` | Physical key matching, combination conflict detection, and recorded draft assignments. |
| `src/data/presetTransfer.ts` | Backup serialization and validation of imported JSON. |
| `tests/*.test.ts` | Node regression checks for data and draft behavior. |
| `tests/browser/*.spec.ts` | Desktop/mobile interaction, recovery, backup, persistence, error, and accessibility regressions. |
| `playwright.config.ts` | Desktop/mobile Chromium projects and the test preview server. |
| `public/` | Static assets copied into the build. |
| `vite.config.ts` | React plugin and deployment base path. |
| `.github/workflows/deploy.yml` | Build and deployment to GitHub Pages. |

To add a bundled layout, add a `KeyboardPreset` to `defaultPresets`. Keys are arranged in rows; combination targets use zero-based `rowIndex-keyIndex` positions, including spacer entries. `KeyCombination.keyId` identifies the first target, and optional `additionalKeyIds` stores the remaining targets for combinations with three or more keys. Existing two-key presets and version 1 backups remain compatible. Keep those references in sync when changing a layout. See [AGENTS.md](AGENTS.md) for contributor guidance.

## Deployment

The GitHub Actions workflow runs lint, Node tests, the production build, and desktop/mobile Chromium browser tests with Node.js 22. Pull requests run the checks without deploying. Pushes to `main` and manual workflow runs deploy `dist/` to GitHub Pages after all checks pass. Configure the repository's GitHub Pages source as **GitHub Actions**.

Vite currently uses `/RTS-Keymap-Viewer/` as its base path. Update `base` in `vite.config.ts` if deploying under a different path. The app runs entirely in the browser and requires only static hosting.
