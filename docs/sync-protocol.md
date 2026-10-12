# Sync protocol (as simulated in the demo)

1. Every write → local DB **and** an outbox item `{op, entity, entityId, idempotencyKey = id:version, at}`; UI updates optimistically.
2. The engine runs on reconnect, on window focus and every 60 s while online.
3. **Push**: pending items are sent in order; the server applies them idempotently and replies accepted/rejected.
4. **Pull**: `GET /sync/pull?since=<cursor>` returns changed rows per table; the cursor advances.
5. Master data (catalog, licenses, pharmacy status) is server-wins and read-only offline.
6. The Sync center (`/app/sync`, `/gov/sync`) lists the outbox, shows last sync and catalog age, and has demo
   controls to go offline and to simulate 8 / 15 days without sync.
