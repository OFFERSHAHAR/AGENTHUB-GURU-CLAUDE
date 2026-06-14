import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tokenUsageTable = pgTable("token_usage", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"),
  model: text("model").notNull(),
  provider: text("provider").notNull(),
  tier: text("tier").notNull().default("free"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCostUsd: doublePrecision("estimated_cost_usd").notNull().default(0),
  purpose: text("purpose"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTokenUsageSchema = createInsertSchema(tokenUsageTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTokenUsage = z.infer<typeof insertTokenUsageSchema>;
export type TokenUsage = typeof tokenUsageTable.$inferSelect;
