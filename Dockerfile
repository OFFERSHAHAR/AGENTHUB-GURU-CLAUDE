# ============================================================================
# Dockerfile — פריסת ההאב (agent-hub + api-server) על Railway/Render/כל PaaS
# ----------------------------------------------------------------------------
# ארכיטקטורה: קונטיינר אחד. Caddy מגיש את ה-frontend הסטטי ומעביר /api ל-api-server
# (node) שרץ פנימית על פורט 5000. Caddy מאזין על $PORT שהפלטפורמה מזריקה.
# הסיבה: ה-frontend קורא ל-API ב-origin יחסי (/api), אז צריך אותו דומיין.
# ============================================================================

# ---------- שלב בנייה ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# pnpm דרך corepack (workspace משתמש ב-catalog: + minimumReleaseAge → pnpm 10)
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

# התקנת תלויות (lockfile קיים). אם הפריסה נכשלת על drift — החלף ל---no-frozen-lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig*.json ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts
COPY attached_assets ./attached_assets
RUN pnpm install --frozen-lockfile

# build דורש משתני סביבה אלו (vite.config / index קוראים אותם)
ENV NODE_ENV=production
ENV BASE_PATH=/
ENV PORT=5000

# בניית ה-backend (esbuild -> artifacts/api-server/dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build
# בניית ה-frontend (vite -> artifacts/agent-hub/dist/public)
RUN pnpm --filter @workspace/agent-hub run build

# ---------- שלב ריצה ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=5000

# Caddy (reverse proxy + static) — מהאימג' הרשמי
COPY --from=caddy:2.8 /usr/bin/caddy /usr/bin/caddy

# הקוד הבנוי + node_modules (ל-api-server externals/native)
COPY --from=build /app /app
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Caddy יאזין על $PORT (מהפלטפורמה); ה-node פנימי על API_PORT
CMD ["/app/start.sh"]
