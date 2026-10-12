import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban, Check, CheckCircle2, FileSpreadsheet, FileText, LocateFixed, Plus, RotateCcw, Upload, X, AlertTriangle, Bell } from 'lucide-react';
import { useStore } from '@/store/store';
import { useRegistry } from '@/store/selectors';
import { can, scopePharmacies } from '@/store/rbac';
import { useL } from '@/i18n';
import { addDays, fmtDate, fmtDateTime, today } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import type { Drug, DrugCategory, Pharmacy, PharmacyType, RenewalRequest } from '@/data/types';
import { PickerMap } from '@/components/MapView';
import { Alert, Badge, Button, Card, ConfirmDialog, DataTable, DescList, Dialog, EmptyState, ExpiryBadge, Field, Input, PageHeader, SearchInput, Segmented, Select, StatusBadge, Textarea, Toolbar, cx, useFakeLoading, useToast } from '@/components/ui';
import { catTone } from '../pharmacy/POS';

/* ------------------------------------------------------------------ Register new pharmacy (multi-step) */

export function RegisterPharmacy() {
  const { t } = useTranslation();
  const L = useL();
  const nav = useNavigate();
  const toast = useToast();
  const { user, db, write } = useStore();
  const provinces = user?.provinceId ? db.provinces.filter((p) => p.id === user.provinceId) : db.provinces;
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    nameLo: '', nameEn: '', type: 'PHARMACY' as PharmacyType, phone: '', provinceId: provinces[0].id, districtId: '', village: '',
    lat: provinces[0].lat, lng: provinces[0].lng, owner: '', pharmacist: '', pharmacistCert: '', files: [] as string[],
  });
  const districts = db.districts.filter((d) => d.provinceId === f.provinceId);
  const steps = ['new.step1', 'new.step2', 'new.step3', 'new.step4', 'new.step5'];
  const valid = [f.nameLo && f.nameEn && f.phone, f.districtId && f.village, f.owner && f.pharmacist, f.files.length >= 2, true][step];

  const submit = () => {
    const now = new Date().toISOString();
    const n = db.pharmacies.length + 1;
    const prov = db.provinces.find((p) => p.id === f.provinceId)!;
    const rec: Pharmacy = {
      id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, code: `${prov.code}-${String(n).padStart(3, '0')}`,
      name: { lo: f.nameLo, en: f.nameEn }, type: f.type, provinceId: f.provinceId, districtId: f.districtId, village: f.village, phone: f.phone,
      owner: { lo: f.owner, en: f.owner }, pharmacist: { lo: f.pharmacist, en: f.pharmacist }, lat: f.lat, lng: f.lng, status: 'PENDING',
      license: { number: `MOH/PH/${new Date().getFullYear()}/${String(n).padStart(4, '0')}`, issueDate: now, expiryDate: addDays(today(), 365 * 3).toISOString() }, complianceScore: 0,
    };
    write('pharmacies', rec, `Register ${rec.code}`);
    toast(t('new.created'));
    nav(`/gov/registry/${rec.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('nav.register')} />
      <ol className="mb-5 flex items-center gap-1 overflow-x-auto">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span className={cx('flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium', i === step ? 'bg-accent text-white dark:text-slate-900' : i < step ? 'bg-success/10 text-success' : 'bg-surface-2 text-muted')}>
              <span className="num">{i < step ? '✓' : i + 1}</span><span className={cx(i !== step && 'hidden sm:inline')}>{t(s)}</span>
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
          </li>
        ))}
      </ol>
      <Card>
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('new.nameLo')} required><Input value={f.nameLo} onChange={(e) => setF({ ...f, nameLo: e.target.value })} placeholder="ຮ້ານຂາຍຢາ …" /></Field>
            <Field label={t('new.nameEn')} required><Input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></Field>
            <Field label={t('c.type')}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as PharmacyType })}>{(['PHARMACY', 'DRUG_STORE', 'CLINIC_DISPENSARY'] as const).map((x) => <option key={x} value={x}>{t(`ptype.${x}`)}</option>)}</Select></Field>
            <Field label={t('c.phone')} required><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="020 …" /></Field>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('c.province')} required><Select value={f.provinceId} onChange={(e) => { const p = db.provinces.find((x) => x.id === e.target.value)!; setF({ ...f, provinceId: p.id, districtId: '', lat: p.lat, lng: p.lng }); }}>{provinces.map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}</Select></Field>
              <Field label={t('c.district')} required><Select value={f.districtId} onChange={(e) => setF({ ...f, districtId: e.target.value })}><option value="">—</option>{districts.map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}</Select></Field>
              <Field label={t('c.village')} required><Input value={f.village} onChange={(e) => setF({ ...f, village: e.target.value })} placeholder="ບ້ານ …" /></Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted">{t('new.pickOnMap')}</p>
              <Button size="sm" variant="secondary" icon={LocateFixed} onClick={() => navigator.geolocation?.getCurrentPosition((p) => setF({ ...f, lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }), () => toast('GPS unavailable', 'warning'))}>{t('new.useGps')}</Button></div>
            <PickerMap lat={f.lat} lng={f.lng} onPick={(lat, lng) => setF({ ...f, lat, lng })} />
            <p className="num text-sm text-muted">{t('lic.gps')}: {f.lat}, {f.lng}</p>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('lic.owner')} required><Input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
            <Field label={t('lic.pharmacist')} required><Input value={f.pharmacist} onChange={(e) => setF({ ...f, pharmacist: e.target.value })} /></Field>
            <Field label={t('doc.PHARMACIST_CERT')}><Input value={f.pharmacistCert} onChange={(e) => setF({ ...f, pharmacistCert: e.target.value })} placeholder="PH-CERT-…" /></Field>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <button type="button" onClick={() => { const names = ['license-application.pdf', 'pharmacist-cert.pdf', 'floor-plan.jpg', 'owner-id.jpg']; setF({ ...f, files: names.slice(0, Math.min(names.length, f.files.length + 1)) }); }}
              className="flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-border px-4 py-10 text-sm text-muted hover:border-accent/50">
              <Upload className="h-8 w-8 text-accent" />{t('new.dropFiles')}
            </button>
            <ul className="space-y-2">{f.files.map((n) => <li key={n} className="flex items-center gap-2 rounded-ctl bg-surface-2 px-3 py-2 text-sm"><FileText className="h-4 w-4 text-accent" />{n}<CheckCircle2 className="ml-auto h-4 w-4 text-success" /></li>)}</ul>
          </div>
        )}
        {step === 4 && (
          <DescList items={[
            [t('new.nameLo'), f.nameLo], [t('new.nameEn'), f.nameEn], [t('c.type'), t(`ptype.${f.type}`)], [t('c.phone'), f.phone],
            [t('lic.address'), `${f.village}, ${L(db.districts.find((d) => d.id === f.districtId)?.name ?? { lo: '', en: '' })}, ${L(db.provinces.find((p) => p.id === f.provinceId)!.name)}`],
            [t('lic.gps'), `${f.lat}, ${f.lng}`], [t('lic.owner'), f.owner], [t('lic.pharmacist'), f.pharmacist], [t('lic.documents'), f.files.join(', ')],
          ]} />
        )}
        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>{t('c.back')}</Button>
          {step < 4 ? <Button variant="accent" disabled={!valid} onClick={() => setStep((s) => s + 1)}>{t('c.next')}</Button> : <Button variant="accent" icon={Check} onClick={submit}>{t('c.submit')}</Button>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Renewals */

export function Renewals() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { user, db, write, notify } = useStore();
  const reg = useRegistry();
  const scopedIds = new Set(scopePharmacies(user, reg).map((p) => p.id));
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [open, setOpen] = useState<RenewalRequest | null>(null);
  const [reason, setReason] = useState('');
  const rows = db.renewals.filter((r) => scopedIds.has(r.pharmacyId) && r.status === filter);
  const upcoming = reg.filter((p) => scopedIds.has(p.id) && p.licDays >= 0 && p.licDays <= 90 && p.lic !== 'RENEWAL_PENDING').sort((a, b) => a.licDays - b.licDays);
  const ph = open && db.pharmacies.find((p) => p.id === open.pharmacyId)!;

  const decide = (ok: boolean) => {
    if (!open || !ph) return;
    write('renewals', { ...open, status: ok ? 'APPROVED' : 'REJECTED', reviewedBy: user!.id, decisionNotes: ok ? undefined : reason }, `${ok ? 'Approve' : 'Reject'} renewal ${ph.code}`, ok ? 'APPROVE' : 'REJECT');
    if (ok) write('pharmacies', { ...ph, license: { ...ph.license, issueDate: new Date().toISOString(), expiryDate: addDays(new Date(ph.license.expiryDate) > today() ? new Date(ph.license.expiryDate) : today(), 365 * 3).toISOString() } }, `License extended ${ph.code}`, 'UPDATE');
    notify({ recipient: 'pharmacy', type: 'LICENSE', title: ok ? { lo: 'ອະນຸມັດຕໍ່ອາຍຸໃບອະນຸຍາດ', en: 'License renewed' } : { lo: 'ຄຳຮ້ອງຕໍ່ອາຍຸຖືກປະຕິເສດ', en: 'Renewal rejected' }, body: ph.name, link: '/app/license' });
    toast(ok ? t('ren.approved') : t('ren.rejected'), ok ? 'success' : 'warning');
    setOpen(null); setReason('');
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('ren.title')} />
      <Alert tone="accent" icon={Bell}>{t('ren.alerts')}</Alert>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card pad={false} className="lg:col-span-2">
          <div className="border-b border-border p-3"><Segmented value={filter} onChange={setFilter} options={(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => ({ value: s, label: `${t(`st.${s}`)} (${db.renewals.filter((r) => scopedIds.has(r.pharmacyId) && r.status === s).length})` }))} /></div>
          <DataTable rows={rows} rowKey={(r) => r.id} onRowClick={setOpen} empty={<EmptyState title={t('c.noResults')} />} columns={[
            { key: 'ph', header: t('nav.registry'), mobile: 'title', render: (r) => { const p = db.pharmacies.find((x) => x.id === r.pharmacyId)!; return <span className="font-medium">{L(p.name)}<span className="num block text-xs text-muted">{p.code}</span></span>; } },
            { key: 'sub', header: t('ren.submitted'), sort: (r) => r.submittedAt, render: (r) => <span className="num">{fmtDate(r.submittedAt)}</span> },
            { key: 'exp', header: t('lic.expiry'), render: (r) => { const p = reg.find((x) => x.id === r.pharmacyId)!; return <ExpiryBadge days={p.licDays} />; } },
            { key: 'docs', header: t('lic.documents'), align: 'right', render: (r) => r.documents.length },
            { key: 'st', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
          ]} />
        </Card>
        <Card title={t('ren.upcoming')} pad={false}>
          <ul className="max-h-[480px] divide-y divide-border overflow-y-auto">
            {upcoming.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{L(p.name)}</span><span className="num text-xs text-muted">{fmtDate(p.license.expiryDate)}</span></span>
                <ExpiryBadge days={p.licDays} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={t('ren.review')} wide
        footer={open?.status === 'PENDING' && can(user, 'license.approve') && <>
          <Button variant="danger" icon={X} disabled={!reason.trim()} onClick={() => decide(false)}>{t('c.reject')}</Button>
          <Button icon={Check} onClick={() => decide(true)}>{t('c.approve')}</Button></>}>
        {open && ph && (
          <div className="space-y-4">
            <DescList items={[[t('c.name'), L(ph.name)], [t('lic.number'), ph.license.number], [t('lic.expiry'), fmtDate(ph.license.expiryDate)], [t('ren.submitted'), fmtDateTime(open.submittedAt)], [t('lic.owner'), L(ph.owner)], [t('c.notes'), open.notes || '—']]} />
            <div className="flex flex-wrap gap-2">{open.documents.map((d) => <Badge key={d} tone="accent" icon={FileText}>{d}</Badge>)}</div>
            {open.decisionNotes && <Alert tone="danger">{open.decisionNotes}</Alert>}
            {open.status === 'PENDING' && <Field label={t('ren.rejectReason')} hint={`${t('c.reject')}: ${t('c.required')}`}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ National drug catalog */

export function Catalog() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, db, write, notify, online } = useStore();
  const loading = useFakeLoading();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [st, setSt] = useState('');
  const [action, setAction] = useState<{ drug: Drug; to: Drug['status'] } | null>(null);
  const [edit, setEdit] = useState<Drug | null>(null);
  const editable = can(user, 'catalog.edit') && online;
  const rows = useMemo(() => db.drugs.filter((d) => (!q || `${d.generic} ${d.brand} ${d.regNo} ${d.barcode}`.toLowerCase().includes(q.toLowerCase())) && (!cat || d.category === cat) && (!st || d.status === st)), [db.drugs, q, cat, st]);
  const holders = (d: Drug) => 12 + (parseInt(d.id.slice(-2), 10) % 20);
  const blank = (): Drug => { const n = new Date().toISOString(); return { id: uuidv7(), createdAt: n, updatedAt: n, createdBy: user!.id, version: 0, generic: '', brand: '', strength: '', form: 'Tablet', packSize: '', category: 'GENERAL', regNo: '', manufacturer: '', importer: '—', barcode: '', status: 'APPROVED', ingredients: [], refPrice: 0 }; };

  return (
    <div>
      <PageHeader title={t('cat.title')} subtitle={!online ? t('c.offlineReadOnly') : undefined}
        actions={editable && <><Button variant="secondary" icon={FileSpreadsheet} onClick={() => toast(t('cat.importDone'), 'primary')}>{t('cat.import')}</Button><Button icon={Plus} onClick={() => setEdit(blank())}>{t('cat.new')}</Button></>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} className="sm:w-72" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-52" aria-label={t('cat.category')}><option value="">{t('cat.category')}: {t('c.all')}</option>{(['GENERAL', 'PRESCRIPTION_ONLY', 'CONTROLLED', 'DANGEROUS'] as DrugCategory[]).map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}</Select>
          <Select value={st} onChange={(e) => setSt(e.target.value)} className="sm:w-44" aria-label={t('c.status')}><option value="">{t('c.status')}: {t('c.all')}</option>{['APPROVED', 'BANNED', 'RECALLED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}</Select>
          <span className="num text-sm text-muted sm:ml-auto">{t('rep.records', { n: rows.length })}</span>
        </Toolbar>
        <DataTable loading={loading} rows={rows} rowKey={(r) => r.id} pageSize={15} dense initialSort={{ key: 'generic', dir: 'asc' }} onRowClick={editable ? setEdit : undefined} columns={[
          { key: 'generic', header: t('cat.generic'), mobile: 'title', sort: (r) => r.generic, render: (r) => <span><span className="font-medium">{r.generic}</span> <span className="text-muted">{r.strength}</span><span className="block text-xs text-muted">{r.brand} · {r.form} · {r.packSize}</span></span> },
          { key: 'cat', header: t('cat.category'), sort: (r) => r.category, render: (r) => <Badge tone={catTone(r.category)} icon={null}>{t(`cat.${r.category}`)}</Badge> },
          { key: 'reg', header: t('cat.regNo'), render: (r) => <span className="num text-xs">{r.regNo}</span> },
          { key: 'mf', header: t('cat.manufacturer'), mobile: 'hide', render: (r) => <span className="text-sm">{r.manufacturer}</span> },
          { key: 'st', header: t('c.status'), sort: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
          { key: 'act', header: '', align: 'right', render: (r) => editable && (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {r.status === 'APPROVED' ? <>
                <Button size="sm" variant="ghost" icon={AlertTriangle} onClick={() => setAction({ drug: r, to: 'RECALLED' })}>{t('cat.markRecalled')}</Button>
                <Button size="sm" variant="ghost" icon={Ban} onClick={() => setAction({ drug: r, to: 'BANNED' })}>{t('cat.markBanned')}</Button>
              </> : <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setAction({ drug: r, to: 'APPROVED' })}>{t('cat.restore')}</Button>}
            </div>) },
        ]} />
      </Card>
      <ConfirmDialog open={!!action} onClose={() => setAction(null)} danger={action?.to !== 'APPROVED'}
        title={action ? `${action.drug.brand} → ${t(`st.${action.to}`)}` : ''}
        body={action && action.to !== 'APPROVED' ? t('cat.alertSent', { n: holders(action.drug) }) : undefined}
        onConfirm={() => {
          if (!action) return;
          write('drugs', { ...action.drug, status: action.to }, `${action.to} ${action.drug.brand}`, 'UPDATE');
          if (action.to !== 'APPROVED') {
            notify({ recipient: 'pharmacy', type: 'RECALL', title: { lo: `ແຈ້ງເຕືອນ: ${t(`st.${action.to}`)}`, en: `Alert: ${action.to === 'BANNED' ? 'Banned' : 'Recalled'}` }, body: { lo: `${action.drug.brand} ${action.drug.strength} — ຢຸດຂາຍທັນທີ`, en: `${action.drug.brand} ${action.drug.strength} — stop selling immediately` }, link: '/app/stock?filter=recalled' });
            toast(t('cat.alertSent', { n: holders(action.drug) }), 'warning');
          } else toast(t('c.saved'));
        }} />
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.brand || t('cat.new')} wide footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('c.cancel')}</Button><Button disabled={!edit?.generic || !edit?.brand} onClick={() => { write('drugs', edit!, `Drug ${edit!.brand}`); toast(t('c.saved')); setEdit(null); }}>{t('c.save')}</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(['generic', 'brand', 'strength', 'form', 'packSize', 'regNo', 'manufacturer', 'importer', 'barcode'] as const).map((k) => (
              <Field key={k} label={t(`cat.${k === 'packSize' ? 'pack' : k}`)} required={k === 'generic' || k === 'brand'}><Input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></Field>
            ))}
            <Field label={t('cat.category')}><Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as DrugCategory })}>{(['GENERAL', 'PRESCRIPTION_ONLY', 'CONTROLLED', 'DANGEROUS'] as const).map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}</Select></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
