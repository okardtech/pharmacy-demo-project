import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, PackageOpen, SlidersHorizontal } from 'lucide-react';
import { useStore } from '@/store/store';
import { LOW_STOCK, usePharmacy, type DrugStock } from '@/store/selectors';
import { can } from '@/store/rbac';
import { fmtDate, fmtDateTime, fmtKip, fmtNum } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import { DEMO_DEVICE } from '@/data/seed';
import type { StockMovement } from '@/data/types';
import { Badge, Button, Card, DataTable, Dialog, ExpiryBadge, Field, Input, PageHeader, SearchInput, Segmented, Select, StatusBadge, Tabs, Toolbar, useFakeLoading, useToast, type Column } from '@/components/ui';
import { catTone } from './POS';

type Filter = 'all' | 'low' | 'expiring' | 'recalled';

export default function Stock() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { user } = useStore();
  const ph = usePharmacy();
  const loading = useFakeLoading();
  const [q, setQ] = useState(params.get('q') ?? '');
  const filter = (params.get('filter') as Filter) ?? 'all';
  const [open, setOpen] = useState<DrugStock | null>(null);
  const [countOpen, setCountOpen] = useState(false);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return ph.stock.filter((x) => {
      if (s && !`${x.drug.brand} ${x.drug.generic} ${x.drug.barcode}`.toLowerCase().includes(s)) return false;
      if (filter === 'low') return x.qty > 0 && x.qty <= LOW_STOCK;
      if (filter === 'expiring') return x.nearest !== undefined && x.nearest <= 90;
      if (filter === 'recalled') return x.drug.status !== 'APPROVED';
      return true;
    });
  }, [ph.stock, q, filter]);

  const cols: Column<DrugStock>[] = [
    { key: 'drug', header: t('stock.drug'), mobile: 'title', sort: (r) => r.drug.brand, render: (r) => (
      <div className="min-w-0"><p className="font-medium">{r.drug.brand}</p><p className="text-xs text-muted">{r.drug.generic} {r.drug.strength} · {r.drug.form}</p></div>
    ) },
    { key: 'cat', header: t('cat.category'), render: (r) => <div className="flex flex-wrap gap-1"><Badge tone={catTone(r.drug.category)} icon={null}>{t(`cat.${r.drug.category}`)}</Badge>{r.drug.status !== 'APPROVED' && <StatusBadge status={r.drug.status} />}</div> },
    { key: 'qty', header: t('stock.onHand'), align: 'right', sort: (r) => r.qty, render: (r) => (
      <span className="inline-flex items-center gap-2">{r.qty <= 0 ? <Badge tone="danger">{t('st.outOfStock')}</Badge> : r.qty <= LOW_STOCK ? <Badge tone="warning">{t('st.lowStock')}</Badge> : null}<span className="num font-semibold">{fmtNum(r.qty)}</span></span>
    ) },
    { key: 'batches', header: t('stock.batches'), align: 'right', render: (r) => <span className="num">{r.batches.filter((b) => b.qty > 0).length}</span>, mobile: 'hide' },
    { key: 'exp', header: t('stock.nearestExpiry'), sort: (r) => r.nearest ?? 99999, render: (r) => (r.nearest === undefined ? '—' : <ExpiryBadge days={r.nearest} />) },
    { key: 'value', header: t('stock.value'), align: 'right', sort: (r) => r.value, render: (r) => fmtKip(r.value), mobile: 'hide' },
  ];

  return (
    <div>
      <PageHeader title={t('stock.title')} subtitle={t('stock.ledgerNote')}
        actions={can(user, 'stock.adjust') && <Button variant="secondary" icon={ClipboardCheck} onClick={() => setCountOpen(true)}>{t('stock.count')}</Button>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} className="sm:w-80" />
          <div className="overflow-x-auto">
            <Segmented value={filter} onChange={(v) => { const p = new URLSearchParams(params); if (v === 'all') p.delete('filter'); else p.set('filter', v); setParams(p, { replace: true }); }}
              options={[{ value: 'all', label: t('c.all') }, { value: 'low', label: t('stock.filterLow') }, { value: 'expiring', label: t('stock.filterExpiring') }, { value: 'recalled', label: t('stock.filterRecalled') }]} />
          </div>
          <span className="num text-sm text-muted sm:ml-auto">{t('rep.records', { n: rows.length })}</span>
        </Toolbar>
        <DataTable loading={loading} rows={rows} columns={cols} rowKey={(r) => r.drug.id} onRowClick={setOpen} initialSort={{ key: 'drug', dir: 'asc' }}
          empty={<EmptyFiltered onClear={() => { setQ(''); setParams({}); }} />} />
      </Card>
      {open && <DrugDetail stock={ph.stock.find((s) => s.drug.id === open.drug.id) ?? open} onClose={() => setOpen(null)} />}
      {countOpen && <CycleCount onClose={() => setCountOpen(false)} />}
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <PackageOpen className="mb-2 h-10 w-10 text-primary" />
      <p className="font-medium">{t('c.noResults')}</p><p className="text-sm text-muted">{t('c.noResultsHint')}</p>
      <Button className="mt-3" variant="secondary" onClick={onClear}>{t('c.clearFilters')}</Button>
    </div>
  );
}

function DrugDetail({ stock, onClose }: { stock: DrugStock; onClose: () => void }) {
  const { t } = useTranslation();
  const { user, write } = useStore();
  const ph = usePharmacy();
  const toast = useToast();
  const [tab, setTab] = useState<'batches' | 'moves'>('batches');
  const [adj, setAdj] = useState<{ batchId: string; qty: string; reason: string } | null>(null);
  const moves = ph.movements.filter((m) => m.drugId === stock.drug.id).sort((a, b) => b.at.localeCompare(a.at));

  const postAdjust = () => {
    if (!adj) return;
    const qty = parseInt(adj.qty, 10);
    if (!qty || !adj.reason) return;
    const now = new Date().toISOString();
    const mv: StockMovement = { id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, pharmacyId: ph.pharmacyId, batchId: adj.batchId, drugId: stock.drug.id, type: 'ADJUST', qty, ref: `ADJ-${Date.now().toString(36).toUpperCase()}`, reason: adj.reason, device: DEMO_DEVICE, at: now };
    write('movements', mv, `Adjust ${qty > 0 ? '+' : ''}${qty} · ${stock.drug.brand}`);
    toast(t('c.saved'));
    setAdj(null);
  };

  return (
    <Dialog open onClose={onClose} title={`${stock.drug.brand} · ${stock.drug.strength}`} wide>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[t('stock.onHand'), fmtNum(stock.qty)], [t('stock.value'), fmtKip(stock.value)], [t('cat.regNo'), stock.drug.regNo], [t('cat.barcode'), stock.drug.barcode]].map(([k, v]) => (
          <div key={k} className="rounded-ctl bg-surface-2 p-3"><p className="text-xs text-muted">{k}</p><p className="num truncate font-semibold">{v}</p></div>
        ))}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'batches', label: t('stock.batches'), count: stock.batches.length }, { value: 'moves', label: t('stock.movements'), count: moves.length }]} />
      {tab === 'batches' ? (
        <div className="space-y-2">
          {stock.batches.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-ctl border border-border p-3">
              <div className="min-w-0 flex-1"><p className="num font-medium">{b.lot}</p><p className="num text-xs text-muted">{t('stock.expiry')}: {fmtDate(b.expiryDate)} · {t('c.price')}: {fmtKip(b.price)}</p></div>
              <ExpiryBadge days={b.days} />
              <span className="num w-16 text-right font-semibold">{fmtNum(b.qty)}</span>
              {can(user, 'stock.adjust') && <Button size="sm" variant="secondary" icon={SlidersHorizontal} onClick={() => setAdj({ batchId: b.id, qty: '', reason: '' })}>{t('stock.adjust')}</Button>}
            </div>
          ))}
          {adj && (
            <div className="grid gap-3 rounded-card border border-primary/30 bg-primary-soft/30 p-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
              <Field label={t('stock.adjustQty')} required><Input className="num" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value.replace(/[^\d-]/g, '') })} placeholder="-2" /></Field>
              <Field label={t('c.reason')} required error={!adj.reason && adj.qty ? t('stock.reasonRequired') : undefined}>
                <Select value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })}>
                  <option value="">—</option>
                  {['damaged', 'lost', 'found', 'count'].map((r) => <option key={r} value={t(`stock.reasons.${r}`)}>{t(`stock.reasons.${r}`)}</option>)}
                </Select>
              </Field>
              <div className="flex gap-2"><Button variant="secondary" onClick={() => setAdj(null)}>{t('c.cancel')}</Button><Button disabled={!parseInt(adj.qty, 10) || !adj.reason} onClick={postAdjust}>{t('c.save')}</Button></div>
            </div>
          )}
        </div>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto text-sm">
          {moves.slice(0, 120).map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <Badge tone={m.qty > 0 ? 'success' : m.type === 'SALE' ? 'neutral' : 'warning'} icon={null}>{t(`mv.${m.type}`)}</Badge>
              <span className="num flex-1 truncate text-muted">{fmtDateTime(m.at)} · {ph.batches.find((b) => b.id === m.batchId)?.lot}{m.reason ? ` · ${m.reason}` : ''}</span>
              <span className={`num font-semibold ${m.qty > 0 ? 'text-success' : ''}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function CycleCount({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user, write } = useStore();
  const ph = usePharmacy();
  const toast = useToast();
  const items = useMemo(() => ph.stock.filter((s) => s.qty > 0).flatMap((s) => s.batches.filter((b) => b.qty > 0).map((b) => ({ s, b }))).slice(0, 10), [ph.stock]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const post = () => {
    let n = 0;
    const now = new Date().toISOString();
    for (const { s, b } of items) {
      const c = counts[b.id];
      if (c === undefined || c === '') continue;
      const diff = parseInt(c, 10) - b.qty;
      if (!diff) continue;
      n++;
      write('movements', { id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, pharmacyId: ph.pharmacyId, batchId: b.id, drugId: s.drug.id, type: 'ADJUST', qty: diff, ref: 'COUNT', reason: t('stock.reasons.count'), device: DEMO_DEVICE, at: now } satisfies StockMovement, `Count ${s.drug.brand} ${diff > 0 ? '+' : ''}${diff}`);
    }
    toast(t('stock.countPosted', { n }));
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={t('stock.countTitle')} wide footer={<><Button variant="secondary" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={post}>{t('stock.postCount')}</Button></>}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-2">{t('stock.drug')}</th><th>{t('stock.lot')}</th><th className="text-right">{t('stock.system')}</th><th className="text-right">{t('stock.counted')}</th><th className="text-right">{t('stock.variance')}</th></tr></thead>
          <tbody>
            {items.map(({ s, b }) => {
              const c = counts[b.id];
              const v = c ? parseInt(c, 10) - b.qty : 0;
              return (
                <tr key={b.id} className="border-t border-border">
                  <td className="py-2 pr-2">{s.drug.brand}</td><td className="num">{b.lot}</td><td className="num text-right">{b.qty}</td>
                  <td className="py-1 text-right"><Input className="num ml-auto h-9 w-20 text-right" inputMode="numeric" value={c ?? ''} onChange={(e) => setCounts({ ...counts, [b.id]: e.target.value.replace(/\D/g, '') })} aria-label={t('stock.counted')} /></td>
                  <td className={`num text-right font-semibold ${v < 0 ? 'text-danger' : v > 0 ? 'text-success' : 'text-muted'}`}>{c ? (v > 0 ? `+${v}` : v) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}
