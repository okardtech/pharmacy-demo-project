import type { Answer, Batch, InspectionResult, InspectionTemplate, LicenseStatus, PharmacyLicense, StockMovement } from '@/data/types';

const DAY = 86_400_000;

/** License status derived from dates + workflow flags. EXPIRING = within 90 days. */
export function licenseStatus(l: PharmacyLicense, now: Date, renewalPending = false): LicenseStatus {
  if (l.revoked) return 'REVOKED';
  const days = Math.ceil((new Date(l.expiryDate).getTime() - now.getTime()) / DAY);
  if (renewalPending) return 'RENEWAL_PENDING';
  if (days < 0) return 'EXPIRED';
  if (days <= 90) return 'EXPIRING';
  return 'VALID';
}

export const daysToExpiry = (iso: string, now: Date) => Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY);

/** Current stock = sum of the append-only movement ledger. */
export function stockByBatch(movements: StockMovement[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const mv of movements) m.set(mv.batchId, (m.get(mv.batchId) ?? 0) + mv.qty);
  return m;
}

export interface FefoPick { batchId: string; qty: number }

/**
 * First-expiry-first-out allocation. Skips expired batches and empty batches.
 * Returns null if total sellable stock is insufficient.
 */
export function allocateFefo(
  batches: Pick<Batch, 'id' | 'expiryDate'>[],
  balance: Map<string, number>,
  qty: number,
  now: Date,
): FefoPick[] | null {
  const sellable = batches
    .filter((b) => new Date(b.expiryDate).getTime() > now.getTime() && (balance.get(b.id) ?? 0) > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const picks: FefoPick[] = [];
  let left = qty;
  for (const b of sellable) {
    if (left <= 0) break;
    const take = Math.min(left, balance.get(b.id) ?? 0);
    picks.push({ batchId: b.id, qty: take });
    left -= take;
  }
  return left > 0 ? null : picks;
}

/**
 * Inspection score: weighted % of applicable items answered YES.
 * Any critical item answered NO → FAIL regardless of score.
 */
export function scoreInspection(
  tpl: InspectionTemplate,
  answers: Record<string, Answer>,
): { score: number; result: InspectionResult; criticalFails: number; answered: number; total: number } {
  let got = 0, max = 0, criticalFails = 0, answered = 0, total = 0;
  for (const s of tpl.sections)
    for (const it of s.items) {
      total++;
      const a = answers[it.id];
      if (!a) continue;
      answered++;
      if (a === 'NA') continue;
      max += it.weight;
      if (a === 'YES') got += it.weight;
      else if (it.critical) criticalFails++;
    }
  const score = max === 0 ? 0 : Math.round((got / max) * 100);
  const result: InspectionResult = criticalFails > 0 || score < 60 ? 'FAIL' : score < 80 ? 'PASS_WITH_CONDITIONS' : 'PASS';
  return { score, result, criticalFails, answered, total };
}

/** Offline safety: days since last successful sync. */
export function syncRestriction(daysSinceSync: number): 'OK' | 'WARN' | 'BLOCK_CONTROLLED' {
  if (daysSinceSync > 14) return 'BLOCK_CONTROLLED';
  if (daysSinceSync > 7) return 'WARN';
  return 'OK';
}

/** Last-write-wins by version; returns [winner, loser]. */
export function resolveLww<T extends { version: number; updatedAt: string }>(local: T, remote: T): [T, T] {
  if (local.version !== remote.version) return local.version > remote.version ? [local, remote] : [remote, local];
  return local.updatedAt >= remote.updatedAt ? [local, remote] : [remote, local];
}
