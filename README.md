# RTS Keymap Viewer

A browser-based keyboard reference for real-time strategy games, built with React 19, TypeScript 6, and Vite 8. View commands on a visual keyboard and create custom reference layouts.

## Current features

- One bundled preset: **Age of Empires IV Default**, including function keys, arrow keys, and keys with different widths and heights.
- Command tooltips on key hover or keyboard focus.
- Highlighting of related keys in two-key combinations.
- Custom presets cloned from the active layout, with editable names, game labels, commands, and combinations.
- Browser-local persistence through IndexedDB.
- Browser-only keyboard identification through WebHID for supported Keychron models, rebuilding the board with their actual key positions, spacing, and sizes.
- Manual model selection, generic compact (60%), tenkeyless, and full-size ANSI shapes; US QWERTY, French AZERTY, and German QWERTZ labels; and automatic character-label detection in supported browsers.
- Physical-key selection in edit mode, including separate left/right modifiers, with an editor outside the horizontally scrolling board.
- A dark interface with responsive controls and a horizontally scrollable keyboard on smaller screens.

Editing a preset changes the reference board. Configure the actual game bindings separately in the game.

## Using the viewer

1. Choose a layout from **Active layout**. Hover over a key or focus it with Tab to see its commands and combinations.
2. Select **New preset** to copy the active layout, or **Edit preset** to edit it directly.
3. Change the preset's **Name** and **Game** as needed. Click a key, or focus it and press Enter or Space, to open its editor above the board. **Close editor** or Escape returns focus to that key.
4. Enter commands one per line. To add a combination, choose another key, enter its action, and select **Add combination**. Existing combination actions can be edited or removed. Duplicate labels are distinguished in the picker, such as Left Ctrl and Right Ctrl.
5. Select **Save preset** to store the draft, or **Cancel** to discard it. Layout switching is disabled while editing.

### Keyboard layout prototype

Select **Connect keyboard** under **Your keyboard**, then choose your keyboard in the browser's device picker. This uses WebHID in desktop Chrome/Edge over HTTPS or localhost. The picker requests the QMK/VIA vendor interface; ordinary keyboard reports are protected by the browser, so many keyboards will not appear. Identification reads the selected device's USB vendor/product IDs and matches them to a local profile. It does not open the device or send firmware commands.

A recognized model replaces the board's entire geometry, including gaps, Fn keys, and extra keys. Connecting from view mode creates a custom draft copied from the active preset; connecting during editing updates that draft. Edit the commands and select **Save preset**, or **Cancel** to restore the previous board. An unknown device, a cancelled picker, or denied access leaves the current board unchanged.

The prototype includes these exact **ANSI, non-knob** models:

| Model | USB vendor:product | Physical profile source |
| --- | --- | --- |
| Keychron V4 · 61 keys | `3434:0340` | [QMK V4 ANSI](https://github.com/qmk/qmk_firmware/blob/master/keyboards/keychron/v4/ansi/keyboard.json) |
| Keychron V3 · 87 keys | `3434:0330` | [QMK V3 ANSI](https://github.com/qmk/qmk_firmware/blob/master/keyboards/keychron/v3/ansi/keyboard.json) |
| Keychron V6 · 108 keys | `3434:0360` | [QMK V6 ANSI](https://github.com/qmk/qmk_firmware/blob/master/keyboards/keychron/v6/ansi/keyboard.json) |

Profiles use QMK's physical coordinates and factory Windows base key positions, from the corresponding `keymaps/default/keymap.c` definitions. The default [QMK Raw HID usage page and usage](https://docs.qmk.fm/features/rawhid) determine the device-picker filter. ISO, JIS, knob, Max, split, and other models need separate verified profiles. Firmware remappings, Mac mode, and custom keycap artwork are not detected. Fn and firmware-only buttons can be edited by clicking even when they do not produce browser key events.

If your keyboard is missing or WebHID is unavailable, use **Supported keyboard model** to try a profile manually. This works in any browser and is explicitly reported as manual selection. Alternatively, select **New preset**, then choose a **Generic keyboard shape**. The original board remains available as **All saved keys**. This browser-only prototype cannot determine arbitrary hardware geometry without a matching profile.

**Detect my labels** separately uses the browser's Keyboard Map API where available (Chrome/Edge over HTTPS or localhost). If detection is unavailable, blocked, or returns no labels, choose a manual character layout. The model, shape, and labels are saved with the custom preset, so the board can be viewed later without WebHID, device access, or the Keyboard Map API. Connection and label detection are explicit actions and can be repeated when the keyboard or system layout changes.

Changing character labels keeps commands on the same physical key positions. It does not translate a game's character-based bindings automatically. Choosing a smaller shape hides keys without deleting their commands or combinations; choose **All saved keys** to edit them. Additional keys needed for a larger template start unassigned.

In edit mode, select **Press a key to edit**, then press one physical key. The app uses its position (`KeyboardEvent.code`) to select the corresponding displayed key. Escape cancels capture, Tab continues navigation, and typing in the command form works normally outside capture mode. Keys outside the selected shape and browser/system shortcuts may need to be selected by clicking. This selects a key to annotate; it does not record or apply game bindings.

Model, shape, manual/detected labels, commands, and combinations are part of the draft. **Save preset** persists them together; **Cancel** discards them. Bundled presets still reset on reload, so use a custom preset to keep changes.

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
| `src/data/keyboardLayouts.ts` | Physical templates, character labels, browser detection, and mapping displayed keys to saved positions. |
| `src/data/keyboardProfiles.ts` | Verified hardware identities and physical model geometry. |
| `src/data/keyboardDevice.ts` | WebHID chooser and exact model identification. |
| `src/components/KeyboardSetup.tsx` | Device identification, model/shape selection, label detection, and physical-key selection controls. |
| `src/components/KeyEditor.tsx` | Accessible command and combination editor above the board. |
| `public/` | Static assets copied into the build. |
| `vite.config.ts` | React plugin and deployment base path. |
| `.github/workflows/deploy.yml` | Build and deployment to GitHub Pages. |

To add a bundled layout, add a `KeyboardPreset` to `defaultPresets`. Keys are arranged in rows; combination targets use zero-based `rowIndex-keyIndex` positions, including spacer entries. Keep those references in sync when changing a layout. The optional `Keybind.code` identifies the physical browser key (or a profile-specific Fn/firmware-only key), and optional `KeyboardPreset.keyboard` stores a model profile ID, generic shape, label mode, and detected-label snapshot. Legacy presets without those fields retain their original board; known original labels are matched to codes in memory. Model and shape changes project saved keys into physical templates and append any missing keys without reordering existing rows, keeping combination references valid. To add hardware support, add a verified vendor/product identity and its complete geometry to `keyboardProfiles.ts`; avoid inferring a shape from a product name. See [AGENTS.md](AGENTS.md) for contributor guidance.

## Deployment

The GitHub Actions workflow builds with Node.js 22 and deploys `dist/` to GitHub Pages on pushes to `main` or manual workflow runs. Configure the repository's GitHub Pages source as **GitHub Actions**.

Vite currently uses `/RTS-Keymap-Viewer/` as its base path. Update `base` in `vite.config.ts` if deploying under a different path. The app runs entirely in the browser and requires only static hosting.
