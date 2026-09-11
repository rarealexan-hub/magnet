---
name: PostgreSQL test compatibility
description: SQL compatibility constraint for repository code tested with pg-mem.
---

Prefer parameterized multi-row `VALUES` statements over `unnest(array)` when both approaches are practical.

**Why:** The production database supports `unnest`, but the project's pg-mem test adapter does not, preventing adapter-level tests from exercising otherwise valid SQL.

**How to apply:** For small application-generated batches in repository methods, deduplicate in TypeScript and generate parameter placeholders for a `VALUES` insert.