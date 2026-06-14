import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orchestratorsTable = pgTable("orchestrators", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique(),
  routingRules: text("routing_rules").notNull().default("{}"),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrchestratorSchema = createInsertSchema(orchestratorsTable).omit({ id: true, updatedAt: true });
export type InsertOrchestrator = z.infer<typeof insertOrchestratorSchema>;
export type Orchestrator = typeof orchestratorsTable.$inferSelect;
