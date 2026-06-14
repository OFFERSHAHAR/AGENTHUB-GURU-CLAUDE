#!/bin/sh
# מפעיל את ה-api-server (node) פנימית, ואז את Caddy בקדמת התהליך.
set -e

: "${API_PORT:=5000}"
: "${PORT:=8080}"
export PORT_EXTERNAL="$PORT"

# ה-api-server קורא את PORT שלו עצמו → מריצים אותו עם PORT=API_PORT
echo "[start] api-server על פורט פנימי $API_PORT"
( cd /app/artifacts/api-server && PORT="$API_PORT" node --enable-source-maps ./dist/index.mjs ) &
API_PID=$!

# המתנה קצרה שה-api יעלה
sleep 2
if ! kill -0 "$API_PID" 2>/dev/null; then
	echo "[start] api-server נכשל בעליה" >&2
	wait "$API_PID"
	exit 1
fi

echo "[start] Caddy מאזין על $PORT_EXTERNAL (proxy /api -> $API_PORT)"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
