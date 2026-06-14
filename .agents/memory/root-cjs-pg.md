---
name: Running root .cjs DB seed scripts
description: How to run standalone scripts/*.cjs that require("pg") in this pnpm monorepo
---
Standalone scripts in `scripts/` that `require("pg")` (e.g. seed-opensource-agents.cjs,
seed-support-pipeline.cjs) fail with MODULE_NOT_FOUND because `pg` is only a dependency
of `lib/db`, not hoisted to the workspace root and `scripts/` has no pg dep.

Run them with NODE_PATH pointing at the pnpm-stored pg:
  NODE_PATH=node_modules/.pnpm/pg@8.20.0/node_modules node scripts/<name>.cjs

**Why:** pnpm uses isolated node_modules; transitive deps live under .pnpm and aren't
visible to scripts outside the package that declares them.
**How to apply:** any one-off DB seed/maintenance .cjs run from repo root. Alternatively
use the code_execution `executeSql` sandbox for ad-hoc DB writes.
