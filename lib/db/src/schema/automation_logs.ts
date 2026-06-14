import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automationLogsTable = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  clientId: integer("client_id").notNull(),
  agentId: integer("agent_id").notNull(),
  action: text("action").notNull(),
  disabledBy: text("disabled_by").notNull().default("Ops Admin"),
  reason: text("reason"),
  lastErrors: text("last_errors"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAutomationLogSchema = createInsertSchema(automationLogsTable).omit({ id: true, createdAt: true });
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type AutomationLog = typeof automationLogsTable.$inferSelect;
