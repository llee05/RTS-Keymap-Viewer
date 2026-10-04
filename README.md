# RTS Keymap Viewer

A browser-based keyboard reference for real-time strategy games, built with React 19, TypeScript 6, and Vite 8. View commands on a visual keyboard and create custom reference layouts.

## Current features

- One bundled preset: **Age of Empires IV Default**, including function keys, arrow keys, and keys with different widths and heights.
- Command tooltips on key hover or keyboard focus.
- Highlighting of related keys in two-key combinations.
- Command and combination search, with matching keys highlighted and a **Next match** button to jump between them.
- Persistent markers for assigned commands and combinations.
- Custom presets cloned from the active layout, with editable names, game labels, commands, and combinations.
- JSON import/export and custom-preset deletion with confirmation.
- Accessible key editor dialogs with keyboard focus containment, Escape dismissal, and focus restoration.
- Browser-local persistence through IndexedDB.
- A dark interface with responsive controls and a horizontally scrollable keyboard on smaller screens.

Editing a preset changes the reference board. Configure the actual game bindings separately in the game.

## Using the viewer

1. Choose a layout from **Active layout**. Hover over a key, tap it, or focus it with Tab to see its commands and combinations. Press Escape to dismiss a tooltip. Scrolling the page or keyboard, or resizing the window, also dismisses it.
2. Select **New preset** to copy the active layout, or **Edit preset** to edit it directly.
3. Change the preset's **Name** and **Game** as needed. Click a key, or focus it and press Enter or Space, to open its editor.
4. Enter commands one per line in the editor dialog. To add a combination, choose another key, enter its action, and select **Add combination**. Existing combination actions can be edited or removed. Duplicate labels are distinguished in the picker, such as Left Ctrl and Right Ctrl. Select **Close editor**, or press Escape, to return focus to the key. Closing the editor keeps changes in the draft; **Cancel** discards the whole draft.
5. Select **Save preset** to store a custom draft, or **Cancel** to discard it and return to the original layout. When editing a bundled layout, choose **Save as custom** to keep your changes across reloads, or **Save for this session** for temporary changes. Layout switching is disabled while editing, and editing and cancellation are disabled while a save is in progress.

Spaces and line breaks are preserved while typing commands. Saving trims each command, removes empty lines, and treats an empty command list as unassigned. Combination targets must exist, must be real keys, and cannot target the same key or repeat within that key. Invalid combinations in existing custom presets are shown with an explanation; the preset is preserved and can be edited to remove or correct them before saving.

### Finding commands

Use **Search commands or keys** to search the current layout's key labels, commands, and combination actions. Search ignores case and extra spaces. A matching combination highlights both participating keys. **Next match** cycles through the matching keys and scrolls them into view; **Clear search** removes the highlights. Blue markers indicate assigned commands and purple markers indicate combinations, including when search is empty.

### Backups and preset management

In view mode, **Export preset** downloads the active layout as JSON, including its name, game, commands, combinations, key sizes, and spacers. Use **Import presets** in another browser to restore it. Each import creates a new custom copy with a fresh ID and keeps the original name and game; existing presets and bundled layouts are never overwritten. Imports are validated before saving, and a batch is saved in a single transaction so a failed import does not leave partial copies.

The importer accepts an exported version 1 backup (`format: "rts-keymap-viewer"`, `version: 1`, `presets: [...]`), a single `KeyboardPreset`, or an array of presets. Files must be no larger than 2 MB and contain 1–100 presets. Each preset must have 1–30 nonempty rows, at most 500 key entries, and valid combination references; optional width and height must be positive multipliers no greater than 30.

**Delete preset** is available for custom layouts only. Confirm the named layout in the dialog to delete it from this browser, or select **Cancel** or press Escape to keep it. Export a layout before deleting it if you want a backup.

### Saved presets

Presets are stored in the browser's IndexedDB database `rts-keymap-viewer`, in the `presets` object store. Saved custom presets survive reloads in the same browser profile and origin; different hosts or ports have separate storage. Clearing the site's browser storage removes custom presets.

**Bundled presets are refreshed from source every time the app loads.** Edits saved directly to a bundled preset apply for the current session and reset on reload. The app explains this beside the preset controls. Use **New preset** or **Save as custom** to keep a customized version across reloads. **Save as custom** saves the edited draft with a new custom ID and adds “(Custom)” to its name.

The status message below the controls reports database loading, editing, saving, and errors. IndexedDB must be available for layouts to load and save.

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
| `npm test` | Run Node regression tests for validation, search, draft isolation, and preset import/export. |
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

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Preset selection, draft state, import/export, saving/deletion, and component coordination. |
| `src/components/PresetControls.tsx` | Preset selection, edit controls, and backup/management actions. |
| `src/components/Keyboard.tsx` | Keyboard buttons, assignment markers, combination/search highlighting, and tooltip lifecycle. |
| `src/components/CommandSearch.tsx` | Search input, result count, and navigation controls. |
| `src/components/KeyEditor.tsx` | Command and combination editing in a dialog. |
| `src/components/KeyTooltip.tsx` | Portal tooltips positioned within the viewport and linked to keys. |
| `src/components/Dialog.tsx` | Native modal dialog lifecycle, Tab containment, dismissal, and focus restoration. |
| `src/App.css` | App layout, keyboard, editors, tooltips, and responsive styles. |
| `src/index.css` | Global styles and theme variables. |
| `src/main.tsx` | React entry point with StrictMode. |
| `src/data/defaultPresets.ts` | Bundled keyboard layouts and commands. |
| `src/data/presets.ts` | Preset types, IndexedDB storage, seeding, and migration helpers. |
| `src/data/presetValidation.ts` | Combination validation before saving and explanations for invalid saved combinations. |
| `src/data/presetEditing.ts` | Deep cloning, draft updates, custom IDs, and command normalization. |
| `src/data/keyboard.ts` | Key IDs, disambiguated labels, related keys, and search matching. |
| `src/data/presetTransfer.ts` | Backup serialization and validation of imported JSON. |
| `tests/*.test.ts` | Node regression checks for data and draft behavior. |
| `tests/browser/app.spec.ts` | Browser checks for interactions, backups, persistence, error handling, and accessibility. |
| `playwright.config.ts` | Desktop/mobile Chromium projects and the test preview server. |
| `public/` | Static assets copied into the build. |
| `vite.config.ts` | React plugin and deployment base path. |
| `.github/workflows/deploy.yml` | Build and deployment to GitHub Pages. |

To add a bundled layout, add a `KeyboardPreset` to `defaultPresets`. Keys are arranged in rows; combination targets use zero-based `rowIndex-keyIndex` positions, including spacer entries. Keep those references in sync when changing a layout. See [AGENTS.md](AGENTS.md) for contributor guidance.

## Deployment

The GitHub Actions workflow runs lint, Node tests, the production build, and desktop/mobile Chromium browser tests with Node.js 22. Pull requests run the checks without deploying. Pushes to `main` and manual workflow runs deploy `dist/` to GitHub Pages after all checks pass. Configure the repository's GitHub Pages source as **GitHub Actions**.

Vite currently uses `/RTS-Keymap-Viewer/` as its base path. Update `base` in `vite.config.ts` if deploying under a different path. The app runs entirely in the browser and requires only static hosting.
