import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Ban, Camera, CreditCard, FileText, Printer, QrCode, ScanLine, Share2, ShieldAlert, ShoppingCart, Trash2, Wallet, X } from 'lucide-react';
import { useStore } from '@/store/store';
import { usePharmacy } from '@/store/selectors';
import { can } from '@/store/rbac';
import { allocateFefo, syncRestriction, type FefoPick } from '@/lib/rules';
import { fmtDate, fmtDateTime, fmtKip, ymd } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import { DEMO_DEVICE } from '@/data/seed';
import type { Customer, Drug, PaymentMethod, Prescription, Sale, StockMovement } from '@/data/types';
import { Alert, Badge, Button, Dialog, EmptyState, Field, IconButton, Input, Select, Stepper, cx, useToast } from '@/components/ui';
import { useL } from '@/i18n';
import { RxForm, emptyRx, rxValid, type RxDraft } from './RxForm';

interface CartLine { drug: Drug; qty: number }

export const catTone = (c: Drug['category']) => (c === 'CONTROLLED' ? 'danger' : c === 'DANGEROUS' ? 'warning' : c === 'PRESCRIPTION_ONLY' ? 'accent' : 'neutral');

export default function POS() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { user, db, write, online, daysSinceSync, state } = useStore();
  const ph = usePharmacy();
  const searchRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLElement>(null);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [rx, setRx] = useState<RxDraft | null>(null);
  const [rxOpen, setRxOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [received, setReceived] = useState('');
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const stockOf = (id: string) => ph.stock.find((s) => s.drug.id === id);
  const customers = db.customers.filter((c) => c.pharmacyId === ph.pharmacyId);
  const customer: Customer | undefined = customers.find((c) => c.id === customerId);
  const restriction = syncRestriction(daysSinceSync);
  const catalogHours = Math.max(0, Math.round((Date.now() - new Date(state.catalogUpdatedAt).getTime()) / 3_600_000));

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return ph.stock
      .filter((x) => x.drug.barcode === s || x.drug.brand.toLowerCase().includes(s) || x.drug.generic.toLowerCase().includes(s))
      .sort((a, b) => (b.qty > 0 ? 1 : 0) - (a.qty > 0 ? 1 : 0))
      .slice(0, 8);
  }, [q, ph.stock]);
  useEffect(() => setHi(0), [q]);

  const allocations = useMemo(() => {
    const m = new Map<string, FefoPick[] | null>();
    for (const l of cart) m.set(l.drug.id, allocateFefo(stockOf(l.drug.id)?.batches ?? [], ph.balance, l.qty, ph.now));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, ph.balance]);

  const priceOf = (l: CartLine) => {
    const picks = allocations.get(l.drug.id);
    const bs = stockOf(l.drug.id)?.batches ?? [];
    if (!picks) return l.qty * (bs[0]?.price ?? l.drug.refPrice);
    return picks.reduce((a, p) => a + p.qty * (bs.find((b) => b.id === p.batchId)?.price ?? 0), 0);
  };
  const subtotal = cart.reduce((a, l) => a + priceOf(l), 0);
  const total = Math.max(0, subtotal - discount);
  const needsRx = cart.some((l) => l.drug.category !== 'GENERAL');
  const hasControlled = cart.some((l) => l.drug.category === 'CONTROLLED');
  const allergyHits = customer ? cart.flatMap((l) => customer.allergies.filter((a) => l.drug.ingredients.some((i) => i.includes(a.toLowerCase())) || l.drug.generic.toLowerCase().includes(a.toLowerCase())).map((a) => `${a} (${l.drug.brand})`)) : [];
  const shortage = cart.some((l) => !allocations.get(l.drug.id));
  const blocked = (needsRx && !can(user, 'pos.sellRx')) || (hasControlled && restriction === 'BLOCK_CONTROLLED');
  const rxOk = !needsRx || (rx && rxValid(rx, hasControlled));
  const canPay = cart.length > 0 && !shortage && !blocked && rxOk;

  const add = (drug: Drug) => {
    if (drug.status !== 'APPROVED') { toast(t('pos.banned', { status: t(`st.${drug.status}`) }), 'danger'); return; }
    if (drug.category !== 'GENERAL' && !can(user, 'pos.sellRx')) { toast(t('pos.staffNoRx'), 'warning'); return; }
    setCart((c) => {
      const ex = c.find((x) => x.drug.id === drug.id);
      return ex ? c.map((x) => (x === ex ? { ...x, qty: x.qty + 1 } : x)) : [...c, { drug, qty: 1 }];
    });
    setQ('');
    searchRef.current?.focus();
  };

  const reset = () => { setCart([]); setRx(null); setDiscount(0); setCustomerId(''); setReceived(''); setMethod('CASH'); searchRef.current?.focus(); };

  const complete = () => {
    const now = new Date();
    const saleId = uuidv7();
    const seq = ph.sales.filter((s) => ymd(new Date(s.at)) === ymd(now)).length + 1;
    const receiptNo = `${DEMO_DEVICE}-${ymd(now)}-${String(seq).padStart(4, '0')}`;
    const lines: Sale['lines'] = [];
    for (const l of cart) for (const p of allocations.get(l.drug.id)!) {
      const b = ph.batches.find((x) => x.id === p.batchId)!;
      lines.push({ drugId: l.drug.id, batchId: p.batchId, qty: p.qty, price: b.price, cost: b.cost });
    }
    const baseRec = { createdAt: now.toISOString(), updatedAt: now.toISOString(), createdBy: user!.id, version: 0, deletedAt: null };
    let prescriptionId: string | undefined;
    if (needsRx && rx) {
      prescriptionId = uuidv7();
      const pr: Prescription = { ...baseRec, id: prescriptionId, pharmacyId: ph.pharmacyId, ...rx, patientAge: Number(rx.patientAge), date: now.toISOString(), saleId, drugIds: cart.filter((l) => l.drug.category !== 'GENERAL').map((l) => l.drug.id) };
      write('prescriptions', pr, `Prescription · ${rx.patientName}`);
    }
    const sale: Sale = {
      ...baseRec, id: saleId, pharmacyId: ph.pharmacyId, receiptNo, at: now.toISOString(), cashier: user!.id, method, lines, subtotal, discount, total,
      customerId: customerId || undefined, prescriptionId, pendingVerification: hasControlled && !online,
    };
    write('sales', sale, `Sale ${receiptNo} · ${fmtKip(total)}`);
    lines.forEach((ln) => {
      const mv: StockMovement = { ...baseRec, id: uuidv7(), pharmacyId: ph.pharmacyId, batchId: ln.batchId, drugId: ln.drugId, type: 'SALE', qty: -ln.qty, ref: saleId, device: DEMO_DEVICE, at: now.toISOString() };
      write('movements', mv, `Stock −${ln.qty} · ${db.drugs.find((d) => d.id === ln.drugId)?.brand}`);
    });
    setPayOpen(false);
    setReceipt(sale);
    toast(online ? t('pos.saleDone', { no: receiptNo }) : `${t('pos.saleDone', { no: receiptNo })} · ${t('c.savedOffline')}`);
    reset();
  };

  // keyboard: F2 search, F9 pay, Esc clear
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F9') { e.preventDefault(); if (canPay) setPayOpen(true); else if (needsRx && !rxOk) setRxOpen(true); }
      if (e.key === 'Escape' && !payOpen && !rxOpen && !receipt && q) setQ('');
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [canPay, needsRx, rxOk, payOpen, rxOpen, receipt, q]);
  useEffect(() => searchRef.current?.focus(), []);

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const exact = ph.stock.find((x) => x.drug.barcode === q.trim());
      const pickd = exact ?? results[hi];
      if (pickd) add(pickd.drug);
    }
  };

  const change = Math.max(0, (parseInt(received.replace(/\D/g, ''), 10) || 0) - total);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      {/* left: search & results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('nav.pos')}</h1>
          <span className="hidden text-xs text-muted sm:block">{t('pos.shortcuts')}</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder={t('pos.searchPlaceholder')}
              className="h-14 pl-11 text-base" aria-label={t('pos.searchPlaceholder')} role="combobox" aria-expanded={results.length > 0} aria-controls="pos-results" />
          </div>
          <Button variant="secondary" size="xl" icon={Camera} onClick={() => setScanOpen(true)} aria-label={t('pos.scan')}><span className="hidden sm:inline">{t('pos.scan')}</span></Button>
        </div>
        <p className="text-xs text-muted">{t('sync.catalogAge', { h: catalogHours })}</p>

        {results.length > 0 ? (
          <ul id="pos-results" role="listbox" className="overflow-hidden rounded-card border border-border bg-surface shadow-soft">
            {results.map((r, i) => {
              const disabled = r.drug.status !== 'APPROVED' || r.qty <= 0;
              return (
                <li key={r.drug.id} role="option" aria-selected={i === hi}>
                  <button disabled={disabled} onClick={() => add(r.drug)} onMouseEnter={() => setHi(i)}
                    className={cx('flex min-h-[56px] w-full items-center gap-3 border-b border-border px-4 py-2 text-left last:border-0 disabled:cursor-not-allowed disabled:opacity-60', i === hi && 'bg-primary-soft/50')}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.drug.brand} <span className="font-normal text-muted">· {r.drug.generic} {r.drug.strength}</span></p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {r.drug.category !== 'GENERAL' && <Badge tone={catTone(r.drug.category)} icon={r.drug.category === 'CONTROLLED' ? ShieldAlert : FileText}>{t(`cat.${r.drug.category}`)}</Badge>}
                        {r.drug.status !== 'APPROVED' && <Badge tone="danger" icon={Ban}>{t(`st.${r.drug.status}`)}</Badge>}
                        <span className="num text-xs text-muted">{r.drug.barcode}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="num font-semibold">{fmtKip(r.batches[0]?.price ?? r.drug.refPrice)}</p>
                      <p className={cx('num text-xs', r.qty <= 0 ? 'text-danger' : r.qty <= 40 ? 'text-warning' : 'text-muted')}>{r.qty <= 0 ? t('st.outOfStock') : t('pos.stockLeft', { n: r.qty })}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {ph.stock.filter((s) => s.qty > 50 && s.drug.status === 'APPROVED' && (s.drug.category === 'GENERAL' || can(user, 'pos.sellRx'))).slice(0, 12).map((s) => (
              <button key={s.drug.id} onClick={() => add(s.drug)} className="min-h-[72px] rounded-card border border-border bg-surface p-3 text-left shadow-soft hover:border-primary/50 active:scale-[.98]">
                <p className="truncate text-sm font-medium">{s.drug.brand}</p>
                <p className="truncate text-xs text-muted">{s.drug.strength} · {s.drug.form}</p>
                <p className="num mt-1 text-sm font-semibold text-primary">{fmtKip(s.batches[0]?.price ?? s.drug.refPrice)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* right: cart */}
      <aside ref={cartRef} className="flex scroll-mt-20 flex-col rounded-card border border-border bg-surface shadow-soft lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-5 w-5" />{t('pos.cart')} <span className="num text-muted">({cart.length})</span></h2>
          {cart.length > 0 && <Button size="sm" variant="ghost" icon={Trash2} onClick={reset}>{t('pos.clear')}</Button>}
        </header>
        <div className="border-b border-border px-4 py-3">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} aria-label={t('pos.customer')}>
            <option value="">{t('pos.walkIn')}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.allergies.length ? ` · ⚠ ${c.allergies.join(', ')}` : ''}</option>)}
          </Select>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {allergyHits.length > 0 && <Alert tone="danger" icon={AlertTriangle}>{t('pos.allergy', { a: allergyHits.join(', ') })}</Alert>}
          {cart.length === 0 && <EmptyState icon={ShoppingCart} title={t('pos.emptyCart')} hint={t('pos.emptyCartHint')} />}
          {cart.map((l) => {
            const picks = allocations.get(l.drug.id);
            const bs = stockOf(l.drug.id)?.batches ?? [];
            const first = picks?.[0] && bs.find((b) => b.id === picks[0].batchId);
            return (
              <div key={l.drug.id} className="rounded-ctl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.drug.brand}</p>
                    <p className="truncate text-xs text-muted">{l.drug.generic} {l.drug.strength}</p>
                  </div>
                  <IconButton icon={X} label={t('c.delete')} className="-mr-2 -mt-2 h-9 w-9" onClick={() => setCart((c) => c.filter((x) => x !== l))} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Stepper value={l.qty} onChange={(n) => setCart((c) => c.map((x) => (x === l ? { ...x, qty: n } : x)))} />
                  <p className="num font-semibold">{fmtKip(priceOf(l))}</p>
                </div>
                <p className={cx('mt-1.5 text-xs', picks ? 'text-muted' : 'text-danger')}>
                  {!picks ? `✕ ${t('pos.insufficient')}` : picks.length > 1 ? t('pos.fefoMulti', { n: picks.length }) : first ? t('pos.fefo', { lot: first.lot, exp: fmtDate(first.expiryDate) }) : ''}
                </p>
                {l.drug.category !== 'GENERAL' && <Badge className="mt-1.5" tone={catTone(l.drug.category)}>{t(`cat.${l.drug.category}`)}</Badge>}
              </div>
            );
          })}
        </div>
        <footer className="space-y-3 border-t border-border p-4">
          {needsRx && (
            <button onClick={() => setRxOpen(true)} className={cx('flex w-full items-center gap-3 rounded-ctl border px-3 py-2.5 text-left text-sm', rxOk ? 'border-success/30 bg-success/10' : 'border-warning/40 bg-warning/10')}>
              <FileText className={cx('h-5 w-5', rxOk ? 'text-success' : 'text-warning')} />
              <span className="flex-1 font-medium">{rxOk ? `✓ ${t('pos.rxAttached')} · ${rx?.patientName}` : `⚠ ${t('pos.needsRx')} — ${t('pos.addRx')}`}</span>
            </button>
          )}
          {hasControlled && restriction === 'BLOCK_CONTROLLED' && <Alert tone="danger">{t('pos.controlledBlocked')}</Alert>}
          {hasControlled && !online && restriction !== 'BLOCK_CONTROLLED' && <Alert tone="warning">{t('pos.pendingVerif')}</Alert>}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">{t('pos.subtotal')}</span><span className="num">{fmtKip(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="text-muted">{t('pos.discount')}</span>
              <Input className="num h-9 w-32 text-right" inputMode="numeric" value={discount ? discount.toLocaleString('en-US') : ''} placeholder="0"
                onChange={(e) => setDiscount(Math.min(subtotal, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0))} aria-label={t('pos.discount')} /></div>
            <div className="flex items-baseline justify-between pt-1"><span className="font-medium">{t('pos.total')}</span><span className="num text-3xl font-semibold tracking-tight">{fmtKip(total)}</span></div>
          </div>
          <Button size="xl" className="w-full" disabled={!canPay} onClick={() => setPayOpen(true)} icon={Wallet}>{t('pos.pay')}</Button>
        </footer>
      </aside>

      {/* mobile: sticky cart bar above the bottom tabs */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[56px] z-20 border-t border-border bg-surface/95 px-4 py-2 shadow-lg backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <span className="block text-xs text-muted">{t('pos.cart')} · {cart.reduce((a, l) => a + l.qty, 0)}</span>
              <span className="num block text-xl font-semibold">{fmtKip(total)}</span>
            </button>
            <Button size="lg" icon={Wallet} disabled={!canPay} onClick={() => setPayOpen(true)}>{t('pos.pay').replace(' (F9)', '')}</Button>
          </div>
        </div>
      )}

      {/* prescription */}
      <Dialog open={rxOpen} onClose={() => setRxOpen(false)} title={t('rx.title')} wide
        footer={<><Button variant="secondary" onClick={() => setRxOpen(false)}>{t('c.cancel')}</Button><Button disabled={!rx || !rxValid(rx, hasControlled)} onClick={() => setRxOpen(false)}>{t('c.save')}</Button></>}>
        <RxForm value={rx ?? emptyRx()} onChange={setRx} controlled={hasControlled} />
      </Dialog>

      {/* payment */}
      <Dialog open={payOpen} onClose={() => setPayOpen(false)} title={t('pos.method')}
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>{t('c.cancel')}</Button><Button size="lg" onClick={complete} disabled={method === 'CASH' && received !== '' && (parseInt(received.replace(/\D/g, ''), 10) || 0) < total}>{t('pos.complete')}</Button></>}>
        <div className="space-y-4">
          <p className="num text-center text-4xl font-semibold">{fmtKip(total)}</p>
          <div className="grid grid-cols-3 gap-2">
            {([['CASH', Wallet], ['QR', QrCode], ['BANK', CreditCard]] as const).map(([m, I]) => (
              <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                className={cx('flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-ctl border text-sm font-medium', method === m ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:bg-surface-2')}>
                <I className="h-5 w-5" />{t(`pay.${m}`)}
              </button>
            ))}
          </div>
          {method === 'CASH' && (
            <>
              <Field label={t('pos.received')}><Input autoFocus className="num h-14 text-right text-2xl" inputMode="numeric" value={received} onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setReceived(Number.isFinite(n) ? n.toLocaleString('en-US') : ''); }} onKeyDown={(e) => e.key === 'Enter' && complete()} /></Field>
              <div className="flex flex-wrap gap-2">
                {[total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
                  <Button key={v} size="sm" variant="secondary" onClick={() => setReceived(v.toLocaleString('en-US'))}><span className="num">{v.toLocaleString('en-US')}</span></Button>
                ))}
              </div>
              <div className="flex items-baseline justify-between rounded-ctl bg-surface-2 px-4 py-3"><span>{t('pos.change')}</span><span className="num text-2xl font-semibold text-success">{fmtKip(change)}</span></div>
            </>
          )}
          {method === 'QR' && (
            <div className="grid place-items-center rounded-ctl bg-white p-4"><QrMock /></div>
          )}
        </div>
      </Dialog>

      {/* receipt */}
      <Dialog open={!!receipt} onClose={() => setReceipt(null)} title={t('pos.receipt')}
        footer={<><Button variant="secondary" icon={Share2} onClick={() => toast(t('pos.share'))}>{t('pos.share')}</Button><Button variant="secondary" icon={Printer} onClick={() => window.print()}>{t('c.print')}</Button><Button onClick={() => { setReceipt(null); searchRef.current?.focus(); }}>{t('pos.newSale')}</Button></>}>
        {receipt && <ReceiptView sale={receipt} pharmacyName={L(ph.pharmacy.name)} address={`${ph.pharmacy.village}, ${L(db.districts.find((d) => d.id === ph.pharmacy.districtId)!.name)}`} phone={ph.pharmacy.phone} license={ph.pharmacy.license.number} drugs={db.drugs} cashier={user ? L(user.name) : ''} />}
      </Dialog>

      {/* camera scanner (demo) */}
      <Dialog open={scanOpen} onClose={() => setScanOpen(false)} title={t('pos.scan')}>
        <button className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-card bg-slate-900 text-white" onClick={() => {
          const pool = ph.stock.filter((s) => s.qty > 20 && s.drug.status === 'APPROVED' && (s.drug.category === 'GENERAL' || can(user, 'pos.sellRx')));
          const hit = pool[Math.floor(Math.random() * pool.length)];
          setScanOpen(false);
          if (hit) { add(hit.drug); toast(`${hit.drug.barcode} → ${hit.drug.brand}`); }
        }}>
          <div className="absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-danger shadow-[0_0_12px_rgba(248,113,113,.9)]" />
          <div className="h-2/3 w-3/4 rounded-ctl border-2 border-white/80" />
          <span className="absolute bottom-3 text-sm text-white/80">{t('pos.cameraDemo')}</span>
        </button>
        <p className="mt-2 text-center text-sm text-muted">{t('pos.cameraHint')}</p>
      </Dialog>
    </div>
  );
}

function QrMock() {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => ((i * 7919) % 13) < 6 || [0, 1, 2, 3, 4, 5, 6].some((k) => i === k));
  return (
    <svg viewBox="0 0 21 21" className="h-44 w-44" role="img" aria-label="QR">
      {cells.map((on, i) => on && <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#0F172A" />)}
      {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => <g key={`${x}${y}`}><rect x={x} y={y} width="7" height="7" fill="#0F172A" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#0F172A" /></g>)}
    </svg>
  );
}

export function ReceiptView({ sale, pharmacyName, address, phone, license, drugs, cashier }: { sale: Sale; pharmacyName: string; address: string; phone: string; license: string; drugs: Drug[]; cashier: string }) {
  const { t } = useTranslation();
  return (
    <div className="print-area mx-auto w-full max-w-[320px] rounded-ctl border border-dashed border-border bg-white p-4 font-mono text-[12px] leading-snug text-slate-900">
      <div className="text-center">
        <p className="font-sans text-sm font-semibold">{pharmacyName}</p>
        <p>{address}</p>
        <p>☎ {phone}</p>
        <p>{license}</p>
      </div>
      <div className="my-2 border-t border-dashed border-slate-400" />
      <p>{t('pos.receipt')}: {sale.receiptNo}</p>
      <p>{fmtDateTime(sale.at)}</p>
      <p>{t('pos.cashier')}: {cashier}</p>
      {sale.pendingVerification && <p className="font-semibold">⚠ {t('st.pendingVerification')}</p>}
      <div className="my-2 border-t border-dashed border-slate-400" />
      {sale.lines.map((l, i) => {
        const d = drugs.find((x) => x.id === l.drugId);
        return (
          <div key={i} className="mb-1">
            <p className="truncate">{d?.brand} {d?.strength}</p>
            <p className="flex justify-between"><span>{l.qty} × {l.price.toLocaleString('en-US')}</span><span>{(l.qty * l.price).toLocaleString('en-US')}</span></p>
          </div>
        );
      })}
      <div className="my-2 border-t border-dashed border-slate-400" />
      <p className="flex justify-between"><span>{t('pos.subtotal')}</span><span>{sale.subtotal.toLocaleString('en-US')}</span></p>
      {sale.discount > 0 && <p className="flex justify-between"><span>{t('pos.discount')}</span><span>−{sale.discount.toLocaleString('en-US')}</span></p>}
      <p className="flex justify-between text-sm font-bold"><span>{t('pos.total')}</span><span>{fmtKip(sale.total)}</span></p>
      <p className="flex justify-between"><span>{t('pos.method')}</span><span>{t(`pay.${sale.method}`)}</span></p>
      <div className="my-2 border-t border-dashed border-slate-400" />
      <p className="text-center">{t('pos.thanks')}</p>
    </div>
  );
}
