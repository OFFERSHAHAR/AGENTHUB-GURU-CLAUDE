import { pgTable, serial, text, integer, timestamp, real, jsonb } from "drizzle-orm/pg-core";

export const emailLeads = pgTable("email_leads", {
  id: serial("id").primaryKey(),
  sourceFile: text("source_file").notNull(),
  fromAddress: text("from_address"),
  fromName: text("from_name"),
  subject: text("subject"),
  bodyText: text("body_text"),
  category: text("category").notNull(),
  categorySlug: text("category_slug").notNull(),
  leadScore: text("lead_score").notNull().default("COLD"),
  confidence: real("confidence").default(0),
  summaryHe: text("summary_he"),
  recommendedPackage: text("recommended_package"),
  keySignals: jsonb("key_signals").$type<string[]>().default([]),
  nextAction: text("next_action"),
  rawPayload: jsonb("raw_payload"),
  telegramSent: integer("telegram_sent").default(0),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type EmailLead = typeof emailLeads.$inferSelect;
export type NewEmailLead = typeof emailLeads.$inferInsert;
