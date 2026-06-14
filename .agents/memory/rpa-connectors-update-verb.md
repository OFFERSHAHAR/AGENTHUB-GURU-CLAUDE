---
name: rpa-connectors update verb
description: Which HTTP method the api-server exposes for updating an RPA connector
---

The api-server exposes only `PATCH /api/rpa-connectors/:id` for updating a connector (name, baseUrl, username, password, notes, clientId, status). There is **no** `PUT` handler.

**Why:** A frontend mutation that linked a connector to a client used `PUT`, which hit no route and silently failed (no link persisted). Caught in code review, not at runtime, because there was no error toast.

**How to apply:** Any client-side call that edits a connector must use `PATCH`. Passing `clientId: null` unlinks the client (route coerces falsy clientId to null).
