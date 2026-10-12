# Architecture (demo build)

This repository is a **front-end prototype with mock data** for the Lao National Pharmacy Regulatory Platform
(see `pharmacy-regulatory-platform-PROMPT.md`). It runs entirely in the browser — no backend — so the
design, flows, RBAC and offline behaviour can be reviewed before Phase 0 of the real build.

| Layer | Demo | Production target (per prompt) |
|---|---|---|
| UI | React 18 + TS + Vite + Tailwind, lucide icons, Recharts, Leaflet/OSM | same + shadcn/ui, TanStack Router/Query |
| i18n | i18next, `src/i18n/dict.ts` (Lao default, English) | same, keys shared in `packages/shared` |
| Data | deterministic seed (`src/data/seed.ts`) + overlay of local writes | PostgreSQL 16 + PostGIS via Prisma |
| Local DB | `localStorage` overlay (`src/store/store.tsx`) | Dexie / IndexedDB |
| Sync | outbox + simulated push/pull | NestJS `/sync/push`, `/sync/pull?since=` |
| Auth | demo accounts, TOTP step (code `123456`), offline PIN | JWT + rotating refresh, argon2, otplib |
| RBAC | `src/store/rbac.ts` matrix + scope filter + route guards | enforced server-side, mirrored in UI |
| PWA | `public/manifest.webmanifest`, `public/sw.js` app-shell cache | vite-plugin-pwa / Workbox |

## Key business rules (`src/lib/rules.ts`, unit-tested)
- **Stock = sum of the append-only movement ledger.** POS, receiving, adjustments, cycle counts and destruction only append movements.
- **FEFO** allocation skips expired and empty batches, spills across lots.
- **License status**: `REVOKED` › `RENEWAL_PENDING` › `EXPIRED` (<0 d) › `EXPIRING` (≤90 d) › `VALID`.
- **Inspection score** = weighted % of applicable items; any critical "No" ⇒ `FAIL`; ≥80 `PASS`, 60–79 `PASS_WITH_CONDITIONS`.
- **Offline safety**: >7 days unsynced ⇒ banner; >14 days ⇒ controlled-drug sales blocked. Offline controlled sales are flagged "pending verification".
- **Conflicts**: last-write-wins by `version`, then `updatedAt` (losing version kept in audit log).
