import { pgTable, text, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const palgatePermitsTable = pgTable("palgate_permits", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clientsTable.id),
  guestName: text("guest_name").notNull(),
  guestPhone: text("guest_phone").notNull(),
  unitOrNote: text("unit_or_note"),
  checkIn: date("check_in").notNull(),
  checkOut: date("check_out").notNull(),
  status: text("status").notNull().default("pending"),
  sheetRowId: text("sheet_row_id"),
  addedToGate: timestamp("added_to_gate"),
  removedFromGate: timestamp("removed_from_gate"),
  addedConfirmedBy: text("added_confirmed_by"),
  removedConfirmedBy: text("removed_confirmed_by"),
  telegramMessageId: text("telegram_message_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PalgatePermit = typeof palgatePermitsTable.$inferSelect;
