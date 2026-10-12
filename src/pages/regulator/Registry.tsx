import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, CalendarPlus, FileText, FilePlus2, Pause, Play } from 'lucide-react';
import { useStore } from '@/store/store';
import { useRegistry, type RegistryRow } from '@/store/selectors';
import { can, scopePharmacies } from '@/store/rbac';
import { useL } from '@/i18n';
import { fmtDate, fmtDateTime, fmtKip, fmtNum, fmtAxisKip } from '@/lib/format';
import { useColors } from '@/lib/useColors';
import { ChartTooltip } from '@/components/ChartTooltip';
import { MiniMap } from '@/components/MapView';
import { Badge, Button, Card, ConfirmDialog, DataTable, DescList, ExpiryBadge, PageHeader, SearchInput, Select, StatusBadge, Tabs, Toolbar, useFakeLoading, useToast } from '@/components/ui';
import { PlanDialog } from './Inspections';

export default function Registry() {
  const { t } = useTranslation();
  const L = useL();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, db } = useStore();
  const all = useRegistry();
  const loading = useFakeLoading();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [prov, setProv] = useState('');
  const [dist, setDist] = useState('');
  const [status, setStatus] = useState('');
  const [lic, setLic] = useState(params.get('lic') ?? '');
  const scoped = useMemo(() => scopePharmacies(user, all) as RegistryRow[], [user, all]);
  const rows = scoped.filter((p) =>
    (!q || `${p.name.lo} ${p.name.en} ${p.code} ${p.license.number} ${p.owner.lo} ${p.owner.en}`.toLowerCase().includes(q.toLowerCase())) &&
    (!prov || p.provinceId === prov) && (!dist || p.districtId === dist) && (!status || p.status === status) && (!lic || p.lic === lic));

  return (
    <div>
      <PageHeader title={t('reg.title')} actions={can(user, 'registry.edit') && <Button icon={FilePlus2} onClick={() => nav('/gov/register')}>{t('nav.register')}</Button>} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} className="sm:w-72" />
          {!user?.provinceId && <Select value={prov} onChange={(e) => { setProv(e.target.value); setDist(''); }} className="sm:w-48" aria-label={t('c.province')}><option value="">{t('c.province')}: {t('c.all')}</option>{db.provinces.map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}</Select>}
          <Select value={dist} onChange={(e) => setDist(e.target.value)} className="sm:w-44" aria-label={t('c.district')}><option value="">{t('c.district')}: {t('c.all')}</option>{db.districts.filter((d) => d.provinceId === (prov || user?.provinceId)).map((d) => <option key={d.id} value={d.id}>{L(d.name)}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40" aria-label={t('c.status')}><option value="">{t('c.status')}: {t('c.all')}</option>{['ACTIVE', 'PENDING', 'SUSPENDED', 'CLOSED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}</Select>
          <Select value={lic} onChange={(e) => setLic(e.target.value)} className="sm:w-48" aria-label={t('reg.licenseStatus')}><option value="">{t('reg.licenseStatus')}: {t('c.all')}</option>{['VALID', 'EXPIRING', 'RENEWAL_PENDING', 'EXPIRED', 'REVOKED'].map((s) => <option key={s} value={s}>{t(`st.${s}`)}</option>)}</Select>
          <span className="num text-sm text-muted sm:ml-auto">{t('rep.records', { n: rows.length })}</span>
        </Toolbar>
        <DataTable loading={loading} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => nav(`/gov/registry/${r.id}`)} initialSort={{ key: 'name', dir: 'asc' }} columns={[
          { key: 'name', header: t('c.name'), mobile: 'title', sort: (r) => L(r.name), render: (r) => <span><span className="font-medium">{L(r.name)}</span><span className="num block text-xs text-muted">{r.code} · {t(`ptype.${r.type}`)}</span></span> },
          { key: 'loc', header: t('c.province'), sort: (r) => r.provinceId, render: (r) => <span>{L(db.provinces.find((p) => p.id === r.provinceId)!.name)}<span className="block text-xs text-muted">{L(db.districts.find((d) => d.id === r.districtId)!.name)}</span></span> },
          { key: 'st', header: t('c.status'), sort: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
          { key: 'lic', header: t('reg.licenseStatus'), sort: (r) => r.licDays, render: (r) => <span className="flex flex-col items-start gap-1"><StatusBadge status={r.lic} />{r.lic !== 'VALID' && r.lic !== 'REVOKED' && <span className="num text-xs text-muted">{fmtDate(r.license.expiryDate)}</span>}</span> },
          { key: 'last', header: t('reg.lastInspection'), sort: (r) => r.last?.date ?? '', render: (r) => r.last ? <span className="flex flex-col items-start gap-1"><StatusBadge status={r.last.result!} /><span className="num text-xs text-muted">{fmtDate(r.last.date)} · {r.last.score}%</span></span> : '—' },
        ]} />
      </Card>
    </div>
  );
}

type TabKey = 'overview' | 'license' | 'inspections' | 'corrective' | 'controlled' | 'reports' | 'audit';

export function PharmacyDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const c = useColors();
  const { user, db, monthly, state, write } = useStore();
  const all = useRegistry();
  const p = all.find((x) => x.id === id);
  const [tab, setTab] = useState<TabKey>('overview');
  const [confirm, setConfirm] = useState(false);
  const [plan, setPlan] = useState(false);
  if (!p || !scopePharmacies(user, [p]).length) return <p className="p-8 text-center text-muted">{t('c.noResults')}</p>;

  const inspections = db.inspections.filter((i) => i.pharmacyId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const cas = db.corrective.filter((x) => x.pharmacyId === p.id);
  const docs = db.documents.filter((d) => d.pharmacyId === p.id);
  const stats = monthly.filter((m) => m.pharmacyId === p.id).map((m) => ({ ...m, label: m.month.slice(2) }));
  const reports = db.reports.filter((r) => r.pharmacyId === p.id).sort((a, b) => b.month.localeCompare(a.month));
  const audit = state.audit.filter((a) => a.entityId === p.id || a.entityId === p.code).slice(0, 30);
  const suspended = p.status === 'SUSPENDED';

  return (
    <div className="space-y-5">
      <PageHeader back={<Link to="/gov/registry" className="mb-1 inline-flex items-center gap-1 text-sm text-accent hover:underline"><ArrowLeft className="h-4 w-4" />{t('reg.title')}</Link>}
        title={L(p.name)} subtitle={<span className="flex flex-wrap items-center gap-2"><span className="num">{p.code}</span><StatusBadge status={p.status} /><StatusBadge status={p.lic} /></span>}
        actions={<>
          {can(user, 'inspection.plan') && <Button variant="secondary" icon={CalendarPlus} onClick={() => setPlan(true)}>{t('reg.scheduleInspection')}</Button>}
          {can(user, 'license.approve') && <Button variant={suspended ? 'primary' : 'danger'} icon={suspended ? Play : Pause} onClick={() => setConfirm(true)}>{suspended ? t('reg.reinstate') : t('reg.suspend')}</Button>}
        </>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'overview', label: t('reg.tab.overview') }, { value: 'license', label: t('reg.tab.license'), count: docs.length },
        { value: 'inspections', label: t('reg.tab.inspections'), count: inspections.length }, { value: 'corrective', label: t('reg.tab.corrective'), count: cas.length },
        { value: 'controlled', label: t('reg.tab.controlled') }, { value: 'reports', label: t('reg.tab.reports') }, { value: 'audit', label: t('reg.tab.audit') },
      ]} />

      {tab === 'overview' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={t('c.details')}>
            <DescList items={[
              [t('c.type'), t(`ptype.${p.type}`)], [t('lic.number'), <span className="num">{p.license.number}</span>],
              [t('lic.owner'), L(p.owner)], [t('lic.pharmacist'), L(p.pharmacist)],
              [t('lic.address'), `${p.village}, ${L(db.districts.find((d) => d.id === p.districtId)!.name)}, ${L(db.provinces.find((x) => x.id === p.provinceId)!.name)}`],
              [t('c.phone'), <span className="num">{p.phone}</span>],
              [t('reg.lastInspection'), p.last ? <span className="flex gap-2"><StatusBadge status={p.last.result!} /><span className="num">{fmtDate(p.last.date)} · {p.last.score}%</span></span> : '—'],
              [t('lic.expiry'), <span className="flex gap-2"><span className="num">{fmtDate(p.license.expiryDate)}</span><ExpiryBadge days={p.licDays} /></span>],
            ]} />
          </Card>
          <Card title={t('lic.gps')} pad={false}><MiniMap lat={p.lat} lng={p.lng} height={230} /></Card>
          <Card title={t('reg.monthlySales')} className="lg:col-span-3">
            <div className="h-56"><ResponsiveContainer>
              <BarChart data={stats} margin={{ top: 8, left: 4, right: 4 }}>
                <CartesianGrid vertical={false} stroke={c.border} />
                <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.border }} />
                <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmtAxisKip} />
                <Tooltip cursor={{ fill: c['primary-soft'], opacity: 0.4 }} content={<ChartTooltip fmt={fmtKip} />} />
                <Bar dataKey="sales" name={t('rep.revenue')} fill={c.accent} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer></div>
          </Card>
        </div>
      )}

      {tab === 'license' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={t('dash.licenseCard')}><DescList items={[[t('lic.number'), <span className="num">{p.license.number}</span>], [t('reg.licenseStatus'), <StatusBadge status={p.lic} />], [t('lic.issue'), fmtDate(p.license.issueDate)], [t('lic.expiry'), fmtDate(p.license.expiryDate)]]} /></Card>
          <Card title={t('lic.documents')} pad={false}>
            <ul className="divide-y divide-border">{docs.map((d) => <li key={d.id} className="flex items-center gap-3 px-4 py-3"><FileText className="h-5 w-5 text-accent" /><span className="flex-1 text-sm">{d.fileName}<span className="block text-xs text-muted">{t(`doc.${d.type}`)} · {d.sizeKb} KB</span></span><Button size="sm" variant="ghost">{t('c.view')}</Button></li>)}</ul>
          </Card>
        </div>
      )}

      {tab === 'inspections' && (
        <Card pad={false}><DataTable rows={inspections} rowKey={(r) => r.id} columns={[
          { key: 'date', header: t('c.date'), mobile: 'title', render: (r) => <span className="num font-medium">{fmtDate(r.date)}</span> },
          { key: 'ins', header: t('ins.inspector'), render: (r) => r.inspectorIds.map((u) => L(db.users.find((x) => x.id === u)!.name)).join(', ') },
          { key: 'st', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
          { key: 'score', header: t('ins.score'), align: 'right', render: (r) => (r.score !== undefined ? `${r.score}%` : '—') },
          { key: 'res', header: t('ins.result'), render: (r) => (r.result ? <StatusBadge status={r.result} /> : '—') },
          { key: 'go', header: '', align: 'right', render: (r) => <Link className="text-sm text-accent hover:underline" to={`/gov/inspections/${r.id}`}>{t('c.open')}</Link> },
        ]} /></Card>
      )}

      {tab === 'corrective' && (
        <Card pad={false}><DataTable rows={cas} rowKey={(r) => r.id} columns={[
          { key: 'f', header: t('ca.finding'), mobile: 'title', render: (r) => <span className="font-medium">{L(r.finding)}</span> },
          { key: 'a', header: t('ca.action'), render: (r) => L(r.action) },
          { key: 'd', header: t('dash.deadline'), render: (r) => <span className="num">{fmtDate(r.deadline)}</span> },
          { key: 's', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
        ]} /></Card>
      )}

      {tab === 'controlled' && (
        <Card title={t('nat.cdTrend')}>
          <div className="h-56"><ResponsiveContainer>
            <BarChart data={stats} margin={{ top: 8, left: 4, right: 4 }}>
              <CartesianGrid vertical={false} stroke={c.border} />
              <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.border }} />
              <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip cursor={{ fill: c['primary-soft'], opacity: 0.4 }} content={<ChartTooltip />} />
              <Bar dataKey="controlledUnits" name={t('cdm.units')} fill={c.danger} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer></div>
          <p className="num mt-2 text-sm text-muted">Σ {fmtNum(stats.reduce((a, s) => a + s.controlledUnits, 0))} {t('cdm.units')} · {fmtNum(stats.reduce((a, s) => a + s.prescriptions, 0))} {t('nav.prescriptions')}</p>
        </Card>
      )}

      {tab === 'reports' && (
        <Card pad={false}><DataTable rows={reports} rowKey={(r) => r.id} dense columns={[
          { key: 'm', header: t('c.month'), mobile: 'title', render: (r) => <span className="num font-medium">{r.month}</span> },
          { key: 't', header: t('c.type'), render: (r) => t(`rt.${r.type}`) },
          { key: 's', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
          { key: 'at', header: t('ren.submitted'), render: (r) => <span className="num">{fmtDate(r.submittedAt)}</span> },
        ]} /></Card>
      )}

      {tab === 'audit' && (
        <Card pad={false}><DataTable rows={audit} rowKey={(r) => r.id} columns={[
          { key: 'at', header: t('c.date'), render: (r) => <span className="num">{fmtDateTime(r.at)}</span> },
          { key: 'actor', header: t('aud.actor'), mobile: 'title', render: (r) => { const u = db.users.find((x) => x.id === r.actor); return u ? L(u.name) : r.actor; } },
          { key: 'act', header: t('aud.action'), render: (r) => <Badge icon={null}>{r.action}</Badge> },
          { key: 'e', header: t('aud.entity'), render: (r) => r.entity },
        ]} /></Card>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger={!suspended} title={suspended ? t('reg.reinstate') : t('reg.suspend')}
        onConfirm={() => { write('pharmacies', { ...db.pharmacies.find((x) => x.id === p.id)!, status: suspended ? 'ACTIVE' : 'SUSPENDED' }, `${suspended ? 'Reinstate' : 'Suspend'} ${p.code}`, 'UPDATE'); toast(suspended ? t('reg.reinstated') : t('reg.suspended'), suspended ? 'success' : 'warning'); }} />
      {plan && <PlanDialog pharmacyId={p.id} onClose={() => setPlan(false)} />}
    </div>
  );
}
