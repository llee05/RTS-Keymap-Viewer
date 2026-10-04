# AGENTS.md

## Project overview

This repository contains a React and TypeScript keyboard-layout viewer built with Vite. Application code lives in `src/`, static assets live in `public/`, and keyboard preset data is managed in `src/data/`.

## Working guidelines

- Keep changes focused on the requested behavior and preserve unrelated work in the working tree.
- Prefer small, reusable React components and typed data structures over duplicated markup or untyped values.
- Keep UI behavior accessible to both pointer and keyboard users.
- Match the existing visual language and responsive behavior when changing styles.
- Do not add dependencies unless they provide a clear benefit that cannot be achieved cleanly with the existing stack.
- Use `rg` or `rg --files` for repository searches.

## Validation

Run the checks relevant to the change before handing it off:

```bash
npm run lint
npx tsc -b
npm run build
```

Use a Node.js version supported by the installed Vite release. If a full build cannot run because of the local runtime, report that clearly and still run the independent TypeScript and lint checks.

## Git workflow

- Review `git status` and the intended diff before committing.
- Do not alter, discard, or include unrelated user changes.
- Write concise, imperative commit subjects that describe the user-facing or technical outcome.
- Never attribute a commit to AI or mention AI assistance in its message.
- Split each task into appropriately scoped, cohesive commits.
