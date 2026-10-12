import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CheckCircle2, PackagePlus, Plus, ScanLine, Trash2 } from 'lucide-react';
import { useStore } from '@/store/store';
import { usePharmacy } from '@/store/selectors';
import { fmtDate, fmtKip } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import { DEMO_DEVICE } from '@/data/seed';
import type { Batch, Drug, GoodsReceipt, StockMovement } from '@/data/types';
import { Alert, Button, Card, DataTable, Field, IconButton, Input, PageHeader, SearchInput, Select, cx, useToast } from '@/components/ui';

interface Line { key: string; drug: Drug; lot: string; expiry: string; qty: string; cost: string; price: string }

export default function Receive() {
  const { t } = useTranslation();
  const toast = useToast();
  const { db, user, write, online } = useStore();
  const ph = usePharmacy();
  const suppliers = db.suppliers.filter((s) => s.pharmacyId === ph.pharmacyId);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [invoice, setInvoice] = useState('');
  const [photo, setPhoto] = useState(false);
  const [q, setQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return db.drugs.filter((d) => d.status === 'APPROVED' && (d.barcode === s || `${d.brand} ${d.generic}`.toLowerCase().includes(s))).slice(0, 6);
  }, [q, db.drugs]);

  const addLine = (d: Drug) => {
    setLines((l) => [...l, { key: uuidv7(), drug: d, lot: '', expiry: '', qty: '', cost: String(Math.round(d.refPrice * 0.72)), price: String(d.refPrice) }]);
    setQ('');
  };
  const upd = (key: string, patch: Partial<Line>) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const lineErr = (l: Line) => !l.lot || !l.expiry || !parseInt(l.qty, 10) || new Date(l.expiry) <= new Date();
  const valid = supplierId && invoice && lines.length > 0 && !lines.some(lineErr);
  const total = lines.reduce((a, l) => a + (parseInt(l.qty, 10) || 0) * (parseInt(l.cost, 10) || 0), 0);

  const post = () => {
    const now = new Date().toISOString();
    const base = { createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, deletedAt: null };
    const grId = uuidv7();
    for (const l of lines) {
      const b: Batch = { ...base, id: uuidv7(), pharmacyId: ph.pharmacyId, drugId: l.drug.id, lot: l.lot, mfgDate: now, expiryDate: new Date(l.expiry).toISOString(), cost: parseInt(l.cost, 10) || 0, price: parseInt(l.price, 10) || 0 };
      write('batches', b, `Batch ${l.lot} · ${l.drug.brand}`);
      const mv: StockMovement = { ...base, id: uuidv7(), pharmacyId: ph.pharmacyId, batchId: b.id, drugId: l.drug.id, type: 'RECEIVE', qty: parseInt(l.qty, 10), ref: grId, device: DEMO_DEVICE, at: now };
      write('movements', mv, `Receive +${l.qty} · ${l.drug.brand}`);
    }
    const gr: GoodsReceipt = { ...base, id: grId, pharmacyId: ph.pharmacyId, supplierId, invoiceNo: invoice, at: now, total, lineCount: lines.length, hasPhoto: photo };
    write('receipts', gr, `Goods receipt ${invoice}`);
    toast(`${t('recv.posted', { n: lines.length })}${online ? '' : ` · ${t('c.savedOffline')}`}`);
    setLines([]); setInvoice(''); setPhoto(false);
  };

  const history = db.receipts.filter((r) => r.pharmacyId === ph.pharmacyId).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-5">
      <PageHeader title={t('recv.title')} />
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t('recv.supplier')} required><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label={t('recv.invoice')} required><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-00000" /></Field>
          <Field label={t('recv.invoicePhoto')}>
            <button type="button" onClick={() => setPhoto(!photo)} className={cx('flex h-11 w-full items-center justify-center gap-2 rounded-ctl border border-dashed text-sm', photo ? 'border-success/50 bg-success/10 text-success' : 'border-border text-muted hover:border-primary/50')}>
              {photo ? <><CheckCircle2 className="h-4 w-4" />invoice.jpg · 312 KB</> : <><Camera className="h-4 w-4" />{t('c.attachPhoto')}</>}
            </button>
          </Field>
        </div>
      </Card>

      <Card title={t('recv.lines')} action={<span className="num text-sm font-semibold">{fmtKip(total)}</span>}>
        <div className="relative mb-4">
          <div className="flex gap-2">
            <SearchInput value={q} onChange={setQ} placeholder={t('pos.searchPlaceholder')} className="flex-1" />
            <Button variant="secondary" icon={ScanLine} onClick={() => { const d = db.drugs.find((x) => x.status === 'APPROVED' && x.category === 'GENERAL' && !lines.some((l) => l.drug.id === x.id)); if (d) addLine(d); }} aria-label={t('pos.scan')}><span className="hidden sm:inline">{t('pos.scan')}</span></Button>
          </div>
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-card border border-border bg-surface shadow-lg">
              {results.map((d) => (
                <li key={d.id}><button onClick={() => addLine(d)} className="flex min-h-[48px] w-full items-center gap-2 px-4 text-left hover:bg-surface-2"><Plus className="h-4 w-4 text-primary" /><span className="font-medium">{d.brand}</span><span className="text-sm text-muted">{d.generic} {d.strength} · {d.regNo}</span></button></li>
              ))}
            </ul>
          )}
          {q.length >= 2 && results.length === 0 && (
            <button className="mt-2 text-sm text-accent hover:underline" onClick={() => toast(t('recv.requestSent'), 'primary')}>{t('recv.notInCatalog')}</button>
          )}
        </div>
        {lines.length === 0 ? (
          <div className="rounded-card border border-dashed border-border py-8 text-center text-sm text-muted"><PackagePlus className="mx-auto mb-2 h-8 w-8 text-primary" />{t('pos.emptyCartHint')}</div>
        ) : (
          <div className="space-y-3">
            {lines.map((l) => {
              const expBad = l.expiry && new Date(l.expiry) <= new Date();
              return (
                <div key={l.key} className="rounded-card border border-border p-3">
                  <div className="mb-2 flex items-center justify-between"><p className="font-medium">{l.drug.brand} <span className="font-normal text-muted">· {l.drug.generic} {l.drug.strength}</span></p><IconButton icon={Trash2} label={t('c.delete')} onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} /></div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Field label={t('stock.lot')} required><Input value={l.lot} onChange={(e) => upd(l.key, { lot: e.target.value.toUpperCase() })} /></Field>
                    <Field label={t('stock.expiry')} required error={expBad ? t('recv.expiredWarn') : undefined}><Input type="date" value={l.expiry} onChange={(e) => upd(l.key, { expiry: e.target.value })} /></Field>
                    <Field label={t('c.qty')} required><Input className="num" inputMode="numeric" value={l.qty} onChange={(e) => upd(l.key, { qty: e.target.value.replace(/\D/g, '') })} /></Field>
                    <Field label={t('recv.costPrice')}><Input className="num" inputMode="numeric" value={l.cost} onChange={(e) => upd(l.key, { cost: e.target.value.replace(/\D/g, '') })} /></Field>
                    <Field label={t('recv.sellPrice')}><Input className="num" inputMode="numeric" value={l.price} onChange={(e) => upd(l.key, { price: e.target.value.replace(/\D/g, '') })} /></Field>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!online && lines.length > 0 && <div className="mt-3"><Alert tone="warning">{t('c.savedOffline')}</Alert></div>}
        <div className="mt-4 flex justify-end"><Button size="lg" icon={PackagePlus} disabled={!valid} onClick={post}>{t('recv.post')}</Button></div>
      </Card>

      <Card title={t('recv.history')} pad={false}>
        <DataTable rows={history} rowKey={(r) => r.id} pageSize={8} columns={[
          { key: 'inv', header: t('recv.invoice'), mobile: 'title', render: (r) => <span className="num font-medium">{r.invoiceNo}</span> },
          { key: 'date', header: t('c.date'), sort: (r) => r.at, render: (r) => <span className="num">{fmtDate(r.at)}</span> },
          { key: 'sup', header: t('recv.supplier'), render: (r) => db.suppliers.find((s) => s.id === r.supplierId)?.name },
          { key: 'lines', header: t('recv.lines'), align: 'right', render: (r) => r.lineCount },
          { key: 'photo', header: t('c.photo'), render: (r) => (r.hasPhoto ? '📎' : '—') },
          { key: 'total', header: t('c.total'), align: 'right', sort: (r) => r.total, render: (r) => fmtKip(r.total) },
        ]} initialSort={{ key: 'date', dir: 'desc' }} />
      </Card>
    </div>
  );
}
