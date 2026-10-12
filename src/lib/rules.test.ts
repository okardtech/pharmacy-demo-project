import { describe, expect, it } from 'vitest';
import { allocateFefo, licenseStatus, resolveLww, scoreInspection, stockByBatch, syncRestriction } from './rules';
import type { InspectionTemplate, StockMovement } from '@/data/types';

const now = new Date('2026-10-11T00:00:00+07:00');
const d = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe('licenseStatus', () => {
  it('valid / expiring / expired / pending / revoked', () => {
    expect(licenseStatus({ number: 'x', issueDate: d(-300), expiryDate: d(200) }, now)).toBe('VALID');
    expect(licenseStatus({ number: 'x', issueDate: d(-300), expiryDate: d(30) }, now)).toBe('EXPIRING');
    expect(licenseStatus({ number: 'x', issueDate: d(-300), expiryDate: d(-1) }, now)).toBe('EXPIRED');
    expect(licenseStatus({ number: 'x', issueDate: d(-300), expiryDate: d(30) }, now, true)).toBe('RENEWAL_PENDING');
    expect(licenseStatus({ number: 'x', issueDate: d(-300), expiryDate: d(300), revoked: true }, now)).toBe('REVOKED');
  });
});

describe('stock ledger', () => {
  it('sums movements per batch', () => {
    const mv = (batchId: string, qty: number) => ({ batchId, qty }) as StockMovement;
    const s = stockByBatch([mv('a', 100), mv('a', -30), mv('b', 5), mv('a', -2)]);
    expect(s.get('a')).toBe(68);
    expect(s.get('b')).toBe(5);
  });
});

describe('FEFO', () => {
  const batches = [
    { id: 'late', expiryDate: d(300) },
    { id: 'soon', expiryDate: d(20) },
    { id: 'expired', expiryDate: d(-3) },
  ];
  const bal = new Map([['late', 50], ['soon', 10], ['expired', 99]]);
  it('takes the earliest non-expired batch first and spills over', () => {
    expect(allocateFefo(batches, bal, 15, now)).toEqual([{ batchId: 'soon', qty: 10 }, { batchId: 'late', qty: 5 }]);
  });
  it('never sells expired stock and returns null when short', () => {
    expect(allocateFefo(batches, bal, 61, now)).toBeNull();
  });
});

describe('inspection scoring', () => {
  const tpl: InspectionTemplate = {
    id: 't', name: { lo: '', en: '' }, version: 1,
    sections: [{ id: 's', title: { lo: '', en: '' }, items: [
      { id: 'a', q: { lo: '', en: '' }, evidence: { lo: '', en: '' }, weight: 3, critical: true },
      { id: 'b', q: { lo: '', en: '' }, evidence: { lo: '', en: '' }, weight: 1, critical: false },
    ] }],
  };
  it('passes at 100%', () => expect(scoreInspection(tpl, { a: 'YES', b: 'YES' }).result).toBe('PASS'));
  it('critical NO fails', () => expect(scoreInspection(tpl, { a: 'NO', b: 'YES' }).result).toBe('FAIL'));
  it('NA excluded from denominator', () => expect(scoreInspection(tpl, { a: 'YES', b: 'NA' }).score).toBe(100));
  it('conditional band', () => expect(scoreInspection(tpl, { a: 'YES', b: 'NO' }).result).toBe('PASS_WITH_CONDITIONS'));
});

describe('sync rules', () => {
  it('restricts by days since sync', () => {
    expect(syncRestriction(2)).toBe('OK');
    expect(syncRestriction(8)).toBe('WARN');
    expect(syncRestriction(15)).toBe('BLOCK_CONTROLLED');
  });
  it('LWW picks higher version, then later timestamp', () => {
    const a = { version: 2, updatedAt: '2026-01-01' }, b = { version: 3, updatedAt: '2025-01-01' };
    expect(resolveLww(a, b)[0]).toBe(b);
    const c = { version: 3, updatedAt: '2026-02-01' };
    expect(resolveLww(c, b)[0]).toBe(c);
  });
});
