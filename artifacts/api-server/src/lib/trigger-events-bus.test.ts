import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  publishTriggerEvent,
  subscribeTriggerEvents,
  getEventsSince,
  type TriggerBusEnvelope,
} from "./trigger-events-bus.js";

// Each test uses a distinct synthetic clientId so the per-client ring buffers
// never overlap with another test's events (the seq counter is process-wide).

describe("trigger-events-bus", () => {
  it("assigns a strictly increasing, monotonic id to every published event", () => {
    const clientId = 910001;
    const received: TriggerBusEnvelope[] = [];
    const unsubscribe = subscribeTriggerEvents((e) => {
      if (e.clientId === clientId) received.push(e);
    });
    try {
      for (let i = 0; i < 4; i++) {
        publishTriggerEvent({
          clientId,
          assignmentId: 1,
          triggerId: 1,
          agentStatus: "triggered",
          firedAt: new Date().toISOString(),
        });
      }
    } finally {
      unsubscribe();
    }

    assert.equal(received.length, 4);
    for (let i = 1; i < received.length; i++) {
      assert.ok(
        received[i].id > received[i - 1].id,
        `id must strictly increase: ${received[i - 1].id} -> ${received[i].id}`,
      );
    }
  });

  it("getEventsSince returns only events with an id greater than lastEventId", () => {
    const clientId = 910002;
    const ids: number[] = [];
    const unsubscribe = subscribeTriggerEvents((e) => {
      if (e.clientId === clientId) ids.push(e.id);
    });
    try {
      for (let i = 0; i < 5; i++) {
        publishTriggerEvent({
          clientId,
          assignmentId: 1,
          triggerId: 1,
          agentStatus: "triggered",
          firedAt: new Date().toISOString(),
        });
      }
    } finally {
      unsubscribe();
    }

    // Pretend the client last saw the 2nd event; only the last 3 are "missed".
    const lastSeen = ids[1];
    const missed = getEventsSince(clientId, lastSeen);
    assert.deepEqual(
      missed.map((e) => e.id),
      ids.slice(2),
    );
    assert.ok(missed.every((e) => e.id > lastSeen));

    // Nothing is missed if the client is already caught up.
    assert.equal(getEventsSince(clientId, ids[ids.length - 1]).length, 0);
  });

  it("getEventsSince is scoped to a single client's ring buffer", () => {
    const clientA = 910003;
    const clientB = 910004;
    publishTriggerEvent({ clientId: clientA, assignmentId: 1, triggerId: 1, agentStatus: "triggered", firedAt: new Date().toISOString() });
    publishTriggerEvent({ clientId: clientB, assignmentId: 2, triggerId: 2, agentStatus: "triggered", firedAt: new Date().toISOString() });

    const aEvents = getEventsSince(clientA, 0);
    const bEvents = getEventsSince(clientB, 0);
    assert.ok(aEvents.every((e) => e.clientId === clientA));
    assert.ok(bEvents.every((e) => e.clientId === clientB));
    // Unknown client has no ring buffer at all.
    assert.deepEqual(getEventsSince(919999, 0), []);
  });

  it("caps the per-client ring buffer (old events drop, newest are retained)", () => {
    const clientId = 910005;
    const published: number[] = [];
    for (let i = 0; i < 60; i++) {
      const before = getEventsSince(clientId, 0);
      void before;
      publishTriggerEvent({ clientId, assignmentId: 1, triggerId: 1, agentStatus: "triggered", firedAt: new Date().toISOString() });
    }
    const all = getEventsSince(clientId, 0);
    // Ring is bounded — it must never grow without limit.
    assert.ok(all.length <= 50, `ring should be capped, got ${all.length}`);
    assert.equal(all.length, 50);
    // The most recent events survive; ids remain sorted ascending.
    for (let i = 1; i < all.length; i++) {
      assert.ok(all[i].id > all[i - 1].id);
    }
    void published;
  });
});
