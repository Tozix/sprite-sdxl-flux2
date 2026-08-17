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

## MCP & Tools (mandatory)
- **Codebase memory (MCP):** use graph tools first for code discovery — `search_graph` to find symbols, `trace_path` for callers/callees, `get_code_snippet` for source, `query_graph` for complex patterns, `get_architecture` for orientation. Fall back to `grep`/`glob` only for string literals, config values, or non-code files. Call `list_projects` before first use; index the repo only if not already indexed.
- **Vision tool:** the main model may not be able to analyze images. When a task requires inspecting an image (sprite output, generated masters, screenshots, QA checks), use the `vision_describe_image` tool instead of trying to read the image directly. This is mandatory for any visual QA / sprite review.
- **Context7 (MCP):** use for up-to-date library/framework docs (e.g. sharp, @imgly/background-removal-node, Bun) instead of relying on training data.

## Environment
- Runtime config is loaded from `.env` (see `src/env.ts`, custom loader — no dotenv). `.env.example` documents all `IRON_ARCANA_*` knobs. Pipeline behavior, generation rules, and output layout live in `README.MD` (not the repo README).
- The pipeline talks to a local AI inference server (see README §2–§9); it will fail if the server is not running.
