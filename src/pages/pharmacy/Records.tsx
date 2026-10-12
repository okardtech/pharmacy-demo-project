import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, FileImage, Flame, Plus, Send, ShieldAlert, Stethoscope, Truck, UserPlus, Users } from 'lucide-react';
import { useStore } from '@/store/store';
import { usePharmacy } from '@/store/selectors';
import { fmtDate, fmtDateTime, fmtKip } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import type { AdrReport, Customer, Destruction, Prescription, Supplier } from '@/data/types';
import { Badge, Button, Card, DataTable, DescList, Dialog, EmptyState, Field, Input, PageHeader, SearchInput, Segmented, Select, StatusBadge, Textarea, Toolbar, useFakeLoading, useToast } from '@/components/ui';

const baseRec = (by: string) => { const n = new Date().toISOString(); return { id: uuidv7(), createdAt: n, updatedAt: n, createdBy: by, version: 0, deletedAt: null }; };

function useExport() {
  const { t } = useTranslation();
  const toast = useToast();
  return (kind: 'xlsx' | 'pdf', name: string) => { toast(t('rep.exporting'), 'primary'); setTimeout(() => toast(`${name}.${kind} ✓`), 700); };
}

/* ------------------------------------------------------------------ Prescriptions */

export function Prescriptions() {
  const { t } = useTranslation();
  const { db } = useStore();
  const ph = usePharmacy();
  const loading = useFakeLoading();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Prescription | null>(null);
  const rows = db.prescriptions.filter((p) => p.pharmacyId === ph.pharmacyId && `${p.patientName} ${p.doctorName} ${p.facility}`.toLowerCase().includes(q.toLowerCase()));
  const sale = open && db.sales.find((s) => s.id === open.saleId);
  return (
    <div>
      <PageHeader title={t('nav.prescriptions')} />
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} className="sm:w-80" /><span className="num text-sm text-muted sm:ml-auto">{t('rep.records', { n: rows.length })}</span></Toolbar>
        <DataTable loading={loading} rows={rows} rowKey={(r) => r.id} onRowClick={setOpen} initialSort={{ key: 'date', dir: 'desc' }}
          empty={<EmptyState icon={Stethoscope} title={t('c.noResults')} />}
          columns={[
            { key: 'date', header: t('c.date'), sort: (r) => r.date, render: (r) => <span className="num">{fmtDateTime(r.date)}</span> },
            { key: 'patient', header: t('rx.patient'), mobile: 'title', sort: (r) => r.patientName, render: (r) => <span className="font-medium">{r.patientName} <span className="text-xs text-muted">({r.patientSex === 'M' ? t('rx.male') : t('rx.female')}, {r.patientAge})</span></span> },
            { key: 'doctor', header: t('rx.doctor'), render: (r) => <span>{r.doctorName}<span className="block text-xs text-muted">{r.facility}</span></span> },
            { key: 'drugs', header: t('rx.drugs'), render: (r) => <div className="flex flex-wrap gap-1">{r.drugIds.map((id) => { const d = db.drugs.find((x) => x.id === id); return d && <Badge key={id} tone={d.category === 'CONTROLLED' ? 'danger' : 'accent'} icon={null}>{d.brand}</Badge>; })}</div> },
            { key: 'photo', header: t('c.photo'), render: (r) => (r.hasPhoto ? <Badge tone="success" icon={FileImage}>{t('c.photoAttached')}</Badge> : <Badge tone="warning">—</Badge>) },
          ]} />
      </Card>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={t('rx.title')} wide>
        {open && (
          <div className="grid gap-5 md:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <DescList items={[
                [t('rx.patient'), `${open.patientName} · ${open.patientSex === 'M' ? t('rx.male') : t('rx.female')} · ${open.patientAge}`],
                [t('rx.idNo'), <span className="num">{open.patientIdNo}</span>],
                [t('rx.doctor'), open.doctorName], [t('rx.doctorLicense'), open.doctorLicense],
                [t('rx.facility'), open.facility], [t('c.date'), fmtDateTime(open.date)],
                [t('rx.receipt'), <span className="num">{sale?.receiptNo ?? '—'}</span>], [t('c.total'), sale ? fmtKip(sale.total) : '—'],
              ]} />
              <div><p className="mb-1 text-xs text-muted">{t('rx.drugs')}</p>
                <ul className="space-y-1">{sale?.lines.filter((l) => open.drugIds.includes(l.drugId)).map((l, i) => { const d = db.drugs.find((x) => x.id === l.drugId)!; return <li key={i} className="flex justify-between rounded-ctl bg-surface-2 px-3 py-2 text-sm"><span>{d.brand} {d.strength}</span><span className="num">× {l.qty}</span></li>; })}</ul>
              </div>
            </div>
            <div className="grid aspect-[3/4] place-items-center rounded-card border border-border bg-surface-2 p-4 text-center text-sm text-muted">
              {open.hasPhoto ? (
                <div className="w-full space-y-2 text-left">
                  <p className="text-center font-semibold text-text">{open.facility}</p>
                  {Array.from({ length: 7 }, (_, i) => <div key={i} className="h-2 rounded bg-border" style={{ width: `${60 + ((i * 37) % 40)}%` }} />)}
                  <p className="pt-4 text-right italic">{open.doctorName}</p>
                </div>
              ) : '—'}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Controlled register */

export function ControlledRegister() {
  const { t } = useTranslation();
  const { db } = useStore();
  const ph = usePharmacy();
  const ex = useExport();
  const loading = useFakeLoading();
  const [drugId, setDrugId] = useState('');
  const controlled = ph.stock.filter((s) => s.drug.category === 'CONTROLLED');
  const rows = useMemo(() => {
    const ids = new Set(controlled.map((c) => c.drug.id));
    const mv = ph.movements.filter((m) => ids.has(m.drugId) && (!drugId || m.drugId === drugId)).sort((a, b) => a.at.localeCompare(b.at));
    const bal = new Map<string, number>();
    return mv.map((m) => {
      const b = (bal.get(m.drugId) ?? 0) + m.qty;
      bal.set(m.drugId, b);
      const sale = m.type === 'SALE' ? db.sales.find((s) => s.id === m.ref) : undefined;
      const rx = sale?.prescriptionId ? db.prescriptions.find((p) => p.id === sale.prescriptionId) : undefined;
      return { m, balance: b, rx, sale };
    }).reverse();
  }, [ph.movements, controlled, drugId, db.sales, db.prescriptions]);
  return (
    <div>
      <PageHeader title={t('cd.title')} subtitle={t('cd.auto')}
        actions={<><Button variant="secondary" onClick={() => ex('xlsx', 'controlled-register')}>{t('c.exportXlsx')}</Button><Button variant="secondary" onClick={() => ex('pdf', 'controlled-register')}>{t('c.exportPdf')}</Button></>} />
      <Card pad={false}>
        <Toolbar>
          <Select value={drugId} onChange={(e) => setDrugId(e.target.value)} className="sm:w-80" aria-label={t('stock.drug')}>
            <option value="">{t('c.all')} ({controlled.length})</option>
            {controlled.map((c) => <option key={c.drug.id} value={c.drug.id}>{c.drug.brand} {c.drug.strength}</option>)}
          </Select>
          <Badge tone="neutral" icon={ShieldAlert}>{t('c.readOnly')}</Badge>
        </Toolbar>
        <DataTable loading={loading} dense rows={rows} rowKey={(r) => r.m.id} pageSize={15} columns={[
          { key: 'date', header: t('c.date'), render: (r) => <span className="num">{fmtDateTime(r.m.at)}</span> },
          { key: 'drug', header: t('stock.drug'), mobile: 'title', render: (r) => { const d = db.drugs.find((x) => x.id === r.m.drugId)!; return <span className="font-medium">{d.brand} {d.strength}</span>; } },
          { key: 'lot', header: t('stock.lot'), render: (r) => <span className="num">{ph.batches.find((b) => b.id === r.m.batchId)?.lot}</span> },
          { key: 'type', header: t('c.type'), render: (r) => <span className="inline-flex gap-1"><Badge tone={r.m.qty > 0 ? 'success' : 'neutral'} icon={null}>{t(`mv.${r.m.type}`)}</Badge>{r.sale?.pendingVerification && <Badge tone="warning">{t('st.pendingVerification')}</Badge>}</span> },
          { key: 'in', header: t('cd.in'), align: 'right', render: (r) => (r.m.qty > 0 ? r.m.qty : '') },
          { key: 'out', header: t('cd.out'), align: 'right', render: (r) => (r.m.qty < 0 ? -r.m.qty : '') },
          { key: 'bal', header: t('stock.balance'), align: 'right', render: (r) => <b>{r.balance}</b> },
          { key: 'patient', header: t('cd.patient'), render: (r) => r.rx ? <span>{r.rx.patientName}<span className="block text-xs text-muted">{r.rx.doctorName} · {r.rx.doctorLicense}</span></span> : '—' },
        ]} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Destruction */

export function DestructionPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { db, user, write } = useStore();
  const ph = usePharmacy();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState('ds.incineration');
  const [witnesses, setWitnesses] = useState('');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const candidates = ph.stock.flatMap((s) => s.batches.filter((b) => b.qty > 0 && (b.days < 0 || s.drug.status !== 'APPROVED')).map((b) => ({ b, d: s.drug })));
  const rows = db.destructions.filter((d) => d.pharmacyId === ph.pharmacyId).sort((a, b) => b.date.localeCompare(a.date));
  const submit = () => {
    const items = candidates.filter((c) => sel[c.b.id]).map((c) => ({ batchId: c.b.id, drugId: c.d.id, qty: c.b.qty }));
    const rec: Destruction = { ...baseRec(user!.id), pharmacyId: ph.pharmacyId, date: new Date().toISOString(), method: t(method), witnesses: witnesses.split(',').map((w) => w.trim()).filter(Boolean), items, status: 'PENDING_APPROVAL' };
    write('destructions', rec, `Destruction request (${items.length} batches)`);
    toast(t('ds.requested'));
    setOpen(false); setSel({}); setWitnesses('');
  };
  return (
    <div>
      <PageHeader title={t('ds.title')} actions={<Button icon={Plus} onClick={() => setOpen(true)}>{t('ds.new')}</Button>} />
      <Card pad={false}>
        <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState icon={Flame} title={t('c.noResults')} action={<Button onClick={() => setOpen(true)}>{t('ds.new')}</Button>} />} columns={[
          { key: 'date', header: t('c.date'), mobile: 'title', render: (r) => <span className="num font-medium">{fmtDate(r.date)}</span> },
          { key: 'items', header: t('ds.items'), render: (r) => <div className="flex flex-wrap gap-1">{r.items.map((i) => <Badge key={i.batchId} icon={null}>{db.drugs.find((d) => d.id === i.drugId)?.brand} × {i.qty}</Badge>)}</div> },
          { key: 'method', header: t('ds.method'), render: (r) => r.method },
          { key: 'wit', header: t('ds.witnesses'), render: (r) => r.witnesses.join(', ') },
          { key: 'st', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
        ]} />
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('ds.new')} wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('c.cancel')}</Button><Button icon={Send} disabled={!Object.values(sel).some(Boolean) || !witnesses.trim()} onClick={submit}>{t('ds.requestApproval')}</Button></>}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">{t('ds.expiredCandidates')}</p>
            {candidates.length === 0 ? <p className="text-sm text-muted">{t('dash.allGood')}</p> : (
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {candidates.map(({ b, d }) => (
                  <li key={b.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-ctl border border-border px-3 hover:bg-surface-2">
                    <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--primary))]" checked={!!sel[b.id]} onChange={(e) => setSel({ ...sel, [b.id]: e.target.checked })} />
                    <span className="flex-1 text-sm"><b>{d.brand}</b> · <span className="num">{b.lot}</span></span>
                    {d.status !== 'APPROVED' ? <StatusBadge status={d.status} /> : <Badge tone="danger">{t('st.EXPIRED')}</Badge>}
                    <span className="num w-12 text-right text-sm">{b.qty}</span>
                  </label></li>
                ))}
              </ul>
            )}
          </div>
          <Field label={t('ds.method')}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{['ds.incineration', 'ds.encapsulation', 'ds.return'].map((m) => <option key={m} value={m}>{t(m)}</option>)}</Select></Field>
          <Field label={t('ds.witnesses')} required hint="ທ້າວ ກ, ນາງ ຂ"><Input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} /></Field>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ ADR */

export function AdrPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { db, user, write } = useStore();
  const ph = usePharmacy();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientInitials: '', patientAge: '', drugId: '', batchLot: '', reaction: '', severity: 'MILD' as AdrReport['severity'], outcome: 'RECOVERING' as AdrReport['outcome'] });
  const rows = db.adrs.filter((a) => a.pharmacyId === ph.pharmacyId).sort((a, b) => b.date.localeCompare(a.date));
  const ok = f.patientInitials && f.patientAge && f.drugId && f.reaction;
  const submit = () => {
    write('adrs', { ...baseRec(user!.id), pharmacyId: ph.pharmacyId, ...f, patientAge: Number(f.patientAge), reporter: user!.name.lo, date: new Date().toISOString() } satisfies AdrReport, `ADR · ${f.patientInitials}`);
    toast(t('adr.sent'));
    setOpen(false);
  };
  return (
    <div>
      <PageHeader title={t('adr.title')} actions={<Button icon={Plus} onClick={() => setOpen(true)}>{t('adr.new')}</Button>} />
      <Card pad={false}>
        <DataTable rows={rows} rowKey={(r) => r.id} empty={<EmptyState icon={AlertOctagon} title={t('c.noResults')} />} columns={[
          { key: 'date', header: t('c.date'), render: (r) => <span className="num">{fmtDate(r.date)}</span> },
          { key: 'drug', header: t('stock.drug'), mobile: 'title', render: (r) => <span className="font-medium">{db.drugs.find((d) => d.id === r.drugId)?.brand} <span className="num text-xs text-muted">{r.batchLot}</span></span> },
          { key: 'pt', header: t('adr.patient'), render: (r) => `${r.patientInitials} (${r.patientAge})` },
          { key: 'rx', header: t('adr.reaction'), render: (r) => <span className="line-clamp-2">{r.reaction}</span> },
          { key: 'sev', header: t('adr.severity'), render: (r) => <Badge tone={r.severity === 'MILD' ? 'neutral' : r.severity === 'MODERATE' ? 'warning' : 'danger'}>{t(`sev.${r.severity}`)}</Badge> },
          { key: 'out', header: t('adr.outcome'), render: (r) => t(`out.${r.outcome}`) },
        ]} />
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('adr.new')} wide footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('c.cancel')}</Button><Button disabled={!ok} onClick={submit}>{t('c.submit')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('adr.patient')} required><Input value={f.patientInitials} onChange={(e) => setF({ ...f, patientInitials: e.target.value })} placeholder="S.K." /></Field>
          <Field label={t('rx.age')} required><Input inputMode="numeric" value={f.patientAge} onChange={(e) => setF({ ...f, patientAge: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label={t('stock.drug')} required><Select value={f.drugId} onChange={(e) => setF({ ...f, drugId: e.target.value })}><option value="">—</option>{ph.stock.map((s) => <option key={s.drug.id} value={s.drug.id}>{s.drug.brand} {s.drug.strength}</option>)}</Select></Field>
          <Field label={t('stock.lot')}><Select value={f.batchLot} onChange={(e) => setF({ ...f, batchLot: e.target.value })}><option value="">—</option>{ph.batches.filter((b) => b.drugId === f.drugId).map((b) => <option key={b.id}>{b.lot}</option>)}</Select></Field>
          <Field label={t('adr.reaction')} required className="sm:col-span-2"><Textarea value={f.reaction} onChange={(e) => setF({ ...f, reaction: e.target.value })} /></Field>
          <Field label={t('adr.severity')}><Segmented value={f.severity} onChange={(v) => setF({ ...f, severity: v })} options={(['MILD', 'MODERATE', 'SEVERE', 'FATAL'] as const).map((s) => ({ value: s, label: t(`sev.${s}`) }))} /></Field>
          <Field label={t('adr.outcome')}><Select value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value as AdrReport['outcome'] })}>{(['RECOVERED', 'RECOVERING', 'NOT_RECOVERED', 'UNKNOWN'] as const).map((o) => <option key={o} value={o}>{t(`out.${o}`)}</option>)}</Select></Field>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Customers */

export function Customers() {
  const { t } = useTranslation();
  const toast = useToast();
  const { db, user, write } = useStore();
  const ph = usePharmacy();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Customer | null>(null);
  const rows = db.customers.filter((c) => c.pharmacyId === ph.pharmacyId && `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const stats = (id: string) => { const s = ph.sales.filter((x) => x.customerId === id); return { n: s.length, last: s.map((x) => x.at).sort().pop() }; };
  const blank = (): Customer => ({ ...baseRec(user!.id), pharmacyId: ph.pharmacyId, name: '', phone: '', allergies: [] });
  return (
    <div>
      <PageHeader title={t('nav.customers')} actions={<Button icon={UserPlus} onClick={() => setEdit(blank())}>{t('cu.new')}</Button>} />
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} className="sm:w-80" /></Toolbar>
        <DataTable rows={rows} rowKey={(r) => r.id} onRowClick={setEdit} empty={<EmptyState icon={Users} title={t('c.noResults')} />} columns={[
          { key: 'name', header: t('c.name'), mobile: 'title', sort: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'phone', header: t('c.phone'), render: (r) => <span className="num">{r.phone}</span> },
          { key: 'all', header: t('cu.allergies'), render: (r) => r.allergies.length ? <div className="flex gap-1">{r.allergies.map((a) => <Badge key={a} tone="danger">{a}</Badge>)}</div> : '—' },
          { key: 'n', header: t('cu.purchases'), align: 'right', render: (r) => stats(r.id).n },
          { key: 'last', header: t('cu.lastVisit'), render: (r) => <span className="num">{fmtDate(stats(r.id).last)}</span> },
        ]} />
      </Card>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.name || t('cu.new')} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('c.cancel')}</Button><Button disabled={!edit?.name} onClick={() => { write('customers', edit!, `Customer · ${edit!.name}`); toast(t('c.saved')); setEdit(null); }}>{t('c.save')}</Button></>}>
        {edit && (
          <div className="space-y-3">
            <Field label={t('c.name')} required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t('c.phone')}><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label={t('cu.allergies')} hint={t('cu.allergyHint')}><Input value={edit.allergies.join(', ')} onChange={(e) => setEdit({ ...edit, allergies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Suppliers */

export function Suppliers() {
  const { t } = useTranslation();
  const toast = useToast();
  const { db, user, write } = useStore();
  const ph = usePharmacy();
  const [edit, setEdit] = useState<Supplier | null>(null);
  const rows = db.suppliers.filter((s) => s.pharmacyId === ph.pharmacyId);
  const spend = (id: string) => db.receipts.filter((r) => r.supplierId === id).reduce((a, r) => a + r.total, 0);
  return (
    <div>
      <PageHeader title={t('nav.suppliers')} actions={<Button icon={Truck} onClick={() => setEdit({ ...baseRec(user!.id), pharmacyId: ph.pharmacyId, name: '', contact: '', phone: '', licenseNo: '', paymentTerms: 'NET 30' })}>{t('su.new')}</Button>} />
      <Card pad={false}>
        <DataTable rows={rows} rowKey={(r) => r.id} onRowClick={setEdit} columns={[
          { key: 'name', header: t('c.name'), mobile: 'title', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'contact', header: t('su.contact'), render: (r) => <span>{r.contact}<span className="num block text-xs text-muted">{r.phone}</span></span> },
          { key: 'lic', header: t('su.license'), render: (r) => <span className="num">{r.licenseNo}</span> },
          { key: 'terms', header: t('su.terms'), render: (r) => <Badge icon={null}>{r.paymentTerms}</Badge> },
          { key: 'spend', header: t('c.total'), align: 'right', render: (r) => fmtKip(spend(r.id)) },
        ]} />
      </Card>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.name || t('su.new')} footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('c.cancel')}</Button><Button disabled={!edit?.name} onClick={() => { write('suppliers', edit!, `Supplier · ${edit!.name}`); toast(t('c.saved')); setEdit(null); }}>{t('c.save')}</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('c.name')} required className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label={t('su.contact')}><Input value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} /></Field>
            <Field label={t('c.phone')}><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label={t('su.license')}><Input value={edit.licenseNo} onChange={(e) => setEdit({ ...edit, licenseNo: e.target.value })} /></Field>
            <Field label={t('su.terms')}><Select value={edit.paymentTerms} onChange={(e) => setEdit({ ...edit, paymentTerms: e.target.value })}>{['COD', 'NET 15', 'NET 30', 'NET 45'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}

