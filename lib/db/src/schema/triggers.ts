import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const triggersTable = pgTable("triggers", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  webhookSecret: text("webhook_secret").notNull(),
  status: text("status").notNull().default("idle"),
  lastFiredAt: timestamp("last_fired_at"),
  lastPayload: text("last_payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTriggerSchema = createInsertSchema(triggersTable).omit({ id: true, createdAt: true });
export type InsertTrigger = z.infer<typeof insertTriggerSchema>;
export type Trigger = typeof triggersTable.$inferSelect;
