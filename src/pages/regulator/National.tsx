import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BadgeCheck, Building2, CalendarClock, ClipboardList, Percent, ShieldX } from 'lucide-react';
import { useStore } from '@/store/store';
import { useAnomalies, useRegistry } from '@/store/selectors';
import { scopePharmacies } from '@/store/rbac';
import { useL } from '@/i18n';
import { monthKey, today } from '@/lib/format';
import { useColors, type Colors } from '@/lib/useColors';
import { ChartTooltip } from '@/components/ChartTooltip';
import { PharmacyMap } from '@/components/MapView';
import { Card, Kpi, PageHeader, Segmented, Select } from '@/components/ui';
import type { LicenseStatus } from '@/data/types';

export const licColor = (s: LicenseStatus, c: Colors) => (s === 'VALID' ? c.success : s === 'EXPIRING' || s === 'RENEWAL_PENDING' ? c.warning : c.danger);
export const resColor = (r: string | undefined, c: Colors) => (r === 'PASS' ? c.success : r === 'PASS_WITH_CONDITIONS' ? c.warning : r === 'FAIL' ? c.danger : c.muted);

export default function National() {
  const { t } = useTranslation();
  const L = useL();
  const nav = useNavigate();
  const c = useColors();
  const { user, db, monthly } = useStore();
  const all = useRegistry();
  const scoped = useMemo(() => scopePharmacies(user, all) as typeof all, [user, all]);
  const [colorBy, setColorBy] = useState<'license' | 'compliance'>('license');
  const [prov, setProv] = useState('');
  const [licFilter, setLicFilter] = useState('');
  const now = today();
  const flags = useAnomalies().filter((f) => scoped.some((p) => p.id === f.pharmacyId));
  const ids = new Set(scoped.map((p) => p.id));
  const thisMonth = monthKey(now);

  const insps = db.inspections.filter((i) => ids.has(i.pharmacyId) && i.status === 'COMPLETED');
  const monthInsps = insps.filter((i) => monthKey(i.date) === thisMonth || (now.getTime() - new Date(i.date).getTime()) / 86_400_000 < 30);
  const passRate = insps.length ? Math.round((insps.filter((i) => i.result !== 'FAIL').length / insps.length) * 100) : 0;
  const openCa = db.corrective.filter((x) => ids.has(x.pharmacyId) && (x.status === 'OPEN' || x.status === 'OVERDUE')).length;
  const exp = (d: number) => scoped.filter((p) => p.licDays >= 0 && p.licDays <= d).length;

  const byProvince = useMemo(() => db.provinces.map((p) => ({ name: L(p.name), count: scoped.filter((x) => x.provinceId === p.id).length })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count), [db.provinces, scoped, L]);
  const months = [...new Set(monthly.map((m) => m.month))].sort();
  const cdTrend = months.map((m) => ({ month: m.slice(2), units: monthly.filter((x) => x.month === m && ids.has(x.pharmacyId)).reduce((a, x) => a + x.controlledUnits, 0) }));
  const compTrend = months.map((m) => {
    const list = db.inspections.filter((i) => ids.has(i.pharmacyId) && i.status === 'COMPLETED' && monthKey(i.date) <= m);
    const recent = list.filter((i) => monthKey(i.date) >= months[Math.max(0, months.indexOf(m) - 5)]);
    return { month: m.slice(2), score: recent.length ? Math.round(recent.reduce((a, i) => a + (i.score ?? 0), 0) / recent.length) : null };
  });

  const points = scoped
    .filter((p) => (!prov || p.provinceId === prov) && (!licFilter || p.lic === licFilter))
    .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: L(p.name), sub: `${t(`st.${p.lic}`)} · ${p.last?.result ? t(`st.${p.last.result}`) : '—'}`, color: colorBy === 'license' ? licColor(p.lic, c) : resColor(p.last?.result, c) }));
  const legend = colorBy === 'license'
    ? [[c.success, t('st.VALID')], [c.warning, `${t('st.EXPIRING')} / ${t('st.RENEWAL_PENDING')}`], [c.danger, `${t('st.EXPIRED')} / ${t('st.REVOKED')}`]]
    : [[c.success, t('st.PASS')], [c.warning, t('st.PASS_WITH_CONDITIONS')], [c.danger, t('st.FAIL')], [c.muted, '—']];
  const axis = { tick: { fill: c.muted, fontSize: 12 }, tickLine: false };

  return (
    <div className="space-y-5">
      <PageHeader title={t('nat.title')} subtitle={user?.provinceId ? t('nat.scopeProvince', { p: L(db.provinces.find((p) => p.id === user.provinceId)!.name) }) : t('nat.scopeNational')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Building2} tone="accent" label={t('nat.totalPharmacies')} value={scoped.length} sub={`${scoped.filter((p) => p.status === 'ACTIVE').length} ${t('nat.active')}`} onClick={() => nav('/gov/registry')} />
        <Kpi icon={CalendarClock} tone="warning" label={t('nat.expiryBuckets')} value={<span className="flex items-baseline gap-3 text-xl"><span>{exp(30)}<small className="ml-0.5 text-xs text-muted">30d</small></span><span>{exp(60)}<small className="ml-0.5 text-xs text-muted">60d</small></span><span>{exp(90)}<small className="ml-0.5 text-xs text-muted">90d</small></span></span>} onClick={() => nav('/gov/renewals')} />
        <Kpi icon={ShieldX} tone="danger" label={t('nat.expired')} value={scoped.filter((p) => p.lic === 'EXPIRED').length} onClick={() => nav('/gov/registry?lic=EXPIRED')} />
        <Kpi icon={ClipboardList} tone="warning" label={t('nat.openCa')} value={openCa} onClick={() => nav('/gov/corrective')} />
        <Kpi icon={BadgeCheck} tone="success" label={t('nat.inspectionsMonth')} value={monthInsps.length} onClick={() => nav('/gov/inspections')} />
        <Kpi icon={Percent} tone="success" label={t('nat.passRate')} value={`${passRate}%`} sub={`${insps.length} ${t('nav.inspections')}`} />
        <Kpi icon={AlertTriangle} tone="danger" label={t('cdm.flags')} value={flags.length} onClick={() => nav('/gov/controlled')} />
        <Kpi icon={Building2} tone="neutral" label={`${t('st.PENDING')} / ${t('st.SUSPENDED')}`} value={`${scoped.filter((p) => p.status === 'PENDING').length} / ${scoped.filter((p) => p.status === 'SUSPENDED').length}`} />
      </div>

      <Card title={t('nat.map')} pad={false} action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={prov} onChange={(e) => setProv(e.target.value)} className="h-9 w-44 text-sm" aria-label={t('c.province')}>
            <option value="">{t('c.province')}: {t('c.all')}</option>
            {db.provinces.filter((p) => scoped.some((s) => s.provinceId === p.id)).map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}
          </Select>
          <Select value={licFilter} onChange={(e) => setLicFilter(e.target.value)} className="h-9 w-44 text-sm" aria-label={t('reg.licenseStatus')}>
            <option value="">{t('reg.licenseStatus')}: {t('c.all')}</option>
            {['VALID', 'EXPIRING', 'RENEWAL_PENDING', 'EXPIRED', 'REVOKED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}
          </Select>
          <Segmented value={colorBy} onChange={setColorBy} options={[{ value: 'license', label: t('nat.byLicense') }, { value: 'compliance', label: t('nat.byCompliance') }]} />
        </div>}>
        <div className="p-3"><PharmacyMap points={points} ring={c.surface} onSelect={(id) => nav(`/gov/registry/${id}`)} /></div>
        <div className="flex flex-wrap gap-4 border-t border-border px-4 py-2.5 text-sm">
          {legend.map(([col, lbl]) => <span key={lbl} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full ring-2 ring-surface" style={{ background: col }} />{lbl}</span>)}
          <span className="num ml-auto text-muted">{points.length}</span>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t('nat.byProvince')}>
          <div style={{ height: Math.max(220, byProvince.length * 26) }}>
            <ResponsiveContainer>
              <BarChart data={byProvince} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} {...axis} axisLine={false} />
                <Tooltip cursor={{ fill: c['primary-soft'], opacity: 0.4 }} content={<ChartTooltip />} />
                <Bar dataKey="count" name={t('nat.totalPharmacies')} fill={c.accent} radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fill: c.text, fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t('nat.complianceTrend')}>
          <div className="h-64"><ResponsiveContainer>
            <LineChart data={compTrend} margin={{ top: 8, right: 12, left: -8 }}>
              <CartesianGrid vertical={false} stroke={c.border} />
              <XAxis dataKey="month" {...axis} axisLine={{ stroke: c.border }} />
              <YAxis domain={[50, 100]} {...axis} axisLine={false} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="score" name={t('reg.score')} stroke={c.primary} strokeWidth={2} dot={{ r: 3, fill: c.primary, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer></div>
        </Card>
        <Card title={t('nat.cdTrend')}>
          <div className="h-64"><ResponsiveContainer>
            <LineChart data={cdTrend} margin={{ top: 8, right: 12, left: -8 }}>
              <CartesianGrid vertical={false} stroke={c.border} />
              <XAxis dataKey="month" {...axis} axisLine={{ stroke: c.border }} />
              <YAxis {...axis} axisLine={false} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="units" name={t('cdm.units')} stroke={c.danger} strokeWidth={2} dot={{ r: 3, fill: c.danger, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer></div>
        </Card>
      </div>
    </div>
  );
}

