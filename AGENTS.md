# Agent Instructions

## Package Manager
- Use **npm**: `npm install`
- Root lock file: `package-lock.json`

## Key Conventions
- Node project with CommonJS (`package.json` has `"type": "commonjs"`).
- No project-wide lint/format/typecheck scripts are defined in `package.json`.
- `npm test` is a placeholder (`Error: no test specified`).
- Prefer `README.MD` for full pipeline behavior, generation rules, and output layout.
- Avoid editing `node_modules` manually.

## File-Scoped Commands
| Task | Command |
|------|---------|
| Standard pipeline mode | `node sprite-pipeline.mjs <masters|animate|pixelize|sheet|all> [--force]` |
| Isometric pipeline mode | `node sprite-pipeline-isometric.mjs <masters|animate|clean|pixelize|sheet|all> [--force]` |
| Tests (file-scoped) | `node --test sprite-pipeline-isometric.test.mjs` |

## Commit Attribution
AI commits MUST include:
```text
Co-Authored-By: GPT-5.3-codex-spark <noreply@opencode.ai>
```
