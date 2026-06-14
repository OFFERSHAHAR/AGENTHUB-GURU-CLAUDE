import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  planTriggerRun,
  selectTriggerChoice,
  TRIGGER_PENDING_TTL_MS,
  type ResolvedTrigger,
} from "./jarvisTriggerFlow.js";

function trig(label: string): ResolvedTrigger {
  return { secret: `secret-${label}`, label, assignmentId: label.length, status: "idle" };
}

describe("planTriggerRun — single vs multi-trigger decision", () => {
  it("single-trigger clients skip the pick-list and go straight to confirm", () => {
    const only = trig("Agent A · Acme");
    const plan = planTriggerRun([only]);
    assert.equal(plan.kind, "confirm");
    assert.deepEqual(plan.kind === "confirm" && plan.trigger, only);
  });

  it("multi-trigger clients get a pick-list (choices), not a confirm", () => {
    const triggers = [trig("Agent A · Acme"), trig("Agent B · Acme")];
    const plan = planTriggerRun(triggers);
    assert.equal(plan.kind, "pick");
    assert.deepEqual(plan.kind === "pick" && plan.triggers, triggers);
  });

  it("preserves order so the pick-list index lines up with the desktop's list", () => {
    const triggers = [trig("First"), trig("Second"), trig("Third")];
    const plan = planTriggerRun(triggers);
    assert.equal(plan.kind, "pick");
    if (plan.kind === "pick") {
      assert.deepEqual(plan.triggers.map((t) => t.label), ["First", "Second", "Third"]);
    }
  });
});

describe("selectTriggerChoice — pick-list selection gating", () => {
  const now = 1_000_000;
  const pending = { triggers: [trig("A"), trig("B"), trig("C")], ts: now };

  it("returns the chosen trigger for a valid in-range index", () => {
    const sel = selectTriggerChoice(pending, 1, now + 1000);
    assert.equal(sel.ok, true);
    assert.equal(sel.ok && sel.chosen.label, "B");
  });

  it("accepts index 0 (boundary)", () => {
    const sel = selectTriggerChoice(pending, 0, now);
    assert.equal(sel.ok, true);
    assert.equal(sel.ok && sel.chosen.label, "A");
  });

  it("rejects an out-of-range index gracefully", () => {
    const sel = selectTriggerChoice(pending, 9, now);
    assert.equal(sel.ok, false);
    assert.equal(!sel.ok && sel.reason, "invalid");
  });

  it("rejects a missing / null choice index gracefully", () => {
    assert.equal(selectTriggerChoice(pending, null, now).ok, false);
    assert.equal(selectTriggerChoice(pending, undefined, now).ok, false);
  });

  it("rejects when there is no pending pick-list", () => {
    const sel = selectTriggerChoice(null, 0, now);
    assert.equal(sel.ok, false);
    assert.equal(!sel.ok && sel.reason, "expired");
  });

  it("rejects an expired pick-list (> 2 min old)", () => {
    const sel = selectTriggerChoice(pending, 0, now + TRIGGER_PENDING_TTL_MS + 1);
    assert.equal(sel.ok, false);
    assert.equal(!sel.ok && sel.reason, "expired");
  });

  it("still accepts right at the expiry boundary", () => {
    const sel = selectTriggerChoice(pending, 0, now + TRIGGER_PENDING_TTL_MS);
    assert.equal(sel.ok, true);
  });
});
