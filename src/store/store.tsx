import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { generateSeed, DEMO_DEVICE, type Seed } from '@/data/seed';
import type { AuditLog, Collection, Db, Notification, User } from '@/data/types';
import { uuidv7 } from '@/lib/id';
import { addDays, today } from '@/lib/format';
import { REGULATOR_ROLES } from '@/data/types';

/* ------------------------------------------------------------------ types */

export interface OutboxItem {
  id: string;
  op: 'UPSERT' | 'DELETE';
  entity: Collection;
  entityId: string;
  idempotencyKey: string;
  at: string;
  status: 'PENDING' | 'SYNCING' | 'ERROR';
  error?: string;
  label: string;
}

type Overlay = Partial<Record<Collection, Record<string, unknown>>>;

interface State {
  overlay: Overlay;
  outbox: OutboxItem[];
  audit: AuditLog[];
  notifications: Notification[];
  userId?: string;
  lang: 'lo' | 'en';
  theme: 'light' | 'dark' | 'system';
  simulatedOffline: boolean;
  syncing: boolean;
  lastSyncAt: string;
  catalogUpdatedAt: string;
  syncError?: string;
  deviceName: string;
  printer: '80mm' | 'A4';
  pin: string;
}

type Action =
  | { type: 'write'; collection: Collection; record: { id: string } & Record<string, unknown>; label: string; actor: string; before?: unknown; auditAction: AuditLog['action'] }
  | { type: 'login'; userId: string; actorLabel: string }
  | { type: 'logout' }
  | { type: 'set'; patch: Partial<State> }
  | { type: 'syncStart' }
  | { type: 'syncDone'; ids: string[] }
  | { type: 'syncFail'; error: string }
  | { type: 'notify'; n: Notification }
  | { type: 'readAll' }
  | { type: 'reset' };

const KEY = 'laopharm-demo-v1';
const seed: Seed = generateSeed();

function seedAudit(): AuditLog[] {
  const actors = ['u-owner', 'u-pharmacist', 'u-officer', 'u-ministry', 'u-inspector', 'u-staff'];
  const entities: [string, string][] = [['Sale', 'sl-'], ['Batch', 'bt-'], ['Pharmacy', 'ph-'], ['Drug', 'dr-'], ['Inspection', 'in-'], ['RenewalRequest', 'rn-'], ['User', 'u-']];
  const acts: AuditLog['action'][] = ['CREATE', 'UPDATE', 'UPDATE', 'CREATE', 'LOGIN', 'APPROVE', 'DELETE'];
  return Array.from({ length: 160 }, (_, i) => {
    const [e, pre] = entities[(i * 5) % entities.length];
    const action = acts[(i * 3) % acts.length];
    return {
      id: `al-${i}`, at: new Date(Date.now() - i * 37 * 60_000 * 7).toISOString(), actor: actors[i % actors.length], action,
      entity: action === 'LOGIN' ? 'Session' : e, entityId: `${pre}${String((i * 7) % 50 + 1).padStart(3, '0')}`,
      before: action === 'UPDATE' ? { status: 'PENDING', version: 2 } : undefined,
      after: action === 'DELETE' ? undefined : { status: action === 'APPROVE' ? 'APPROVED' : 'ACTIVE', version: 3 },
      device: i % 3 === 0 ? 'D01' : i % 3 === 1 ? 'WEB-GOV-02' : 'TAB-INS-07', ip: `10.20.${i % 8}.${(i * 13) % 250}`,
    };
  });
}

function seedNotifications(): Notification[] {
  const now = Date.now();
  const n = (id: string, mins: number, recipient: Notification['recipient'], type: Notification['type'], title: Notification['title'], body: Notification['body'], link: string, read = false): Notification =>
    ({ id, at: new Date(now - mins * 60_000).toISOString(), recipient, type, title, body, link, read });
  return [
    n('n1', 30, 'pharmacy', 'LICENSE', { lo: 'ໃບອະນຸຍາດໃກ້ໝົດອາຍຸ', en: 'License expiring soon' }, { lo: 'ໃບອະນຸຍາດຂອງທ່ານຈະໝົດອາຍຸໃນ 47 ວັນ. ກະລຸນາຍື່ນຂໍຕໍ່ອາຍຸ.', en: 'Your license expires in 47 days. Please submit a renewal.' }, '/app/license'),
    n('n2', 180, 'pharmacy', 'RECALL', { lo: 'ແຈ້ງເຕືອນຮຽກຄືນຢາ', en: 'Drug recall alert' }, { lo: 'ກະຊວງສາທາລະນະສຸກໄດ້ຮຽກຄືນຢາບາງລາຍການທີ່ທ່ານມີໃນສະຕັອກ.', en: 'The Ministry recalled a product you hold in stock.' }, '/app/stock?filter=recalled'),
    n('n3', 600, 'pharmacy', 'STOCK', { lo: 'ສະຕັອກຕ່ຳ', en: 'Low stock' }, { lo: 'ມີຢາຫຼາຍລາຍການຕ່ຳກວ່າຈຸດສັ່ງຊື້.', en: 'Several items are below reorder level.' }, '/app/stock?filter=low', true),
    n('n4', 45, 'regulator', 'LICENSE', { lo: 'ຄຳຮ້ອງຕໍ່ອາຍຸໃໝ່', en: 'New renewal requests' }, { lo: 'ມີ 6 ຄຳຮ້ອງລໍຖ້າການພິຈາລະນາ.', en: '6 renewal requests are awaiting review.' }, '/gov/renewals'),
    n('n5', 240, 'regulator', 'INSPECTION', { lo: 'ມາດຕະການແກ້ໄຂເກີນກຳນົດ', en: 'Corrective actions overdue' }, { lo: 'ມີມາດຕະການແກ້ໄຂທີ່ເກີນກຳນົດ.', en: 'Some corrective actions are past deadline.' }, '/gov/corrective'),
    n('n6', 900, 'regulator', 'REPORT', { lo: 'ພົບຮູບແບບຜິດປົກກະຕິ', en: 'Unusual pattern detected' }, { lo: 'ການຂາຍຢາຄວບຄຸມຂອງ 2 ຮ້ານສູງກວ່າສະເລ່ຍແຂວງ 3 ເທົ່າ.', en: 'Controlled sales at 2 pharmacies are 3× the province average.' }, '/gov/controlled', true),
  ];
}

function initial(): State {
  const base: State = {
    overlay: {}, outbox: [], audit: seedAudit(), notifications: seedNotifications(), lang: 'lo', theme: 'system',
    simulatedOffline: false, syncing: false, lastSyncAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    catalogUpdatedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), deviceName: 'POS Counter 1', printer: '80mm', pin: '1234',
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<State>), syncing: false };
  } catch { /* storage unavailable: run in-memory */ }
  return base;
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'write': {
      const coll = { ...(s.overlay[a.collection] ?? {}) };
      const prev = coll[a.record.id] as { version?: number } | undefined;
      const now = new Date().toISOString();
      const rec = { ...a.record, updatedAt: now, version: ((prev?.version ?? (a.record as { version?: number }).version) ?? 0) + 1 };
      coll[a.record.id] = rec;
      const ob: OutboxItem = {
        id: uuidv7(), op: 'UPSERT', entity: a.collection, entityId: a.record.id, idempotencyKey: `${a.record.id}:${rec.version}`,
        at: now, status: 'PENDING', label: a.label,
      };
      const log: AuditLog = {
        id: uuidv7(), at: now, actor: a.actor, action: a.auditAction, entity: a.collection, entityId: a.record.id,
        before: a.before, after: rec, device: DEMO_DEVICE, ip: '127.0.0.1',
      };
      return { ...s, overlay: { ...s.overlay, [a.collection]: coll }, outbox: [...s.outbox, ob], audit: [log, ...s.audit].slice(0, 600) };
    }
    case 'login':
      return { ...s, userId: a.userId, audit: [{ id: uuidv7(), at: new Date().toISOString(), actor: a.userId, action: 'LOGIN', entity: 'Session', entityId: a.actorLabel, device: DEMO_DEVICE, ip: '127.0.0.1' }, ...s.audit] };
    case 'logout':
      return { ...s, userId: undefined };
    case 'set':
      return { ...s, ...a.patch };
    case 'syncStart':
      return { ...s, syncing: true, syncError: undefined, outbox: s.outbox.map((o) => (o.status === 'PENDING' ? { ...o, status: 'SYNCING' } : o)) };
    case 'syncDone':
      return { ...s, syncing: false, lastSyncAt: new Date().toISOString(), catalogUpdatedAt: new Date().toISOString(), outbox: s.outbox.filter((o) => !a.ids.includes(o.id)) };
    case 'syncFail':
      return { ...s, syncing: false, syncError: a.error, outbox: s.outbox.map((o) => (o.status === 'SYNCING' ? { ...o, status: 'ERROR', error: a.error } : o)) };
    case 'notify':
      return { ...s, notifications: [a.n, ...s.notifications] };
    case 'readAll':
      return { ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) };
    case 'reset':
      return { ...initial(), overlay: {}, outbox: [], userId: s.userId, lang: s.lang, theme: s.theme };
  }
}

function merge(overlay: Overlay): Db {
  const out = {} as Record<Collection, unknown[]>;
  for (const k of Object.keys(seed) as (keyof Seed)[]) {
    if (k === 'monthly') continue;
    const arr = seed[k] as { id: string }[];
    const patch = overlay[k as Collection];
    if (!patch) { out[k as Collection] = arr; continue; }
    const seen = new Set<string>();
    const merged = arr.map((r) => { const p = patch[r.id]; if (p) { seen.add(r.id); return p; } return r; });
    for (const [id, rec] of Object.entries(patch)) if (!seen.has(id)) merged.push(rec as { id: string });
    out[k as Collection] = merged;
  }
  return out as unknown as Db;
}

/* ------------------------------------------------------------------ context */

interface Ctx {
  state: State;
  db: Db;
  monthly: Seed['monthly'];
  user?: User;
  isRegulator: boolean;
  online: boolean;
  daysSinceSync: number;
  write: <T extends { id: string }>(collection: Collection, record: T, label: string, auditAction?: AuditLog['action']) => void;
  login: (userId: string) => void;
  logout: () => void;
  set: (patch: Partial<State>) => void;
  syncNow: () => void;
  notify: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  readAll: () => void;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const db = useMemo(() => merge(state.overlay), [state.overlay]);
  const user = db.users.find((u) => u.id === state.userId);
  const [netOnline, setNetOnline] = useReducer((_: boolean, v: boolean) => v, typeof navigator === 'undefined' ? true : navigator.onLine);
  const online = netOnline && !state.simulatedOffline;

  useEffect(() => {
    const on = () => setNetOnline(true), off = () => setNetOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // persist
  useEffect(() => {
    try {
      const { syncing: _s, ...rest } = state;
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch { /* quota or private mode — keep running in memory */ }
  }, [state]);

  // theme + lang on <html>
  useEffect(() => {
    const dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.lang = state.lang;
  }, [state.theme, state.lang]);

  const syncNow = useCallback(() => {
    if (!online) return;
    const ids = state.outbox.filter((o) => o.status !== 'SYNCING').map((o) => o.id);
    dispatch({ type: 'syncStart' });
    // Simulated push (batched, idempotent) + pull. Server is the mock seed.
    setTimeout(() => dispatch({ type: 'syncDone', ids }), 900 + Math.min(ids.length, 20) * 60);
  }, [online, state.outbox]);

  // sync engine: on reconnect, focus, and every 60s while online
  useEffect(() => {
    if (online && state.outbox.some((o) => o.status !== 'SYNCING')) syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);
  useEffect(() => {
    const t = setInterval(() => online && syncNow(), 60_000);
    const f = () => online && state.outbox.length && syncNow();
    window.addEventListener('focus', f);
    return () => { clearInterval(t); window.removeEventListener('focus', f); };
  }, [online, syncNow, state.outbox.length]);

  const value: Ctx = {
    state, db, monthly: seed.monthly, user, online,
    isRegulator: !!user && REGULATOR_ROLES.includes(user.role),
    daysSinceSync: Math.floor((Date.now() - new Date(state.lastSyncAt).getTime()) / 86_400_000),
    write: (collection, record, label, auditAction = 'CREATE') => {
      const before = db[collection].find((r) => (r as { id: string }).id === record.id);
      dispatch({ type: 'write', collection, record: record as unknown as { id: string } & Record<string, unknown>, label, actor: state.userId ?? 'anon', before, auditAction: before && auditAction === 'CREATE' ? 'UPDATE' : auditAction });
    },
    login: (userId) => dispatch({ type: 'login', userId, actorLabel: userId }),
    logout: () => dispatch({ type: 'logout' }),
    set: (patch) => dispatch({ type: 'set', patch }),
    syncNow,
    notify: (n) => dispatch({ type: 'notify', n: { ...n, id: uuidv7(), at: new Date().toISOString(), read: false } }),
    readAll: () => dispatch({ type: 'readAll' }),
    reset: () => dispatch({ type: 'reset' }),
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}

/** Helper for "simulate N days without sync" in the Sync center. */
export const staleIso = (days: number) => addDays(today(), -days).toISOString();
