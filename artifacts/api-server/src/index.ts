import app from "./app";
import { logger } from "./lib/logger";
import { db, triggersTable } from "@workspace/db";
import { eq, lt, and } from "drizzle-orm";

const STUCK_TRIGGER_THRESHOLD_MS = 15 * 60 * 1000;
const PERIODIC_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const SELF_PING_INTERVAL_MS = 4 * 60 * 1000; // < Render's ~15 min idle window

/**
 * Keep the free-tier instance warm: ping our own public URL every few minutes.
 * Render's spin-down timer resets on inbound traffic, so this prevents the slow
 * cold start that drops the first Telegram message. Hitting a DB-backed route
 * also keeps Neon awake. No-op when no public URL is known (local/dev).
 */
function startSelfPing(): void {
  const base = process.env.RENDER_EXTERNAL_URL || process.env.APP_BASE_URL;
  if (!base || process.env.NODE_ENV === "test") return;
  const url = `${base.replace(/\/$/, "")}/api/stats/summary`;
  setInterval(() => {
    fetch(url).catch(() => {});
  }, SELF_PING_INTERVAL_MS).unref();
  logger.info({ url }, "[keep-warm] self-ping enabled");
}

/**
 * Resets ALL triggers stuck in "running" state.
 * Called at startup — any trigger still running when the process starts is
 * definitively stuck (the previous process crashed before it could clean up).
 */
async function recoverStuckTriggersAtStartup(): Promise<void> {
  try {
    const recovered = await db
      .update(triggersTable)
      .set({ status: "idle" })
      .where(eq(triggersTable.status, "running"))
      .returning({ id: triggersTable.id });
    if (recovered.length > 0) {
      logger.warn(
        { count: recovered.length, ids: recovered.map((r) => r.id) },
        "[startup] recovered triggers stuck in running state from previous crash",
      );
    }
  } catch (err) {
    logger.error({ err }, "[startup] failed to recover stuck triggers");
  }
}

/**
 * Periodic sweep: resets triggers that have been in "running" for longer than
 * STUCK_TRIGGER_THRESHOLD_MS. Catches any edge case where a trigger gets stuck
 * without a full process crash (e.g. silent hang inside a run).
 */
async function sweepStuckTriggers(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STUCK_TRIGGER_THRESHOLD_MS);
    const recovered = await db
      .update(triggersTable)
      .set({ status: "idle" })
      .where(
        and(
          eq(triggersTable.status, "running"),
          lt(triggersTable.lastFiredAt, cutoff),
        ),
      )
      .returning({ id: triggersTable.id });
    if (recovered.length > 0) {
      logger.warn(
        { count: recovered.length, ids: recovered.map((r) => r.id) },
        "[sweep] recovered triggers stuck in running state",
      );
    }
  } catch (err) {
    logger.error({ err }, "[sweep] failed to sweep stuck triggers");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  recoverStuckTriggersAtStartup();
  setInterval(sweepStuckTriggers, PERIODIC_SWEEP_INTERVAL_MS).unref();
  startSelfPing();
});
