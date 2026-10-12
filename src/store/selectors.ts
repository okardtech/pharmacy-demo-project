import { useMemo } from 'react';
import { useStore } from './store';
import { DEMO_PHARMACY_ID } from '@/data/seed';
import { daysToExpiry, licenseStatus, stockByBatch } from '@/lib/rules';
import { today } from '@/lib/format';
import type { Batch, Drug, Pharmacy } from '@/data/types';

export const LOW_STOCK = 40;

export interface DrugStock { drug: Drug; qty: number; batches: (Batch & { qty: number; days: number })[]; nearest?: number; value: number }

/** Everything the pharmacy app derives from the local DB (stock = sum of ledger). */
export function usePharmacy() {
  const { db, user } = useStore();
  const pharmacyId = user?.pharmacyId ?? DEMO_PHARMACY_ID;
  return useMemo(() => {
    const now = today();
    const pharmacy = db.pharmacies.find((p) => p.id === pharmacyId)!;
    const drugMap = new Map(db.drugs.map((d) => [d.id, d]));
    const movements = db.movements.filter((m) => m.pharmacyId === pharmacyId);
    const balance = stockByBatch(movements);
    const batches = db.batches.filter((b) => b.pharmacyId === pharmacyId);
    const byDrug = new Map<string, DrugStock>();
    for (const b of batches) {
      const drug = drugMap.get(b.drugId);
      if (!drug) continue;
      const qty = balance.get(b.id) ?? 0;
      const e = byDrug.get(b.drugId) ?? { drug, qty: 0, batches: [], value: 0 };
      const days = daysToExpiry(b.expiryDate, now);
      e.batches.push({ ...b, qty, days });
      e.qty += qty;
      e.value += qty * b.cost;
      if (qty > 0 && (e.nearest === undefined || days < e.nearest)) e.nearest = days;
      byDrug.set(b.drugId, e);
    }
    const stock = [...byDrug.values()];
    stock.forEach((s) => s.batches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)));
    const sales = db.sales.filter((s) => s.pharmacyId === pharmacyId);
    const pendingRenewal = db.renewals.some((r) => r.pharmacyId === pharmacyId && r.status === 'PENDING');
    return {
      now, pharmacy, pharmacyId, drugMap, movements, balance, batches, stock, sales,
      licenseStatus: licenseStatus(pharmacy.license, now, pendingRenewal),
      licenseDays: daysToExpiry(pharmacy.license.expiryDate, now),
      lowStock: stock.filter((s) => s.qty > 0 && s.qty <= LOW_STOCK && s.drug.status === 'APPROVED').sort((a, b) => a.qty - b.qty),
      nearExpiry: stock.flatMap((s) => s.batches.filter((b) => b.qty > 0 && b.days <= 90).map((b) => ({ ...b, drug: s.drug }))).sort((a, b) => a.days - b.days),
      flagged: stock.filter((s) => s.qty > 0 && s.drug.status !== 'APPROVED'),
    };
  }, [db, pharmacyId]);
}

/** Pharmacies with derived license status + last inspection, for the regulator console. */
export function useRegistry() {
  const { db } = useStore();
  return useMemo(() => {
    const now = today();
    const pending = new Set(db.renewals.filter((r) => r.status === 'PENDING').map((r) => r.pharmacyId));
    const lastInsp = new Map<string, (typeof db.inspections)[number]>();
    for (const i of db.inspections) {
      if (i.status !== 'COMPLETED') continue;
      const cur = lastInsp.get(i.pharmacyId);
      if (!cur || cur.date < i.date) lastInsp.set(i.pharmacyId, i);
    }
    return db.pharmacies.map((p) => ({
      ...p,
      lic: licenseStatus(p.license, now, pending.has(p.id)),
      licDays: daysToExpiry(p.license.expiryDate, now),
      last: lastInsp.get(p.id),
    }));
  }, [db]);
}
export type RegistryRow = Pharmacy & { lic: ReturnType<typeof licenseStatus>; licDays: number; last?: { date: string; result?: string; score?: number } };

/** Controlled-drug anomaly: last-3-month volume vs. province average (threshold 2×). */
export function useAnomalies(threshold = 2) {
  const { db, monthly } = useStore();
  return useMemo(() => {
    const months = [...new Set(monthly.map((m) => m.month))].sort().slice(-3);
    const vol = new Map<string, number>();
    for (const m of monthly) if (months.includes(m.month)) vol.set(m.pharmacyId, (vol.get(m.pharmacyId) ?? 0) + m.controlledUnits);
    const out: { pharmacyId: string; provinceId: string; units: number; avg: number; ratio: number }[] = [];
    for (const p of db.pharmacies) {
      const peers = db.pharmacies.filter((x) => x.provinceId === p.provinceId && x.id !== p.id);
      const units = vol.get(p.id) ?? 0;
      const avg = peers.length ? peers.reduce((a, x) => a + (vol.get(x.id) ?? 0), 0) / peers.length : units;
      const ratio = avg ? units / avg : 1;
      if (ratio >= threshold) out.push({ pharmacyId: p.id, provinceId: p.provinceId, units, avg: Math.round(avg), ratio: +ratio.toFixed(1) });
    }
    return out.sort((a, b) => b.ratio - a.ratio);
  }, [db.pharmacies, monthly]);
}
