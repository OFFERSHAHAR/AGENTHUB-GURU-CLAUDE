import { EventEmitter } from "events";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, triggerEventsTable, assignmentsTable } from "@workspace/db";

// In-process pub/sub bus for trigger lifecycle events. SSE routes subscribe to
// this and push updates to connected dashboards the moment a webhook fires —
// including fires originating outside AgentHub (e.g. an external n8n call).
//
// Every event carries the durable `trigger_events.id` as its monotonic id. That
// id comes from a Postgres sequence, so it stays stable and strictly increasing
// even across an API server restart (deploy, crash). EventSource resumes a
// dropped stream with the last id it saw via Last-Event-ID, and we use that to
// replay anything missed — from the fast in-memory ring buffer for brief drops,
// or from the durable trigger_events table for gaps the buffer can't cover
// (notably a server restart, which wipes the ring and would otherwise lose every
// fire during the gap).
export interface TriggerBusEvent {
  // Durable trigger_events.id — stable & monotonic across restarts.
  id: number;
  clientId: number;
  assignmentId: number;
  triggerId: number;
  agentStatus: string;
  firedAt: string;
}

// Retained as a distinct name for call sites that think of a "delivered" event.
// Identical shape to TriggerBusEvent now that the durable id is intrinsic.
export type TriggerBusEnvelope = TriggerBusEvent;

const emitter = new EventEmitter();
// Many dashboards may stream the same client concurrently; lift the default cap.
emitter.setMaxListeners(0);

const CHANNEL = "trigger-event";

// Short ring buffer of recent events per client, used to replay fires a tab
// missed while briefly offline. Kept small — this only needs to cover the gap
// of a reconnect, not full history (the DB holds that). It is process-local, so
// a restart empties it; the DB backfill below covers that case.
const RING_SIZE = 50;
const ringByClient = new Map<number, TriggerBusEnvelope[]>();

// Cap how many rows a single DB backfill may replay, so a very stale reconnect
// can't stream thousands of rows. The dashboard refetches from the DB on any
// replayed event anyway, so the newest fires plus that refetch keep it accurate.
const BACKFILL_LIMIT = 500;

export function publishTriggerEvent(event: TriggerBusEvent): void {
  const ring = ringByClient.get(event.clientId) ?? [];
  ring.push(event);
  if (ring.length > RING_SIZE) ring.shift();
  ringByClient.set(event.clientId, ring);

  emitter.emit(CHANNEL, event);
}

export function subscribeTriggerEvents(
  listener: (event: TriggerBusEnvelope) => void,
): () => void {
  emitter.on(CHANNEL, listener);
  return () => emitter.off(CHANNEL, listener);
}

// Return events for a client with an id strictly greater than the one the client
// last received, used to replay fires missed during a disconnect.
//
// Fast path: if the in-memory ring buffer's earliest event immediately follows
// what the client already has (no gap the ring can't see), serve from memory —
// this covers brief client-side network drops with zero DB load.
//
// Slow path: if the ring is empty (server restarted) or its earliest event is
// newer than lastEventId + 1 (the gap predates the buffer / it overflowed),
// backfill from the durable trigger_events table so fires during the gap aren't
// lost. Replayed DB rows reuse their own trigger_events.id, so ids stay stable
// and monotonic and the client doesn't double-count.
export async function getMissedEvents(
  clientId: number,
  lastEventId: number,
): Promise<TriggerBusEnvelope[]> {
  const ring = ringByClient.get(clientId);
  if (ring && ring.length > 0 && ring[0].id <= lastEventId + 1) {
    return ring.filter((e) => e.id > lastEventId);
  }

  const rows = await db
    .select({
      id: triggerEventsTable.id,
      assignmentId: triggerEventsTable.assignmentId,
      triggerId: triggerEventsTable.triggerId,
      agentStatus: triggerEventsTable.agentStatus,
      firedAt: triggerEventsTable.firedAt,
    })
    .from(triggerEventsTable)
    .innerJoin(
      assignmentsTable,
      eq(triggerEventsTable.assignmentId, assignmentsTable.id),
    )
    .where(
      and(
        eq(assignmentsTable.clientId, clientId),
        gt(triggerEventsTable.id, lastEventId),
      ),
    )
    .orderBy(asc(triggerEventsTable.id))
    .limit(BACKFILL_LIMIT);

  return rows.map((r) => ({
    id: r.id,
    clientId,
    assignmentId: r.assignmentId,
    triggerId: r.triggerId,
    agentStatus: r.agentStatus,
    firedAt: r.firedAt.toISOString(),
  }));
}
