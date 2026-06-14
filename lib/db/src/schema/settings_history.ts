import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsHistoryTable = pgTable("settings_history", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedBy: text("changed_by").notNull().default("ops"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSettingsHistorySchema = createInsertSchema(settingsHistoryTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSettingsHistory = z.infer<typeof insertSettingsHistorySchema>;
export type SettingsHistory = typeof settingsHistoryTable.$inferSelect;
