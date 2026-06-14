import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const rpaConnectorsTable = pgTable("rpa_connectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  systemType: text("system_type").notNull(),
  baseUrl: text("base_url").notNull(),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  status: text("status").notNull().default("disconnected"),
  lastTestedAt: timestamp("last_tested_at"),
  lastSuccessAt: timestamp("last_success_at"),
  notes: text("notes"),
  metadata: text("metadata"),
  clientId: integer("client_id").references(() => clientsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rpaRunLogsTable = pgTable("rpa_run_logs", {
  id: serial("id").primaryKey(),
  connectorId: integer("connector_id")
    .notNull()
    .references(() => rpaConnectorsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  status: text("status").notNull().default("running"),
  result: text("result"),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  triggeredBy: text("triggered_by").default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RpaConnector = typeof rpaConnectorsTable.$inferSelect;
export type RpaRunLog = typeof rpaRunLogsTable.$inferSelect;
