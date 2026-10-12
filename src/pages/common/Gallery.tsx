import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Bell, Building2, PackageOpen, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useStore } from '@/store/store';
import { Alert, Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, ExpiryBadge, Field, IconButton, Input, Kpi, PageHeader, Segmented, Select, Skeleton, SkeletonRows, StatusBadge, Stepper, Tabs, Textarea, useToast } from '@/components/ui';
import { SyncIndicator } from '@/components/layout/AppShell';

const TOKENS = ['primary', 'primary-soft', 'accent', 'bg', 'surface', 'border', 'text', 'muted', 'success', 'warning', 'danger'];

export default function Gallery() {
  const { t } = useTranslation();
  const toast = useToast();
  const { state, set } = useStore();
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [tab, setTab] = useState<'one' | 'two'>('one');
  const [qty, setQty] = useState(2);
  const [confirm, setConfirm] = useState(false);
  const rows = [
    { id: '1', name: 'Paracetamol 500 mg', st: 'VALID', qty: 1240, days: 412 },
    { id: '2', name: 'Amoxicillin 500 mg', st: 'EXPIRING', qty: 32, days: 24 },
    { id: '3', name: 'Diazepam 5 mg', st: 'EXPIRED', qty: 8, days: -6 },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t('gal.title')} subtitle={t('gal.subtitle')} actions={
        <div className="flex flex-wrap gap-2">
          <Segmented value={state.lang} onChange={(v) => set({ lang: v })} options={[{ value: 'lo', label: 'ລາວ' }, { value: 'en', label: 'EN' }]} />
          <Segmented value={state.theme === 'dark' ? 'dark' : 'light'} onChange={(v) => set({ theme: v })} options={[{ value: 'light', label: t('top.light') }, { value: 'dark', label: t('top.dark') }]} />
        </div>} />

      <Card title={t('gal.colors')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {TOKENS.map((k) => (
            <div key={k} className="overflow-hidden rounded-ctl border border-border">
              <div className="h-14" style={{ background: `rgb(var(--${k}))` }} />
              <p className="px-2 py-1.5 font-mono text-xs">--{k}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('gal.typography')}>
          <p className="text-2xl font-semibold">ລະບົບຄຸ້ມຄອງຮ້ານຂາຍຢາ · Pharmacy</p>
          <p className="mt-1">ຂໍ້ຄວາມພາສາລາວໃຊ້ Noto Sans Lao ແລະ line-height 1.6 · Latin uses Inter.</p>
          <p className="num mt-1 text-muted">125,000 ₭ · 11/10/2026 · 0123456789</p>
        </Card>
        <Card title={t('gal.buttons')}>
          <div className="flex flex-wrap gap-2">
            <Button icon={Plus}>{t('c.add')}</Button>
            <Button variant="secondary">{t('c.cancel')}</Button>
            <Button variant="accent">{t('c.approve')}</Button>
            <Button variant="ghost">{t('c.more')}</Button>
            <Button variant="danger" icon={Trash2}>{t('c.delete')}</Button>
            <Button disabled>{t('c.save')}</Button>
            <Button size="xl">POS 56px</Button>
            <IconButton icon={Bell} label="bell" badge={3} />
          </div>
        </Card>
      </div>

      <Card title={t('gal.badges')}>
        <div className="flex flex-wrap gap-2">
          {['VALID', 'EXPIRING', 'EXPIRED', 'RENEWAL_PENDING', 'REVOKED', 'ACTIVE', 'SUSPENDED', 'PASS', 'PASS_WITH_CONDITIONS', 'FAIL', 'OPEN', 'OVERDUE', 'BANNED', 'RECALLED', 'PLANNED'].map((s) => <StatusBadge key={s} status={s} />)}
          <ExpiryBadge days={180} /><ExpiryBadge days={28} /><ExpiryBadge days={-3} />
          <Badge tone="danger" icon={ShieldAlert}>{t('cat.CONTROLLED')}</Badge>
        </div>
        <div className="mt-4"><SyncIndicator /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('gal.inputs')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('c.name')} required><Input placeholder="ຮ້ານຂາຍຢາ…" /></Field>
            <Field label={t('c.province')}><Select><option>ນະຄອນຫຼວງວຽງຈັນ</option></Select></Field>
            <Field label={t('c.reason')} error={t('stock.reasonRequired')}><Input aria-invalid /></Field>
            <Field label={t('c.qty')}><Stepper value={qty} onChange={setQty} /></Field>
            <Field label={t('c.notes')} className="sm:col-span-2"><Textarea /></Field>
            <Segmented value={seg} onChange={setSeg} options={[{ value: 'a', label: '30' }, { value: 'b', label: '60' }, { value: 'c', label: '90' }]} />
          </div>
          <div className="mt-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'one', label: t('reg.tab.overview') }, { value: 'two', label: t('reg.tab.inspections'), count: 4 }]} /></div>
        </Card>
        <Card title={t('gal.feedback')}>
          <div className="space-y-3">
            <Alert tone="success">{t('c.saved')}</Alert>
            <Alert tone="warning">{t('sync.warn7', { n: 8 })}</Alert>
            <Alert tone="danger">{t('sync.block14')}</Alert>
            <Alert tone="accent">{t('lic.renewalPending')}</Alert>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => toast(t('c.saved'))}>{t('gal.toast')}</Button>
              <Button variant="secondary" onClick={() => setConfirm(true)}>{t('gal.dialog')}</Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} label={t('dash.todaySales')} value="4,250,000 ₭" sub={t('dash.receipts', { n: 18 })} />
        <Kpi icon={Building2} tone="accent" label={t('nat.totalPharmacies')} value="50" />
        <Kpi icon={ShieldAlert} tone="warning" label={t('nat.expiring')} value="7" />
        <Kpi icon={ShieldAlert} tone="danger" label={t('nat.expired')} value="4" />
      </div>

      <Card title={t('gal.table')} pad={false}>
        <DataTable rows={rows} rowKey={(r) => r.id} columns={[
          { key: 'n', header: t('stock.drug'), mobile: 'title', sort: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'q', header: t('stock.onHand'), align: 'right', sort: (r) => r.qty, render: (r) => r.qty.toLocaleString('en-US') },
          { key: 'e', header: t('stock.expiry'), render: (r) => <ExpiryBadge days={r.days} /> },
          { key: 's', header: t('c.status'), render: (r) => <StatusBadge status={r.st} /> },
        ]} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('gal.empty')}><EmptyState icon={PackageOpen} title={t('pos.emptyCart')} hint={t('pos.emptyCartHint')} action={<Button>{t('dash.newSale')}</Button>} /></Card>
        <Card title={t('gal.skeleton')} pad={false}><div className="space-y-2 p-4"><Skeleton className="h-6 w-1/3" /><Skeleton className="w-2/3" /></div><SkeletonRows rows={3} /></Card>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => toast(t('c.saved'))} title={t('c.areYouSure')} danger />
    </div>
  );
}
