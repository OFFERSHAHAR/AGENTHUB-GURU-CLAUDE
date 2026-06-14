---
name: Guardrails system
description: Per-assignment LLM security layer — rule types, DB column, API routes, enforcement points
---

## Rule types (8 total)
| type | enforced at |
|---|---|
| `prompt_injection_direct` | input |
| `prompt_injection_hidden` | input (base64, zero-width, homoglyph) |
| `jailbreak_detection` | input |
| `input_keyword_block` | input |
| `output_keyword_block` | output (redact or block) |
| `topic_scope` | system-prompt injection |
| `pii_masking` | output (regex mask email/phone/id/card) |
| `max_input_length` | input |

## DB
- `assignments.guardrails TEXT` — JSON array of GuardrailRule objects
- Migrated via `pnpm --filter @workspace/db run push-force`

## API routes (automations.ts)
- `GET /api/assignments/:id/guardrails` → `{ rules: GuardrailRule[] }`
- `PATCH /api/assignments/:id/guardrails` body `{ rules }` → `{ ok, rules }`

## Enforcement (conversations.ts)
1. Load assignment guardrails (clientId + agentId match)
2. `applyInputGuardrails()` → if blocked, store blocked message in conv and return early (no AI call)
3. `buildTopicScopeInstruction()` → appended to system prompt
4. After AI response: `applyOutputGuardrails()` → sanitize/block

## Service file
`artifacts/api-server/src/services/guardrails.ts`

## Frontend
`GuardrailsPanel` per assignment + `GuardrailsSection` container — rendered in `client-detail.tsx` above TriggersSection.
Uses direct `fetch` (not codegen) since no api-spec entry yet.

**Why:** LLM-facing agents need runtime protection independent of model-level safety; per-assignment means different clients can have different policies on the same agent.
