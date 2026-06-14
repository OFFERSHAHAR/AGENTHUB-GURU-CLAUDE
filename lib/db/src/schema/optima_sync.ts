import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { clientsTable } from "./clients";
import { rpaConnectorsTable } from "./rpa_connectors";

/**
 * Human-in-the-loop approval gate for Optima data syncs.
 *
 * Flow: scheduler (every N hours) pulls fresh data from Optima, diffs it against
 * the last APPLIED snapshot, and creates one PENDING row here. A Telegram message
 * with Approve/Cancel buttons is sent to the client's chat. Nothing is written to
 * the stored snapshot until a human approves — approval is always mandatory.
 *
 * status: pending → approved → applied | cancelled | expired | error
 */
export const optimaSyncApprovalsTable = pgTable("optima_sync_approvals", {
  id: serial("id").primaryKey(),
  connectorId: integer("connector_id")
    .notNull()
    .references(() => rpaConnectorsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clientsTable.id),
  action: text("action").notNull().default("get_occupancy"),
  status: text("status").notNull().default("pending"),

  // Diff summary shown to the human before they approve.
  newCount: integer("new_count").notNull().default(0),
  overwriteCount: integer("overwrite_count").notNull().default(0),
  removedCount: integer("removed_count").notNull().default(0),
  unchangedCount: integer("unchanged_count").notNull().default(0),

  // Full payloads (JSON strings): the freshly-pulled data and the snapshot it replaces.
  proposedData: text("proposed_data"),
  previousData: text("previous_data"),

  telegramChatId: text("telegram_chat_id"),
  telegramMessageId: text("telegram_message_id"),

  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  appliedAt: timestamp("applied_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  // At most one OPEN (pending) approval per connector — DB-enforced so concurrent
  // scheduler/manual runs can never create duplicate pending gates.
  onePendingPerConnector: uniqueIndex("optima_one_pending_per_connector")
    .on(t.connectorId)
    .where(sql`${t.status} = 'pending'`),
}));

export type OptimaSyncApproval = typeof optimaSyncApprovalsTable.$inferSelect;
