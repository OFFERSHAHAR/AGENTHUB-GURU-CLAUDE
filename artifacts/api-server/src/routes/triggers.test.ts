import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import express from "express";
import {
  db,
  clientsTable,
  agentsTable,
  assignmentsTable,
  triggersTable,
  triggerEventsTable,
  settingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import triggersRouter from "./triggers.js";
import { publishTriggerEvent } from "../lib/trigger-events-bus.js";

// ── Minimal app: mount ONLY the triggers router so we exercise the real SSE
// route + webhook handler without booting the whole server (schedulers, etc).
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", triggersRouter);
  return app;
}

interface SseFrame {
  id?: number;
  event?: string;
  data?: any;
}

// Reads Server-Sent Events from a fetch Response body and resolves once
// `count` real `event:` frames (comments/heartbeats ignored) have arrived,
// or rejects on timeout. The AbortController lets us "drop" the connection.
async function readFrames(
  res: Response,
  count: number,
  timeoutMs = 4000,
): Promise<SseFrame[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const frames: SseFrame[] = [];
  let buffer = "";

  const deadline = Date.now() + timeoutMs;
  while (frames.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${count} SSE frames, got ${frames.length}`);
    }
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (!raw.trim() || raw.startsWith(":")) continue; // heartbeat/comment
      const frame: SseFrame = {};
      for (const line of raw.split("\n")) {
        if (line.startsWith("id:")) frame.id = parseInt(line.slice(3).trim(), 10);
        else if (line.startsWith("event:")) frame.event = line.slice(6).trim();
        else if (line.startsWith("data:")) frame.data = JSON.parse(line.slice(5).trim());
      }
      frames.push(frame);
    }
  }
  return frames;
}

let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(buildApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("GET /clients/:id/trigger/stream — live SSE", () => {
  it("delivers each live fire with a strictly increasing id: frame", async () => {
    const clientId = 920101;
    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/api/clients/${clientId}/trigger/stream`, {
      headers: { Accept: "text/event-stream" },
      signal: ctrl.signal,
    });
    assert.equal(res.status, 200);

    // The route subscribes to the bus synchronously while handling the request,
    // so any fire published after the response headers arrive is captured.
    const framesPromise = readFrames(res, 3);
    for (let i = 0; i < 3; i++) {
      publishTriggerEvent({
        clientId,
        assignmentId: 1,
        triggerId: 7,
        agentStatus: "triggered",
        firedAt: new Date().toISOString(),
      });
    }

    const frames = await framesPromise;
    ctrl.abort();

    assert.equal(frames.length, 3);
    for (const f of frames) {
      assert.equal(f.event, "trigger");
      assert.equal(typeof f.id, "number");
      assert.equal(f.data.clientId, clientId);
    }
    for (let i = 1; i < frames.length; i++) {
      assert.ok(
        frames[i].id! > frames[i - 1].id!,
        `live frame ids must strictly increase: ${frames[i - 1].id} -> ${frames[i].id}`,
      );
    }
  });

  it("only delivers events for the requested client", async () => {
    const clientId = 920102;
    const otherClientId = 920103;
    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/api/clients/${clientId}/trigger/stream`, {
      headers: { Accept: "text/event-stream" },
      signal: ctrl.signal,
    });

    const framesPromise = readFrames(res, 1);
    // An event for a different client must be filtered out...
    publishTriggerEvent({ clientId: otherClientId, assignmentId: 1, triggerId: 1, agentStatus: "triggered", firedAt: new Date().toISOString() });
    // ...only this one should reach the stream.
    publishTriggerEvent({ clientId, assignmentId: 1, triggerId: 9, agentStatus: "triggered", firedAt: new Date().toISOString() });

    const frames = await framesPromise;
    ctrl.abort();

    assert.equal(frames.length, 1);
    assert.equal(frames[0].data.clientId, clientId);
    assert.equal(frames[0].data.triggerId, 9);
  });
});

describe("GET /clients/:id/trigger/stream — Last-Event-ID replay after a drop", () => {
  it("replays a webhook fire missed while disconnected, with matching id: frames", async () => {
    // Seed a real client → agent → assignment → trigger so we can fire the
    // actual inbound webhook endpoint (not just the bus directly).
    const [client] = await db
      .insert(clientsTable)
      .values({ name: `__test-${randomUUID()}`, industry: "test", contactEmail: "t@test.dev" })
      .returning();
    const [agent] = await db
      .insert(agentsTable)
      .values({ name: `__test-agent-${randomUUID()}`, description: "t", category: "test" })
      .returning();
    const [assignment] = await db
      .insert(assignmentsTable)
      .values({ clientId: client.id, agentId: agent.id })
      .returning();
    const secret = randomUUID();
    const [trigger] = await db
      .insert(triggersTable)
      .values({ assignmentId: assignment.id, webhookSecret: secret, status: "idle" })
      .returning();

    try {
      // Simulate the dashboard being OFFLINE: fire the webhook while no stream
      // is connected. The fire is buffered in the per-client ring buffer.
      const fireRes = await fetch(`${baseUrl}/api/webhooks/trigger/${secret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "missed-while-offline" }),
      });
      assert.equal(fireRes.status, 200);

      // Give the synchronous "triggered" publish a moment to land in the ring.
      await new Promise((r) => setTimeout(r, 250));

      // Reconnect with Last-Event-ID: 0 — EventSource does this automatically
      // after a drop. The route must replay everything the client missed.
      const ctrl = new AbortController();
      const res = await fetch(`${baseUrl}/api/clients/${client.id}/trigger/stream`, {
        headers: { Accept: "text/event-stream", "Last-Event-ID": "0" },
        signal: ctrl.signal,
      });
      assert.equal(res.status, 200);

      const frames = await readFrames(res, 1);
      ctrl.abort();

      // The missed "triggered" fire is replayed for this trigger.
      const triggered = frames.find(
        (f) => f.data?.agentStatus === "triggered" && f.data?.triggerId === trigger.id,
      );
      assert.ok(triggered, "missed 'triggered' fire should be replayed");
      assert.equal(triggered!.event, "trigger");
      assert.equal(typeof triggered!.id, "number");
      assert.equal(triggered!.data.clientId, client.id);

      // Every replayed frame carries an ascending id (matching the buffer order).
      const replayedIds = frames.filter((f) => typeof f.id === "number").map((f) => f.id!);
      for (let i = 1; i < replayedIds.length; i++) {
        assert.ok(replayedIds[i] > replayedIds[i - 1], "replayed ids must be ascending");
      }
    } finally {
      // Best-effort cleanup of all seeded rows.
      await db.delete(triggerEventsTable).where(eq(triggerEventsTable.triggerId, trigger.id)).catch(() => {});
      await db.delete(triggersTable).where(eq(triggersTable.id, trigger.id)).catch(() => {});
      await db.delete(assignmentsTable).where(eq(assignmentsTable.id, assignment.id)).catch(() => {});
      await db.delete(agentsTable).where(eq(agentsTable.id, agent.id)).catch(() => {});
      await db.delete(clientsTable).where(eq(clientsTable.id, client.id)).catch(() => {});
    }
  });

  it("replay is scoped to the requesting client", async () => {
    const clientId = 920201;
    const otherClientId = 920202;
    // Buffer events for two clients with no stream connected.
    publishTriggerEvent({ clientId: otherClientId, assignmentId: 1, triggerId: 1, agentStatus: "triggered", firedAt: new Date().toISOString() });
    publishTriggerEvent({ clientId, assignmentId: 2, triggerId: 42, agentStatus: "triggered", firedAt: new Date().toISOString() });

    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/api/clients/${clientId}/trigger/stream`, {
      headers: { Accept: "text/event-stream", "Last-Event-ID": "0" },
      signal: ctrl.signal,
    });
    const frames = await readFrames(res, 1);
    ctrl.abort();

    assert.ok(frames.every((f) => f.data.clientId === clientId));
    assert.ok(frames.some((f) => f.data.triggerId === 42));
  });
});

// ── Dedup breakdown bucketing: the trigger-stats endpoint switches between
// hourly buckets (windows < 24h) and daily buckets (>= 24h). This boundary plus
// the SQL bucket grouping is easy to break silently, so pin it down here.
const DEDUP_WINDOW_HOURS_KEY = "dedup_window_hours";

// Force getDedupWindowHours() to return exactly `hours` by writing the canonical
// settings row. Returns a restore fn that removes the override so other tests
// (and the default window) are unaffected.
async function setDedupWindowHours(hours: number): Promise<() => Promise<void>> {
  await db
    .insert(settingsTable)
    .values({ key: DEDUP_WINDOW_HOURS_KEY, value: String(hours), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(hours), updatedAt: new Date() },
    });
  return async () => {
    await db.delete(settingsTable).where(eq(settingsTable.key, DEDUP_WINDOW_HOURS_KEY)).catch(() => {});
  };
}

// The handler truncates each bucket to a UTC hour / calendar day. These mirror
// the SQL bucket expression so test expectations line up with what the route
// produces — any tz drift between the two would surface as a dropped count.
function hourBucketKey(d: Date): string {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  return `${t.toISOString().slice(0, 13)}:00:00Z`;
}
function dayBucketKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Seed a client → agent → assignment → trigger and a batch of "deduplicated"
// events at the given fire times. Returns the ids plus a cleanup fn.
async function seedDedupEvents(firedAts: Date[]) {
  const [client] = await db
    .insert(clientsTable)
    .values({ name: `__test-${randomUUID()}`, industry: "test", contactEmail: "t@test.dev" })
    .returning();
  const [agent] = await db
    .insert(agentsTable)
    .values({ name: `__test-agent-${randomUUID()}`, description: "t", category: "test" })
    .returning();
  const [assignment] = await db
    .insert(assignmentsTable)
    .values({ clientId: client.id, agentId: agent.id })
    .returning();
  const [trigger] = await db
    .insert(triggersTable)
    .values({ assignmentId: assignment.id, webhookSecret: randomUUID(), status: "idle" })
    .returning();

  if (firedAts.length) {
    await db.insert(triggerEventsTable).values(
      firedAts.map((firedAt) => ({
        triggerId: trigger.id,
        assignmentId: assignment.id,
        payload: "{}",
        agentStatus: "deduplicated" as const,
        firedAt,
      })),
    );
  }

  const cleanup = async () => {
    await db.delete(triggerEventsTable).where(eq(triggerEventsTable.triggerId, trigger.id)).catch(() => {});
    await db.delete(triggersTable).where(eq(triggersTable.id, trigger.id)).catch(() => {});
    await db.delete(assignmentsTable).where(eq(assignmentsTable.id, assignment.id)).catch(() => {});
    await db.delete(agentsTable).where(eq(agentsTable.id, agent.id)).catch(() => {});
    await db.delete(clientsTable).where(eq(clientsTable.id, client.id)).catch(() => {});
  };

  return { client, agent, assignment, trigger, cleanup };
}

describe("GET /clients/:id/trigger-stats — dedup breakdown bucketing", () => {
  it("uses hourly buckets for a sub-day (6h) window and places counts per ISO hour", async () => {
    const HOUR = 60 * 60 * 1000;
    // Pin firedAt to minute 30 of each target hour so the few ms of clock drift
    // between this code and the handler's Date.now() can't shift the bucket.
    const at = (hoursAgo: number) => {
      const d = new Date(Date.now() - hoursAgo * HOUR);
      d.setUTCMinutes(30, 0, 0);
      return d;
    };
    const oneHourAgo = at(1); // 2 events here
    const threeHoursAgo = at(3); // 1 event here
    const { client, cleanup } = await seedDedupEvents([oneHourAgo, oneHourAgo, threeHoursAgo]);
    const restore = await setDedupWindowHours(6);

    try {
      const res = await fetch(`${baseUrl}/api/clients/${client.id}/trigger-stats`);
      assert.equal(res.status, 200);
      const body = await res.json();

      assert.equal(body.breakdownUnit, "hour");
      assert.equal(body.windowHours, 6);
      assert.equal(body.totalDeduplicated, 3);

      // 6h window → exactly 6 hourly buckets, oldest → newest, all keys present.
      assert.equal(body.dailyBreakdown.length, 6);
      const byKey = new Map<string, number>(
        body.dailyBreakdown.map((b: { date: string; count: number }) => [b.date, b.count]),
      );
      assert.equal(byKey.get(hourBucketKey(oneHourAgo)), 2, "2 dups land in the 1h-ago hour bucket");
      assert.equal(byKey.get(hourBucketKey(threeHoursAgo)), 1, "1 dup lands in the 3h-ago hour bucket");

      // Every bucket key is a full ISO hour (not a calendar date).
      for (const b of body.dailyBreakdown) {
        assert.match(b.date, /^\d{4}-\d{2}-\d{2}T\d{2}:00:00Z$/);
      }

      // Counts across all buckets sum to the total (no leakage / double count).
      const sum = body.dailyBreakdown.reduce((s: number, b: { count: number }) => s + b.count, 0);
      assert.equal(sum, 3);
    } finally {
      await restore();
      await cleanup();
    }
  });

  it("zero-fills empty hourly buckets that had no dedup events", async () => {
    const HOUR = 60 * 60 * 1000;
    const at = (hoursAgo: number) => {
      const d = new Date(Date.now() - hoursAgo * HOUR);
      d.setUTCMinutes(30, 0, 0);
      return d;
    };
    const twoHoursAgo = at(2); // the only populated bucket
    const { client, cleanup } = await seedDedupEvents([twoHoursAgo]);
    const restore = await setDedupWindowHours(6);

    try {
      const res = await fetch(`${baseUrl}/api/clients/${client.id}/trigger-stats`);
      const body = await res.json();

      assert.equal(body.breakdownUnit, "hour");
      assert.equal(body.dailyBreakdown.length, 6);

      const populatedKey = hourBucketKey(twoHoursAgo);
      let populated = 0;
      let zeros = 0;
      for (const b of body.dailyBreakdown) {
        if (b.date === populatedKey) {
          assert.equal(b.count, 1);
          populated++;
        } else {
          assert.equal(b.count, 0, `bucket ${b.date} should be zero-filled`);
          zeros++;
        }
      }
      assert.equal(populated, 1);
      assert.equal(zeros, 5, "the other 5 hourly buckets are zero-filled");
    } finally {
      await restore();
      await cleanup();
    }
  });

  it("keeps daily buckets for a >= 24h (48h) window", async () => {
    // Noon yesterday is always 12–36h ago → safely inside a 48h window and on
    // yesterday's calendar date regardless of the current time of day.
    const noonYesterday = new Date();
    noonYesterday.setUTCDate(noonYesterday.getUTCDate() - 1);
    noonYesterday.setUTCHours(12, 0, 0, 0);
    const today = new Date(); // current moment → today's date, safely in the past

    const { client, cleanup } = await seedDedupEvents([today, today, noonYesterday]);
    const restore = await setDedupWindowHours(48);

    try {
      const res = await fetch(`${baseUrl}/api/clients/${client.id}/trigger-stats`);
      const body = await res.json();

      assert.equal(body.breakdownUnit, "day");
      assert.equal(body.windowHours, 48);
      assert.equal(body.totalDeduplicated, 3);

      // 48h window → 2 calendar-day buckets (yesterday, today).
      assert.equal(body.dailyBreakdown.length, 2);
      for (const b of body.dailyBreakdown) {
        assert.match(b.date, /^\d{4}-\d{2}-\d{2}$/, "day buckets are calendar dates");
      }
      const byKey = new Map<string, number>(
        body.dailyBreakdown.map((b: { date: string; count: number }) => [b.date, b.count]),
      );
      assert.equal(byKey.get(dayBucketKey(today)), 2);
      assert.equal(byKey.get(dayBucketKey(noonYesterday)), 1);
    } finally {
      await restore();
      await cleanup();
    }
  });

  it("per-assignment breakdowns use the same unit and buckets as the client roll-up", async () => {
    const HOUR = 60 * 60 * 1000;
    const at = (hoursAgo: number) => {
      const d = new Date(Date.now() - hoursAgo * HOUR);
      d.setUTCMinutes(30, 0, 0);
      return d;
    };
    const oneHourAgo = at(1);
    const { client, assignment, cleanup } = await seedDedupEvents([oneHourAgo, oneHourAgo]);
    const restore = await setDedupWindowHours(6);

    try {
      const res = await fetch(`${baseUrl}/api/clients/${client.id}/trigger-stats`);
      const body = await res.json();

      assert.equal(body.breakdownUnit, "hour");
      const row = body.perAssignment.find(
        (r: { assignmentId: number }) => r.assignmentId === assignment.id,
      );
      assert.ok(row, "the seeded assignment appears in perAssignment");
      assert.equal(row.deduplicated, 2);

      // Same bucket count + identical ordered date keys as the client roll-up.
      const clientKeys = body.dailyBreakdown.map((b: { date: string }) => b.date);
      const assignmentKeys = row.dailyBreakdown.map((b: { date: string }) => b.date);
      assert.deepEqual(assignmentKeys, clientKeys, "per-assignment buckets mirror the client unit");

      const byKey = new Map<string, number>(
        row.dailyBreakdown.map((b: { date: string; count: number }) => [b.date, b.count]),
      );
      assert.equal(byKey.get(hourBucketKey(oneHourAgo)), 2);
    } finally {
      await restore();
      await cleanup();
    }
  });
});
