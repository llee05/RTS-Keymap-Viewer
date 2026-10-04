# RTS Keymap Viewer

A browser-based keyboard reference for real-time strategy games, built with React 19, TypeScript 6, and Vite 8. View commands on a visual keyboard and create custom reference layouts.

## Current features

- One bundled preset: **Age of Empires IV Default**, including function keys, arrow keys, and keys with different widths and heights.
- Command tooltips on key hover or keyboard focus.
- Highlighting of related keys in two-key combinations.
- Custom presets cloned from the active layout, with editable names, game labels, commands, and combinations.
- Browser-local persistence through IndexedDB.
- A dark interface with responsive controls and a horizontally scrollable keyboard on smaller screens.

Editing a preset changes the reference board. Configure the actual game bindings separately in the game.

## Using the viewer

1. Choose a layout from **Active layout**. Hover over a key or focus it with Tab to see its commands and combinations.
2. Select **New preset** to copy the active layout, or **Edit preset** to edit it directly.
3. Change the preset's **Name** and **Game** as needed. Click a key, or focus it and press Enter or Space, to open its editor.
4. Enter commands one per line. To add a combination, choose another key, enter its action, and select **Add combination**. Existing combination actions can be edited or removed. Duplicate labels are distinguished in the picker, such as Left Ctrl and Right Ctrl.
5. Select **Save preset** to store the draft, or **Cancel** to discard it. Layout switching is disabled while editing.

### Saved presets

Presets are stored in the browser's IndexedDB database `rts-keymap-viewer`, in the `presets` object store. Saved custom presets survive reloads in the same browser profile and origin; different hosts or ports have separate storage. Clearing the site's browser storage removes custom presets.

**Bundled presets are refreshed from source every time the app loads.** Edits saved directly to a bundled preset apply for the current session and reset on reload. Use **New preset** to keep a customized version across reloads.

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
| `npx tsc -b` | Check the application and Vite configuration types. |
| `npm run build` | Run TypeScript checks and build static assets into `dist/`. |
| `npm run preview` | Serve the production build locally after building. |

Before handing off changes, run:

```bash
npm run lint
npx tsc -b
npm run build
```

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Preset selection, draft editing, key rendering, combination highlighting, and tooltips. |
| `src/App.css` | App layout, keyboard, editors, tooltips, and responsive styles. |
| `src/index.css` | Global styles and theme variables. |
| `src/main.tsx` | React entry point with StrictMode. |
| `src/data/defaultPresets.ts` | Bundled keyboard layouts and commands. |
| `src/data/presets.ts` | Preset types, IndexedDB storage, seeding, and migration helpers. |
| `public/` | Static assets copied into the build. |
| `vite.config.ts` | React plugin and deployment base path. |
| `.github/workflows/deploy.yml` | Build and deployment to GitHub Pages. |

To add a bundled layout, add a `KeyboardPreset` to `defaultPresets`. Keys are arranged in rows; combination targets use zero-based `rowIndex-keyIndex` positions, including spacer entries. Keep those references in sync when changing a layout. See [AGENTS.md](AGENTS.md) for contributor guidance.

## Deployment

The GitHub Actions workflow builds with Node.js 22 and deploys `dist/` to GitHub Pages on pushes to `main` or manual workflow runs. Configure the repository's GitHub Pages source as **GitHub Actions**.

Vite currently uses `/RTS-Keymap-Viewer/` as its base path. Update `base` in `vite.config.ts` if deploying under a different path. The app runs entirely in the browser and requires only static hosting.
