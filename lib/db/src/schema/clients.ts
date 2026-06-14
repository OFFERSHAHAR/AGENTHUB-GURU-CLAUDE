import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  contactEmail: text("contact_email").notNull(),
  status: text("status").notNull().default("active"),
  agentCount: integer("agent_count").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  // Telegram + AI analysis fields
  source: text("source").notNull().default("manual"),
  tier: text("tier").notNull().default("free"),
  rawSpec: text("raw_spec"),
  analysisStatus: text("analysis_status"),
  analysisDoc: text("analysis_doc"),
  telegramChatId: text("telegram_chat_id"),
  ownerUser: text("owner_user"),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  agentCount: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
