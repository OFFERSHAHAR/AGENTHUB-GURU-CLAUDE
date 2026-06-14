/**
 * Simple Node.js static file server for study-listener.
 * Serves built files from dist/public with SPA fallback.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 8099;
const BASE_PATH = process.env.BASE_PATH || "/study-listener/";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "dist/public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

const server = createServer((req, res) => {
  let url = req.url || "/";

  // Strip query string
  const qIdx = url.indexOf("?");
  if (qIdx !== -1) url = url.slice(0, qIdx);

  // Health check / root redirect
  if (url === "/" || url === "") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<html><head><meta http-equiv="refresh" content="0;url=${BASE_PATH}"/></head><body>Redirecting...</body></html>`
    );
    return;
  }

  // Strip base path prefix
  let filePath = url;
  if (filePath.startsWith(BASE_PATH)) {
    filePath = filePath.slice(BASE_PATH.length);
  } else if (filePath.startsWith(BASE_PATH.slice(0, -1))) {
    filePath = filePath.slice(BASE_PATH.length - 1);
  }

  // Decode URI
  try {
    filePath = decodeURIComponent(filePath);
  } catch (_) {
    // ignore
  }

  const fullPath = join(distDir, filePath || "index.html");

  // Check if it's a real file
  let serveFile = fullPath;
  if (!existsSync(fullPath) || (existsSync(fullPath) && statSync(fullPath).isDirectory())) {
    // SPA fallback — serve index.html
    serveFile = join(distDir, "index.html");
  }

  if (!existsSync(serveFile)) {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("App not built yet. Please run: pnpm --filter @workspace/study-listener run build");
    return;
  }

  const ext = extname(serveFile);
  const mime = MIME[ext] || "application/octet-stream";

  const headers = {
    "Content-Type": mime,
    "Permissions-Policy": "microphone=*, display-capture=*",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  // Cache static assets aggressively, HTML never
  if (ext !== ".html") {
    headers["Cache-Control"] = "public, max-age=31536000, immutable";
  } else {
    headers["Cache-Control"] = "no-cache";
  }

  res.writeHead(200, headers);
  createReadStream(serveFile).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nStudy Listener serving at http://localhost:${PORT}${BASE_PATH}`);
  console.log(`Serving from: ${distDir}\n`);
});
