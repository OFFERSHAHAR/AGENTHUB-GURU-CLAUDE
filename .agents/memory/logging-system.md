---
name: Logging system architecture
description: How agent logging works — tables, service, instrumentation, processor
---

## Tables
- `agent_logs` — one row per agent event (source, eventType, status, provider/model, tokens, durationMs, inputSummary 500ch, outputSummary 500ch, errorMessage, metadata JSON)
- `agent_log_summaries` — one row per 30-min analysis window, AI-generated Hebrew summaryText + failurePoints/activeAgents/recommendations as JSON strings

## Service (agent-logger.ts)
- `logEvent(input)` — fire-and-forget DB write; swallows errors; never blocks request handlers
- `loggedOperation(input, fn, toOutputSummary?)` — wraps async op, logs request before + success/error after with timing

## Log Processor (log-processor.ts)
- `startLogProcessor()` called once in routes/index.ts — 10s startup delay then runs every 30 min
- `analyzeLogs(windowMinutes)` — reads ≤200 recent logs, sends compact JSON to AI ("starter" tier), parses Hebrew structured summary
- Falls back to computed stats when GROQ_API_KEY not set (provider returns "__TEMPLATE__")

## Instrumented routes
- spec-agent: logs request (info) + ai_success/ai_fallback/error with hasSpecOutput flag
- lang-agent: logs request (info) + success/ai_fallback/error with targetLanguage+domain
- conversations: logs request (info) + ai_success/ai_fallback/ai_error with full model cost tracking

**Why fire-and-forget:** AI agent routes must stay fast; DB write failures should never surface as request errors.
