# Agent Instructions

## Package Manager
- Use **npm**: `npm install`
- Root lock file: `package-lock.json`

## Key Conventions
- Node project with ESM (`package.json` has `"type": "module"`).
- Source is TypeScript under `src/`, executed directly by Bun via `bun run src/cli.ts`.
- No project-wide lint/format/typecheck scripts are defined in `package.json`.
- `npm test` still acts as a placeholder — prefer `bun test src/test/` for the real pipeline scenarios.
- Prefer `README.MD` for full pipeline behavior, generation rules, and output layout.
- Avoid editing `node_modules` manually.

## File-Scoped Commands
| Task | Command |
|------|---------|
| Run any pipeline mode | `bun run src/cli.ts <sprite|isometric> <template> <mode> [--force]` |
| Both pipelines share the same CLI; choose the pipeline by the first argument. |
| Run unit tests | `bun test src/test/` |

## Commit Attribution
- Author all commits as the user only.
- Do not include any `Co-Authored-By` footer in commits.
