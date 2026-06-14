import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const triggerEventsTable = pgTable("trigger_events", {
  id: serial("id").primaryKey(),
  triggerId: integer("trigger_id").notNull(),
  assignmentId: integer("assignment_id").notNull(),
  payload: text("payload"),
  agentStatus: text("agent_status").notNull().default("triggered"), // triggered | running | idle | deduplicated
  agentOutput: text("agent_output"),
  firedAt: timestamp("fired_at").notNull().defaultNow(),
});

export type TriggerEvent = typeof triggerEventsTable.$inferSelect;
