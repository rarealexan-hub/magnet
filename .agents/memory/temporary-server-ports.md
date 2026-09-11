---
name: Temporary server ports
description: Cleanup timing for ports opened by temporary acceptance-test servers.
---

Remove port mappings created by disposable background servers only after the final normal-workflow restart.

**Why:** Workflow reconciliation can re-add mappings for recently stopped temporary servers, even after an earlier validated `.replit` cleanup.

**How to apply:** Stop temporary servers, restart the normal workflow, then remove only the temporary port blocks through validated Replit configuration and verify they remain absent without another restart.