import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("active"),
  capabilities: text("capabilities").notNull().default("[]"),
  iconEmoji: text("icon_emoji"),
  deployedCount: integer("deployed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // AI Model parameters
  model: text("model").default("gpt-4o"),
  temperature: doublePrecision("temperature").default(0.7),
  maxTokens: integer("max_tokens").default(2048),
  systemPrompt: text("system_prompt"),
  responseFormat: text("response_format").default("text"),
  memoryType: text("memory_type").default("none"),
  timeout: integer("timeout").default(60),
  retryCount: integer("retry_count").default(2),
  triggerType: text("trigger_type").default("manual"),
  tags: text("tags").default("[]"),
  inputSchema: text("input_schema"),
  outputSchema: text("output_schema"),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({ id: true, createdAt: true, deployedCount: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
