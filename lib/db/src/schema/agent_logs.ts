import { pgTable, text, serial, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentLogsTable = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),

  // Who
  source: text("source").notNull(),          // "spec-agent" | "lang-agent" | "conversation" | "orchestrator"
  agentId: integer("agent_id"),              // FK agents.id (nullable — spec/lang agents have no DB id)
  agentName: text("agent_name"),
  clientId: integer("client_id"),
  conversationId: integer("conversation_id"),

  // What
  eventType: text("event_type").notNull(),   // "request" | "response" | "chain_pass" | "error" | "success" | "retry" | "fallback"
  status: text("status").notNull(),          // "success" | "error" | "warning" | "info"

  // Content (truncated)
  inputSummary: text("input_summary"),       // first 500 chars of input
  outputSummary: text("output_summary"),     // first 500 chars of output

  // Model info
  provider: text("provider"),                // "groq" | "openai" | "ollama" | "template"
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCostUsd: doublePrecision("estimated_cost_usd"),

  // Timing
  durationMs: integer("duration_ms"),

  // Error
  errorMessage: text("error_message"),

  // Extra JSON
  metadata: text("metadata"),               // JSON string for extra context
});

export const insertAgentLogSchema = createInsertSchema(agentLogsTable).omit({ id: true, timestamp: true });
export type InsertAgentLog = z.infer<typeof insertAgentLogSchema>;
export type AgentLog = typeof agentLogsTable.$inferSelect;
