# Changelog

All notable changes to this project are documented here.

## [Unreleased]

- Changelog section is maintained for every behavior/config change.

### Added

- Changelog workflow is now tracked for each change.

### Changed

- No unreleased changes listed.

### Fixed

- No unreleased changes listed.

### Checklist (before snapshot)

- [ ] Add a concise bullet under Unreleased (`Added` / `Changed` / `Fixed`) for every behavioral or config update.
- [ ] Keep each bullet actionable and short enough to stay understandable without opening the PR diff.
- [ ] Run relevant checks/tests when behavior/code is changed.
- [ ] On release snapshot, move Unreleased items into a dated section and record commit hashes under `Commits`.

## [2026-08-15]

### Added

- Added Ubuntu helper installer: `install-flux2-ubuntu.sh`.

### Changed

- Tuned isometric pipeline environment defaults and documentation in `.env` and `.env.example`:
  - master back-reference/retry policy,
  - master ear QA switches,
  - walk passing motion QA thresholds,
  - motion retry controls.

- Updated walk and master prompt/constants in isometric pipeline configuration to support stricter anatomy/ear constraints.

- Improved isometric motion/pixel source unit tests (`sprite-pipeline-isometric.test.mjs`) for current function signatures and cache/retry behavior.

### Commits

- `ee80f25` — `Tune isometric env defaults and update motion tests`
- `335a294` — `Add Ubuntu install helper script`
