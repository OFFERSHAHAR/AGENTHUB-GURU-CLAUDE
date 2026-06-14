---
name: Non-root artifact dev server
description: Vite dev server can't pass the workflow health check for artifacts mounted at non-root paths; static file server is the workaround
---

# Non-root artifact dev server

## The rule
For artifacts whose `previewPath` is not `/` (e.g. `/study-listener/`), do not use the Vite dev server as the workflow dev command. Use a minimal Node.js static file server (`serve.mjs`) instead.

**Why:** Replit's proxy only routes `/study-listener/` requests to the service once the workflow is "running", but the workflow health check goes *through* the proxy — creating a circular dependency. The health check never resolves, so the workflow stays in DIDNT_OPEN_A_PORT or FAILED state forever, even though Vite binds the port correctly. Root-path artifacts (`/`) don't have this issue because the proxy always routes root requests.

**How to apply:**
1. Build the app first: `pnpm run build` from the artifact directory.
2. Create `serve.mjs` in the artifact root — a plain Node.js `http.createServer` that serves `dist/public` with an SPA fallback and a `/` health check returning 200.
3. Set `[services.development] run = "node serve.mjs"` in `artifact.toml`.
4. When code changes, rebuild manually: `pnpm --filter @workspace/<name> run build`.

**Extra gotcha:** The workflow runner CWD is the artifact's directory, not the workspace root. So `node_modules/.bin/vite` resolves correctly relative to the artifact dir. Also, `.bin/vite` is a bash shim — use `node node_modules/vite/bin/vite.js` if you need to invoke Vite as a Node.js process directly (though the static server approach is preferred).
