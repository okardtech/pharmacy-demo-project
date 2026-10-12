import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Banknote, ClipboardList, FileCheck2, PackagePlus, Receipt, ShoppingCart, Stethoscope, TrendingUp, Warehouse } from 'lucide-react';
import { useStore } from '@/store/store';
import { usePharmacy } from '@/store/selectors';
import { can } from '@/store/rbac';
import { useL } from '@/i18n';
import { Alert, Badge, Button, Card, EmptyState, ExpiryBadge, Kpi, Segmented, StatusBadge, cx } from '@/components/ui';
import { addDays, fmtDate, fmtKip, fmtNum, isSameDay, fmtAxisKip } from '@/lib/format';
import { useColors } from '@/lib/useColors';
import { ChartTooltip } from '@/components/ChartTooltip';

export default function PharmacyDashboard() {
  const { t } = useTranslation();
  const L = useL();
  const nav = useNavigate();
  const { user, db } = useStore();
  const ph = usePharmacy();
  const c = useColors();
  const [bucket, setBucket] = useState<'30' | '60' | '90'>('90');

  const todays = ph.sales.filter((s) => isSameDay(s.at, ph.now));
  const total = todays.reduce((a, s) => a + s.total, 0);
  const margin = todays.reduce((a, s) => a + s.lines.reduce((x, l) => x + (l.price - l.cost) * l.qty, 0) - s.discount, 0);
  const rxToday = db.prescriptions.filter((p) => p.pharmacyId === ph.pharmacyId && isSameDay(p.date, ph.now)).length;
  const stockValue = ph.stock.reduce((a, s) => a + s.value, 0);
  const cas = db.corrective.filter((x) => x.pharmacyId === ph.pharmacyId && (x.status === 'OPEN' || x.status === 'OVERDUE'));

  const trend = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = addDays(ph.now, i - 13);
    return { day: fmtDate(d.toISOString()).slice(0, 5), total: ph.sales.filter((s) => isSameDay(s.at, d)).reduce((a, s) => a + s.total, 0) };
  }), [ph.sales, ph.now]);

  const near = ph.nearExpiry.filter((b) => b.days <= Number(bucket));
  const licTone = ph.licenseDays < 0 ? 'text-danger' : ph.licenseDays <= 90 ? 'text-warning' : 'text-success';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{fmtDate(new Date().toISOString())} · {L(ph.pharmacy.name)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('dash.greeting', { name: user ? L(user.name).split(' ')[0] : '' })}</h1>
        </div>
        <div className="flex gap-2">
          {can(user, 'pos.sell') && <Button size="lg" icon={ShoppingCart} onClick={() => nav('/app/pos')}>{t('dash.newSale')}</Button>}
          {can(user, 'stock.receive') && <Button size="lg" variant="secondary" icon={PackagePlus} onClick={() => nav('/app/receive')}>{t('dash.receiveStock')}</Button>}
        </div>
      </div>

      {ph.flagged.length > 0 && (
        <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={() => nav('/app/stock?filter=recalled')}>{t('c.view')}</Button>}>
          <b>{t('dash.recallBanner')}</b>: {ph.flagged.map((f) => `${f.drug.brand} (${t(`st.${f.drug.status}`)})`).join(', ')}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Banknote} label={t('dash.todaySales')} value={fmtKip(total)} sub={t('dash.receipts', { n: todays.length })} onClick={() => nav('/app/reports')} />
        <Kpi icon={TrendingUp} tone="success" label={t('dash.margin')} value={fmtKip(margin)} sub={total ? `${Math.round((margin / total) * 100)}%` : '—'} />
        <Kpi icon={Stethoscope} tone="accent" label={t('dash.rxToday')} value={fmtNum(rxToday)} onClick={() => nav('/app/prescriptions')} />
        <Kpi icon={Warehouse} tone="neutral" label={t('dash.stockValue')} value={fmtKip(stockValue)} sub={`${ph.stock.filter((s) => s.qty > 0).length} SKU`} onClick={() => nav('/app/stock')} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t('dash.salesTrend')} className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ left: 4, right: 4, top: 8 }}>
                <CartesianGrid vertical={false} stroke={c.border} />
                <XAxis dataKey="day" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.border }} />
                <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={fmtAxisKip} width={40} />
                <Tooltip cursor={{ fill: c['primary-soft'], opacity: 0.4 }} content={<ChartTooltip fmt={fmtKip} />} />
                <Bar dataKey="total" name={t('rep.revenue')} fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('dash.licenseCard')} action={<StatusBadge status={ph.licenseStatus} />}>
          <div className="flex items-center gap-4">
            <div className={cx('relative grid h-24 w-24 shrink-0 place-items-center rounded-full border-[6px]', ph.licenseDays <= 90 ? 'border-warning/30' : 'border-success/30')}>
              <div className="text-center"><p className={cx('num text-2xl font-semibold leading-none', licTone)}>{Math.max(0, ph.licenseDays)}</p><p className="text-xs text-muted">{t('c.days', { n: '' }).trim()}</p></div>
            </div>
            <div className="min-w-0 space-y-1 text-sm">
              <p className="num font-medium">{ph.pharmacy.license.number}</p>
              <p className="text-muted">{t('lic.expiry')}: <span className="num text-text">{fmtDate(ph.pharmacy.license.expiryDate)}</span></p>
              <ExpiryBadge days={ph.licenseDays} />
            </div>
          </div>
          {can(user, 'license.renew') && ph.licenseStatus !== 'RENEWAL_PENDING' && ph.licenseDays <= 90 && (
            <Button className="mt-4 w-full" variant="secondary" icon={FileCheck2} onClick={() => nav('/app/license')}>{t('dash.renewNow')}</Button>
          )}
          {ph.licenseStatus === 'RENEWAL_PENDING' && <p className="mt-4 text-sm text-muted">{t('lic.renewalPending')}</p>}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t('dash.lowStock')} pad={false} action={<Badge tone="warning">{ph.lowStock.length}</Badge>}>
          {ph.lowStock.length === 0 ? <EmptyState title={t('dash.allGood')} /> : (
            <ul className="divide-y divide-border">
              {ph.lowStock.slice(0, 6).map((s) => (
                <li key={s.drug.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{s.drug.brand}</p><p className="truncate text-xs text-muted">{s.drug.generic} {s.drug.strength}</p></div>
                  <Badge tone={s.qty < 15 ? 'danger' : 'warning'}><span className="num">{s.qty}</span></Badge>
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/stock?filter=low" className="block border-t border-border px-4 py-2.5 text-sm text-accent hover:underline">{t('c.viewAll')}</Link>
        </Card>

        <Card title={t('dash.nearExpiry')} pad={false} action={<Segmented value={bucket} onChange={setBucket} options={[{ value: '30', label: '30' }, { value: '60', label: '60' }, { value: '90', label: '90' }]} />}>
          {near.length === 0 ? <EmptyState title={t('dash.allGood')} /> : (
            <ul className="divide-y divide-border">
              {near.slice(0, 6).map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{b.drug.brand}</p><p className="num truncate text-xs text-muted">{b.lot} · {b.qty} pcs</p></div>
                  <ExpiryBadge days={b.days} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/stock?filter=expiring" className="block border-t border-border px-4 py-2.5 text-sm text-accent hover:underline">{t('c.viewAll')} ({near.length})</Link>
        </Card>

        <Card title={t('dash.correctiveActions')} pad={false} action={<Badge tone={cas.length ? 'warning' : 'success'}>{cas.length}</Badge>}>
          {cas.length === 0 ? <EmptyState icon={ClipboardList} title={t('dash.allGood')} /> : (
            <ul className="divide-y divide-border">
              {cas.map((ca) => (
                <li key={ca.id} className="space-y-1 px-4 py-3">
                  <p className="text-sm font-medium">{L(ca.action)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted"><AlertTriangle className="h-3.5 w-3.5" />{t('dash.deadline')}: <span className="num">{fmtDate(ca.deadline)}</span><StatusBadge status={ca.status} /></div>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
            <Button size="sm" variant="secondary" icon={Receipt} onClick={() => nav('/app/reports')}>{t('nav.reports')}</Button>
            <Button size="sm" variant="secondary" icon={FileCheck2} onClick={() => nav('/app/license')}>{t('dash.licenseCard')}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
