import app from "./app";
import { logger } from "./lib/logger";
import { db, triggersTable } from "@workspace/db";
import { eq, lt, and } from "drizzle-orm";

const STUCK_TRIGGER_THRESHOLD_MS = 15 * 60 * 1000;
const PERIODIC_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

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
});
