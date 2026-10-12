import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Send, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import { useStore } from '@/store/store';
import { usePharmacy } from '@/store/selectors';
import { can } from '@/store/rbac';
import { useL } from '@/i18n';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import { DEMO_DEVICE } from '@/data/seed';
import type { RenewalRequest, Role, User } from '@/data/types';
import { Alert, Badge, Button, Card, DataTable, DescList, Dialog, ExpiryBadge, Field, Input, PageHeader, Segmented, Select, StatusBadge, Textarea, useToast } from '@/components/ui';
import { MiniMap } from '@/components/MapView';

export function LicensePage() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { db, user, write, notify } = useStore();
  const ph = usePharmacy();
  const p = ph.pharmacy;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const docs = db.documents.filter((d) => d.pharmacyId === p.id);
  const renewals = db.renewals.filter((r) => r.pharmacyId === p.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const submit = () => {
    const now = new Date().toISOString();
    const r: RenewalRequest = { id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, pharmacyId: p.id, submittedAt: now, status: 'PENDING', notes: note, documents: docs.map((d) => d.fileName) };
    write('renewals', r, 'License renewal request');
    notify({ recipient: 'regulator', type: 'LICENSE', title: { lo: 'ຄຳຮ້ອງຕໍ່ອາຍຸໃໝ່', en: 'New renewal request' }, body: { lo: L(p.name), en: p.name.en }, link: '/gov/renewals' });
    toast(t('lic.renewalSent'));
    setOpen(false);
  };
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.license')} actions={can(user, 'license.renew') && ph.licenseStatus !== 'RENEWAL_PENDING' && <Button icon={Send} onClick={() => setOpen(true)}>{t('dash.renewNow')}</Button>} />
      {ph.licenseStatus === 'RENEWAL_PENDING' && <Alert tone="accent">{t('lic.renewalPending')}</Alert>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={L(p.name)} subtitle={t(`ptype.${p.type}`)} className="lg:col-span-2" action={<StatusBadge status={p.status} />}>
          <DescList items={[
            [t('lic.number'), <span className="num">{p.license.number}</span>],
            [t('reg.licenseStatus'), <span className="flex flex-wrap gap-1"><StatusBadge status={ph.licenseStatus} /><ExpiryBadge days={ph.licenseDays} /></span>],
            [t('lic.issue'), <span className="num">{fmtDate(p.license.issueDate)}</span>], [t('lic.expiry'), <span className="num">{fmtDate(p.license.expiryDate)}</span>],
            [t('lic.owner'), L(p.owner)], [t('lic.pharmacist'), L(p.pharmacist)],
            [t('lic.address'), `${p.village}, ${L(db.districts.find((d) => d.id === p.districtId)!.name)}, ${L(db.provinces.find((x) => x.id === p.provinceId)!.name)}`],
            [t('c.phone'), <span className="num">{p.phone}</span>],
          ]} />
        </Card>
        <Card title={t('lic.gps')} pad={false}><MiniMap lat={p.lat} lng={p.lng} /><p className="num px-4 py-2 text-xs text-muted">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</p></Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('lic.documents')} pad={false} action={<Button size="sm" variant="secondary" icon={Upload} onClick={() => toast(t('c.saved'))}>{t('c.upload')}</Button>}>
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-5 w-5 text-accent" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{d.fileName}</p><p className="text-xs text-muted">{t(`doc.${d.type}`)} · <span className="num">{d.sizeKb} KB</span></p></div>
                <Button size="sm" variant="ghost">{t('c.view')}</Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t('lic.renewal')} pad={false}>
          {renewals.length === 0 ? <p className="p-4 text-sm text-muted">—</p> : (
            <ul className="divide-y divide-border">
              {renewals.map((r) => <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm"><span className="num">{fmtDateTime(r.submittedAt)}</span><StatusBadge status={r.status} /></li>)}
            </ul>
          )}
        </Card>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('lic.renewal')} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('c.cancel')}</Button><Button icon={Send} onClick={submit}>{t('c.submit')}</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('lic.documents')}: {docs.map((d) => d.fileName).join(', ')}</p>
          <Field label={t('lic.renewalNote')}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </Dialog>
    </div>
  );
}

export function Staff() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { db, user, write } = useStore();
  const ph = usePharmacy();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', role: 'STAFF' as Role });
  const staff = db.users.filter((u) => u.pharmacyId === ph.pharmacyId);
  const toggle = (u: User) => { write('users', { ...u, active: !u.active }, `${u.active ? 'Deactivate' : 'Activate'} ${u.username}`, 'UPDATE'); toast(t('c.saved')); };
  return (
    <div>
      <PageHeader title={t('nav.staff')} actions={<Button icon={UserPlus} onClick={() => setOpen(true)}>{t('staff.invite')}</Button>} />
      <Card pad={false}>
        <DataTable rows={staff} rowKey={(r) => r.id} columns={[
          { key: 'name', header: t('c.name'), mobile: 'title', render: (r) => <span className="font-medium">{L(r.name)}<span className="block text-xs text-muted">@{r.username}</span></span> },
          { key: 'role', header: t('staff.role'), render: (r) => <Badge tone={r.role === 'PHARMACY_OWNER' ? 'primary' : 'neutral'} icon={null}>{t(`role.${r.role}`)}</Badge> },
          { key: 'phone', header: t('c.phone'), render: (r) => <span className="num">{r.phone}</span> },
          { key: 'last', header: t('staff.lastLogin'), render: (r) => <span className="num">{fmtDateTime(r.lastLogin)}</span> },
          { key: 'st', header: t('c.status'), render: (r) => (r.active ? <StatusBadge status="ACTIVE" /> : <Badge>{t('st.inactive')}</Badge>) },
          { key: 'act', header: '', align: 'right', render: (r) => r.id !== user?.id && r.role !== 'PHARMACY_OWNER' && <Button size="sm" variant={r.active ? 'secondary' : 'primary'} onClick={() => toggle(r)}>{r.active ? t('staff.deactivate') : t('staff.activate')}</Button> },
        ]} />
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('staff.invite')} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('c.cancel')}</Button><Button disabled={!f.name || !f.phone} onClick={() => {
        const now = new Date().toISOString();
        write('users', { id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, username: f.phone.replace(/\s/g, ''), phone: f.phone, name: { lo: f.name, en: f.name }, role: f.role, pharmacyId: ph.pharmacyId, active: true, twoFactor: false } satisfies User, `Invite ${f.name}`);
        toast(t('staff.invited')); setOpen(false); setF({ name: '', phone: '', role: 'STAFF' });
      }}>{t('staff.invite')}</Button></>}>
        <div className="space-y-3">
          <Field label={t('c.name')} required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={t('c.phone')} required><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="020 …" /></Field>
          <Field label={t('staff.role')}><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}><option value="PHARMACIST">{t('role.PHARMACIST')}</option><option value="STAFF">{t('role.STAFF')}</option></Select></Field>
        </div>
      </Dialog>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { state, set } = useStore();
  const [name, setName] = useState(state.deviceName);
  const [pin, setPin] = useState(state.pin);
  return (
    <div className="max-w-2xl">
      <PageHeader title={t('nav.settings')} />
      <Card>
        <div className="space-y-5">
          <Field label={t('set.language')}><div><Segmented value={state.lang} onChange={(v) => set({ lang: v })} options={[{ value: 'lo', label: 'ລາວ' }, { value: 'en', label: 'English' }]} /></div></Field>
          <Field label={t('set.theme')}><div><Segmented value={state.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'light', label: t('top.light') }, { value: 'dark', label: t('top.dark') }, { value: 'system', label: t('top.system') }]} /></div></Field>
          <Field label={t('set.printer')}><div><Segmented value={state.printer} onChange={(v) => set({ printer: v })} options={[{ value: '80mm', label: '80mm thermal' }, { value: 'A4', label: 'A4 / PDF' }]} /></div></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('set.deviceName')}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t('set.deviceId')}><Input value={DEMO_DEVICE} readOnly className="num" /></Field>
            <Field label={t('set.pin')} hint="4–6"><Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="num" /></Field>
          </div>
          <Alert tone="accent" icon={ShieldCheck}><b>{t('set.install')}</b> — {t('set.installHint')}</Alert>
          <div className="flex justify-end"><Button disabled={pin.length < 4} onClick={() => { set({ deviceName: name, pin }); toast(t('c.saved')); }}>{t('c.save')}</Button></div>
        </div>
      </Card>
    </div>
  );
}
