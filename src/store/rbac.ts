import type { Pharmacy, Role, User } from '@/data/types';

export type Perm =
  | 'pos.sell'
  | 'pos.sellRx'
  | 'stock.view'
  | 'stock.receive'
  | 'stock.adjust'
  | 'staff.manage'
  | 'license.renew'
  | 'reports.pharmacy'
  | 'registry.view'
  | 'registry.edit'
  | 'license.approve'
  | 'catalog.edit'
  | 'inspection.run'
  | 'inspection.plan'
  | 'users.manage'
  | 'audit.view'
  | 'settings.system';

const MATRIX: Record<Role, Perm[]> = {
  SUPER_ADMIN: ['registry.view', 'registry.edit', 'license.approve', 'catalog.edit', 'inspection.plan', 'inspection.run', 'users.manage', 'audit.view', 'settings.system'],
  MINISTRY_ADMIN: ['registry.view', 'registry.edit', 'license.approve', 'catalog.edit', 'inspection.plan', 'users.manage', 'audit.view'],
  PROVINCIAL_OFFICER: ['registry.view', 'registry.edit', 'license.approve', 'inspection.plan', 'audit.view'],
  INSPECTOR: ['registry.view', 'inspection.run'],
  PHARMACY_OWNER: ['pos.sell', 'pos.sellRx', 'stock.view', 'stock.receive', 'stock.adjust', 'staff.manage', 'license.renew', 'reports.pharmacy'],
  PHARMACIST: ['pos.sell', 'pos.sellRx', 'stock.view', 'stock.receive', 'reports.pharmacy'],
  STAFF: ['pos.sell', 'stock.view'],
};

export const can = (user: User | undefined, perm: Perm) => !!user && MATRIX[user.role].includes(perm);

/** Data scoping: national / province / pharmacy. Mirrors what the API would enforce server-side. */
export function scopePharmacies(user: User | undefined, list: Pharmacy[]): Pharmacy[] {
  if (!user) return [];
  if (user.role === 'SUPER_ADMIN' || user.role === 'MINISTRY_ADMIN') return list;
  if (user.role === 'PROVINCIAL_OFFICER' || user.role === 'INSPECTOR') return list.filter((p) => p.provinceId === user.provinceId);
  return list.filter((p) => p.id === user.pharmacyId);
}
