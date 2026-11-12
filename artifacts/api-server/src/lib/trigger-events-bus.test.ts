import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  publishTriggerEvent,
  subscribeTriggerEvents,
  getMissedEvents,
  type TriggerBusEnvelope,
} from "./trigger-events-bus.js";

// Unit tests for the in-process bus. Event ids are the durable
// trigger_events.id, so the tests supply them. Every getMissedEvents call here
// is served from the in-memory ring (fast path) — no database is touched.
// Each test uses its own synthetic clientId so ring buffers never overlap.

const ev = (clientId: number, id: number): TriggerBusEnvelope => ({
  id,
  clientId,
  assignmentId: 1,
  triggerId: 1,
  agentStatus: "triggered",
  firedAt: new Date().toISOString(),
});

describe("trigger-events-bus", () => {
  it("delivers published events to subscribers and stops after unsubscribe", () => {
    const clientId = 910001;
    const received: number[] = [];
    const unsubscribe = subscribeTriggerEvents((e) => {
      if (e.clientId === clientId) received.push(e.id);
    });
    publishTriggerEvent(ev(clientId, 1));
    publishTriggerEvent(ev(clientId, 2));
    unsubscribe();
    publishTriggerEvent(ev(clientId, 3));
    assert.deepEqual(received, [1, 2]);
  });

  it("getMissedEvents replays only events newer than lastEventId", async () => {
    const clientId = 910002;
    for (let id = 101; id <= 105; id++) publishTriggerEvent(ev(clientId, id));

    const missed = await getMissedEvents(clientId, 102);
    assert.deepEqual(missed.map((e) => e.id), [103, 104, 105]);
    assert.deepEqual(await getMissedEvents(clientId, 105), []);
  });

  it("getMissedEvents is scoped to a single client", async () => {
    publishTriggerEvent(ev(910003, 201));
    publishTriggerEvent(ev(910004, 202));
    const a = await getMissedEvents(910003, 200);
    const b = await getMissedEvents(910004, 201);
    assert.ok(a.length === 1 && a[0].clientId === 910003);
    assert.ok(b.length === 1 && b[0].clientId === 910004);
  });

  it("caps the per-client ring at 50, keeping the newest events", async () => {
    const clientId = 910005;
    for (let id = 1001; id <= 1060; id++) publishTriggerEvent(ev(clientId, id));
    // Oldest retained id is 1011; asking from 1010 stays on the ring fast path.
    const all = await getMissedEvents(clientId, 1010);
    assert.equal(all.length, 50);
    assert.equal(all[0].id, 1011);
    assert.equal(all[all.length - 1].id, 1060);
  });
});
