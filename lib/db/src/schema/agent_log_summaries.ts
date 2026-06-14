import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentLogSummariesTable = pgTable("agent_log_summaries", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Window covered
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  totalEvents: integer("total_events").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),

  // AI-generated summary (Hebrew)
  summaryText: text("summary_text").notNull(),       // short 3-5 line human-readable summary
  failurePoints: text("failure_points"),             // JSON array of { source, description, recommendation }
  activeAgents: text("active_agents"),               // JSON array of { agentName, eventCount, successRate }
  recommendations: text("recommendations"),          // JSON array of action strings

  // Raw stats JSON
  rawStats: text("raw_stats"),
});

export const insertAgentLogSummarySchema = createInsertSchema(agentLogSummariesTable).omit({ id: true, createdAt: true });
export type InsertAgentLogSummary = z.infer<typeof insertAgentLogSummarySchema>;
export type AgentLogSummary = typeof agentLogSummariesTable.$inferSelect;
