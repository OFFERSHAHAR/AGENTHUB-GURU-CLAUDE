---
name: OpenAPI component naming collision
description: TS2308 error caused by naming OpenAPI components with <OperationIdPascal>Body pattern
---

# Rule: Never name OpenAPI body schemas `<OperationIdPascal>Body`

When Orval codegen processes OpenAPI specs, a component named `FireWebhookTriggerBody` will collide with the auto-generated type for the operation `fireWebhookTrigger` — causing TS2308 "duplicate identifier" error.

**Why:** Orval auto-generates a type named exactly `<OperationIdPascal>Body` for inline request bodies. If a component shares that name, two identical identifiers are exported.

**How to apply:** Always use unique component names for request bodies: `WebhookPayload`, `XRequestBody`, etc. — never `<OperationId>Body`. Use `$ref` to reference the body schema instead of inline definition.
