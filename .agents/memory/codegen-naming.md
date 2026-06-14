---
name: OpenAPI codegen naming collision
description: Inline requestBody schemas cause duplicate exports in orval split mode
---

## The problem
Orval in split mode generates BOTH:
1. A Zod schema constant in `generated/api.ts` (e.g. `export const TriggerLogAnalysisBody = zod.object(...)`)
2. A TypeScript type in `generated/types/<name>.ts` (e.g. `export type TriggerLogAnalysisBody = {...}`)

`lib/api-zod/src/index.ts` does `export * from "./generated/api"` AND `export * from "./generated/types"`, causing a TS2308 duplicate export error.

## The fix
Always use a named `$ref` for requestBody schemas in openapi.yaml instead of inline schemas:

```yaml
# BAD — inline schema causes collision:
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties:
          windowMinutes:
            type: integer

# GOOD — named $ref avoids collision:
requestBody:
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/TriggerLogAnalysisInput"
```

Then add `TriggerLogAnalysisInput` to `components/schemas` in the YAML.

**Why:** Orval generates the Zod schema with the operationId prefix + "Body" suffix for inline schemas, but the named type uses the schema name — so naming the schema gives them distinct identifiers.
