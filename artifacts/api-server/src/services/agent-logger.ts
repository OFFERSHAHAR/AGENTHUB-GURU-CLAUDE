/**
 * Agent Logger — centralized structured logging for all agent operations.
 * Non-blocking: all writes are fire-and-forget so they never slow down request handling.
 */

import { db, agentLogsTable } from "@workspace/db";
import type { InsertAgentLog } from "@workspace/db";

export type LogEventType =
  | "request"      // incoming request received
  | "response"     // final response sent to client
  | "ai_call"      // model invocation
  | "ai_success"   // model responded successfully
  | "ai_fallback"  // model fell back to another provider
  | "ai_error"     // model call failed
  | "chain_pass"   // output passed to next agent in chain
  | "error"        // unhandled error
  | "success"      // operation completed successfully
  | "warning";     // recoverable issue

export type LogStatus = "success" | "error" | "warning" | "info";

export interface LogEventInput {
  source: string;
  eventType: LogEventType;
  status: LogStatus;
  agentId?: number;
  agentName?: string;
  clientId?: number;
  conversationId?: number;
  inputSummary?: string;
  outputSummary?: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/** Truncate a string to maxLen with ellipsis */
function truncate(s: string | undefined | null, maxLen = 500): string | undefined {
  if (!s) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) + "…" : s;
}

/**
 * Log a single agent event to the DB.
 * Fire-and-forget — errors are swallowed to avoid breaking request handlers.
 */
export function logEvent(input: LogEventInput): void {
  const row: InsertAgentLog = {
    source: input.source,
    eventType: input.eventType,
    status: input.status,
    agentId: input.agentId ?? null,
    agentName: input.agentName ?? null,
    clientId: input.clientId ?? null,
    conversationId: input.conversationId ?? null,
    inputSummary: truncate(input.inputSummary),
    outputSummary: truncate(input.outputSummary),
    provider: input.provider ?? null,
    model: input.model ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    estimatedCostUsd: input.estimatedCostUsd ?? null,
    durationMs: input.durationMs ?? null,
    errorMessage: input.errorMessage ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  };

  db.insert(agentLogsTable).values(row).catch((err: unknown) => {
    console.error("[agent-logger] DB write failed:", err instanceof Error ? err.message : err);
  });
}

/** Timed helper: wraps an async operation and logs start + end */
export async function loggedOperation<T>(
  input: Omit<LogEventInput, "eventType" | "status" | "durationMs">,
  operation: () => Promise<T>,
  toOutputSummary?: (result: T) => string,
): Promise<T> {
  const start = Date.now();
  logEvent({ ...input, eventType: "request", status: "info" });

  try {
    const result = await operation();
    const durationMs = Date.now() - start;
    logEvent({
      ...input,
      eventType: "success",
      status: "success",
      durationMs,
      outputSummary: toOutputSummary ? truncate(toOutputSummary(result)) : undefined,
    });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    logEvent({
      ...input,
      eventType: "error",
      status: "error",
      durationMs,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
