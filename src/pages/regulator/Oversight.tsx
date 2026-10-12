import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Check, FileSpreadsheet, ShieldCheck, ShieldAlert, UserPlus } from 'lucide-react';
import { useStore } from '@/store/store';
import { useAnomalies, useRegistry } from '@/store/selectors';
import { can, scopePharmacies } from '@/store/rbac';
import { useL } from '@/i18n';
import { GPP_TEMPLATE } from '@/data/seed';
import { fmtDate, fmtDateTime, fmtNum } from '@/lib/format';
import { useColors } from '@/lib/useColors';
import { ChartTooltip } from '@/components/ChartTooltip';
import type { CorrectiveAction, ReportType } from '@/data/types';
import { Alert, Badge, Button, Card, DataTable, Dialog, EmptyState, Field, Input, Kpi, PageHeader, SearchInput, Segmented, Select, StatusBadge, Toolbar, cx, useToast } from '@/components/ui';

/* ------------------------------------------------------------------ Corrective actions */

export function Corrective() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { user, db, write } = useStore();
  const reg = useRegistry();
  const ids = new Set(scopePharmacies(user, reg).map((p) => p.id));
  const [filter, setFilter] = useState<'ALL' | CorrectiveAction['status']>('ALL');
  const all = db.corrective.filter((c) => ids.has(c.pharmacyId));
  const rows = all.filter((c) => filter === 'ALL' || c.status === filter);
  return (
    <div>
      <PageHeader title={t('ca.title')} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['OPEN', 'SUBMITTED', 'OVERDUE', 'VERIFIED'] as const).map((s) => <Kpi key={s} icon={s === 'OVERDUE' ? AlertTriangle : s === 'VERIFIED' ? ShieldCheck : Check} tone={s === 'OVERDUE' ? 'danger' : s === 'VERIFIED' ? 'success' : s === 'OPEN' ? 'warning' : 'accent'} label={t(`st.${s}`)} value={all.filter((c) => c.status === s).length} onClick={() => setFilter(s)} />)}
      </div>
      <Card pad={false}>
        <div className="overflow-x-auto border-b border-border p-3"><Segmented value={filter} onChange={setFilter} options={(['ALL', 'OPEN', 'SUBMITTED', 'OVERDUE', 'VERIFIED'] as const).map((s) => ({ value: s, label: s === 'ALL' ? t('c.all') : t(`st.${s}`) }))} /></div>
        <DataTable rows={rows} rowKey={(r) => r.id} initialSort={{ key: 'deadline', dir: 'asc' }} columns={[
          { key: 'ph', header: t('nav.registry'), mobile: 'title', render: (r) => <Link className="font-medium hover:underline" to={`/gov/registry/${r.pharmacyId}`}>{L(db.pharmacies.find((p) => p.id === r.pharmacyId)!.name)}</Link> },
          { key: 'f', header: t('ca.finding'), render: (r) => <span className="line-clamp-2 text-sm">{L(r.finding)}</span> },
          { key: 'deadline', header: t('dash.deadline'), sort: (r) => r.deadline, render: (r) => <span className={cx('num', r.status === 'OVERDUE' && 'font-semibold text-danger')}>{fmtDate(r.deadline)}</span> },
          { key: 's', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
          { key: 'act', header: '', align: 'right', render: (r) => r.status === 'SUBMITTED' && can(user, 'inspection.plan') ? <Button size="sm" onClick={() => { write('corrective', { ...r, status: 'VERIFIED' }, 'Verify corrective action', 'APPROVE'); toast(t('ca.verified')); }}>{t('ca.verify')}</Button> : null },
        ]} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Controlled-drug monitoring */

export function ControlledMonitoring() {
  const { t } = useTranslation();
  const L = useL();
  const c = useColors();
  const { user, db, monthly } = useStore();
  const reg = useRegistry();
  const ids = new Set(scopePharmacies(user, reg).map((p) => p.id));
  const flags = useAnomalies().filter((f) => ids.has(f.pharmacyId));
  const [prov, setProv] = useState('');
  const byProvince = useMemo(() => db.provinces.map((p) => {
    const phs = db.pharmacies.filter((x) => x.provinceId === p.id && ids.has(x.id)).map((x) => x.id);
    return { name: L(p.name), id: p.id, units: monthly.filter((m) => phs.includes(m.pharmacyId)).reduce((a, m) => a + m.controlledUnits, 0) };
  }).filter((x) => x.units > 0).sort((a, b) => b.units - a.units), [db, monthly, L]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = db.pharmacies.filter((p) => ids.has(p.id) && (!prov || p.provinceId === prov)).map((p) => ({ p, units: monthly.filter((m) => m.pharmacyId === p.id).slice(-3).reduce((a, m) => a + m.controlledUnits, 0) })).sort((a, b) => b.units - a.units);
  return (
    <div className="space-y-5">
      <PageHeader title={t('cdm.title')} />
      <Card title={<span className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-danger" />{t('cdm.flags')}</span>}>
        {flags.length === 0 ? <EmptyState icon={ShieldCheck} title={t('cdm.noFlags')} /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {flags.map((f) => {
              const p = db.pharmacies.find((x) => x.id === f.pharmacyId)!;
              return (
                <Link key={f.pharmacyId} to={`/gov/registry/${p.id}`} className="flex items-start gap-3 rounded-card border border-danger/30 bg-danger/5 p-4 hover:border-danger/60">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{L(p.name)}</p>
                    <p className="text-sm text-muted">{L(db.provinces.find((x) => x.id === p.provinceId)!.name)} · {t('cdm.flagBody', { x: f.ratio })}</p>
                    <div className="mt-2 flex gap-4 text-sm"><span><span className="text-muted">{t('cdm.units')}:</span> <b className="num">{fmtNum(f.units)}</b></span><span><span className="text-muted">{t('cdm.provinceAvg')}:</span> <b className="num">{fmtNum(f.avg)}</b></span></div>
                  </div>
                  <Badge tone="danger">{f.ratio}×</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('cdm.byProvince')}>
          <div style={{ height: Math.max(220, byProvince.length * 26) }}><ResponsiveContainer>
            <BarChart data={byProvince} layout="vertical" margin={{ right: 40 }} onClick={(e) => { const id = (e?.activePayload?.[0]?.payload as { id?: string } | undefined)?.id; if (id) setProv(id === prov ? '' : id); }}>
              <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={120} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: c['primary-soft'], opacity: 0.4 }} content={<ChartTooltip />} />
              <Bar dataKey="units" name={t('cdm.units')} fill={c.danger} radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fill: c.text, fontSize: 11 }} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card title={`${t('nav.registry')} · 3 ${t('c.month')}`} pad={false} action={<Select value={prov} onChange={(e) => setProv(e.target.value)} className="h-9 w-44 text-sm" aria-label={t('c.province')}><option value="">{t('c.all')}</option>{byProvince.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}>
          <DataTable rows={top} rowKey={(r) => r.p.id} pageSize={10} dense columns={[
            { key: 'n', header: t('c.name'), mobile: 'title', render: (r) => <Link className="font-medium hover:underline" to={`/gov/registry/${r.p.id}`}>{L(r.p.name)}</Link> },
            { key: 'u', header: t('cdm.units'), align: 'right', render: (r) => fmtNum(r.units) },
            { key: 'f', header: '', render: (r) => (flags.some((f) => f.pharmacyId === r.p.id) ? <Badge tone="danger">{t('cdm.flags')}</Badge> : null) },
          ]} />
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Regulatory reports */

export function GovReports() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { user, db } = useStore();
  const reg = useRegistry();
  const ids = new Set(scopePharmacies(user, reg).map((p) => p.id));
  const months = [...new Set(db.reports.map((r) => r.month))].sort().reverse();
  const [month, setMonth] = useState(months[0]);
  const [type, setType] = useState<ReportType>('CONTROLLED');
  const [q, setQ] = useState('');
  const rows = db.reports.filter((r) => ids.has(r.pharmacyId) && r.month === month && r.type === type && L(db.pharmacies.find((p) => p.id === r.pharmacyId)!.name).toLowerCase().includes(q.toLowerCase()));
  const pct = (s: string) => (rows.length ? Math.round((rows.filter((r) => r.status === s).length / rows.length) * 100) : 0);
  return (
    <div>
      <PageHeader title={t('gr.title')} actions={<Button variant="secondary" icon={FileSpreadsheet} onClick={() => toast(`reports-${month}-${type}.xlsx ✓`)}>{t('c.exportXlsx')}</Button>} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi icon={Check} tone="success" label={t('st.SUBMITTED')} value={`${pct('SUBMITTED')}%`} />
        <Kpi icon={AlertTriangle} tone="warning" label={t('st.LATE')} value={`${pct('LATE')}%`} />
        <Kpi icon={ShieldAlert} tone="danger" label={t('st.MISSING')} value={`${pct('MISSING')}%`} />
      </div>
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} className="sm:w-64" />
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-36" aria-label={t('c.month')}>{months.map((m) => <option key={m}>{m}</option>)}</Select>
          <Select value={type} onChange={(e) => setType(e.target.value as ReportType)} className="sm:w-60" aria-label={t('c.type')}>{(['CONTROLLED', 'PRESCRIPTIONS', 'DESTRUCTION', 'ADR'] as const).map((x) => <option key={x} value={x}>{t(`rt.${x}`)}</option>)}</Select>
        </Toolbar>
        <DataTable rows={rows} rowKey={(r) => r.id} initialSort={{ key: 's', dir: 'desc' }} columns={[
          { key: 'n', header: t('nav.registry'), mobile: 'title', render: (r) => <Link className="font-medium hover:underline" to={`/gov/registry/${r.pharmacyId}`}>{L(db.pharmacies.find((p) => p.id === r.pharmacyId)!.name)}</Link> },
          { key: 'p', header: t('c.province'), render: (r) => L(db.provinces.find((p) => p.id === db.pharmacies.find((x) => x.id === r.pharmacyId)!.provinceId)!.name) },
          { key: 's', header: t('c.status'), sort: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
          { key: 'at', header: t('ren.submitted'), render: (r) => <span className="num">{fmtDate(r.submittedAt)}</span> },
        ]} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Users & inspectors */

export function UsersPage() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { db, write } = useStore();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const rows = db.users.filter((u) => `${u.username} ${u.name.lo} ${u.name.en}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title={t('usr.title')} actions={<Button icon={UserPlus} onClick={() => setOpen(true)}>{t('usr.new')}</Button>} />
      <Card pad={false}>
        <Toolbar><SearchInput value={q} onChange={setQ} className="sm:w-72" /></Toolbar>
        <DataTable rows={rows} rowKey={(r) => r.id} columns={[
          { key: 'n', header: t('c.name'), mobile: 'title', sort: (r) => r.username, render: (r) => <span className="font-medium">{L(r.name)}<span className="block text-xs text-muted">@{r.username}</span></span> },
          { key: 'r', header: t('staff.role'), sort: (r) => r.role, render: (r) => <Badge tone={['PHARMACY_OWNER', 'PHARMACIST', 'STAFF'].includes(r.role) ? 'primary' : 'accent'} icon={null}>{t(`role.${r.role}`)}</Badge> },
          { key: 's', header: t('usr.scope'), render: (r) => r.pharmacyId ? L(db.pharmacies.find((p) => p.id === r.pharmacyId)!.name) : r.provinceId ? L(db.provinces.find((p) => p.id === r.provinceId)!.name) : t('usr.national') },
          { key: '2fa', header: t('staff.2fa'), render: (r) => (r.twoFactor ? <Badge tone="success">TOTP</Badge> : <Badge>—</Badge>) },
          { key: 'l', header: t('staff.lastLogin'), render: (r) => <span className="num">{fmtDateTime(r.lastLogin)}</span> },
          { key: 'a', header: t('c.status'), render: (r) => (r.active ? <StatusBadge status="ACTIVE" /> : <Badge>{t('st.inactive')}</Badge>) },
          { key: 'x', header: '', align: 'right', render: (r) => r.role !== 'SUPER_ADMIN' && <Button size="sm" variant="ghost" onClick={() => { write('users', { ...r, active: !r.active }, `${r.active ? 'Deactivate' : 'Activate'} ${r.username}`, 'UPDATE'); toast(t('c.saved')); }}>{r.active ? t('staff.deactivate') : t('staff.activate')}</Button> },
        ]} />
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('usr.new')} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('c.cancel')}</Button><Button onClick={() => { toast(t('staff.invited')); setOpen(false); }}>{t('c.save')}</Button></>}>
        <div className="space-y-3">
          <Field label={t('c.name')} required><Input /></Field>
          <Field label={t('c.phone')} required><Input /></Field>
          <Field label={t('staff.role')}><Select>{(['MINISTRY_ADMIN', 'PROVINCIAL_OFFICER', 'INSPECTOR'] as const).map((r) => <option key={r}>{t(`role.${r}`)}</option>)}</Select></Field>
          <Field label={t('usr.scope')}><Select><option>{t('usr.national')}</option>{db.provinces.map((p) => <option key={p.id}>{L(p.name)}</option>)}</Select></Field>
          <Alert tone="accent" icon={ShieldCheck}>2FA (TOTP)</Alert>
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Audit log */

export function AuditPage() {
  const { t } = useTranslation();
  const L = useL();
  const { state, db } = useStore();
  const [q, setQ] = useState('');
  const [act, setAct] = useState('');
  const [open, setOpen] = useState<(typeof state.audit)[number] | null>(null);
  const actor = (id: string) => { const u = db.users.find((x) => x.id === id); return u ? L(u.name) : id; };
  const rows = state.audit.filter((a) => (!act || a.action === act) && `${a.entity} ${a.entityId} ${actor(a.actor)} ${a.device}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title={t('nav.audit')} subtitle={t('aud.immutable')} />
      <Card pad={false}>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} className="sm:w-72" />
          <Select value={act} onChange={(e) => setAct(e.target.value)} className="sm:w-44" aria-label={t('aud.action')}><option value="">{t('aud.action')}: {t('c.all')}</option>{['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE', 'REJECT'].map((a) => <option key={a}>{a}</option>)}</Select>
        </Toolbar>
        <DataTable rows={rows} rowKey={(r) => r.id} pageSize={15} dense onRowClick={setOpen} columns={[
          { key: 'at', header: t('c.date'), render: (r) => <span className="num">{fmtDateTime(r.at)}</span> },
          { key: 'actor', header: t('aud.actor'), mobile: 'title', render: (r) => <span className="font-medium">{actor(r.actor)}</span> },
          { key: 'act', header: t('aud.action'), render: (r) => <Badge tone={r.action === 'DELETE' || r.action === 'REJECT' ? 'danger' : r.action === 'APPROVE' ? 'success' : r.action === 'CREATE' ? 'primary' : 'neutral'} icon={null}>{r.action}</Badge> },
          { key: 'e', header: t('aud.entity'), render: (r) => <span><span>{r.entity}</span><span className="num block max-w-[180px] truncate text-xs text-muted">{r.entityId}</span></span> },
          { key: 'd', header: t('aud.device'), render: (r) => <span className="num text-xs">{r.device} · {r.ip}</span> },
        ]} />
      </Card>
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${open.action} · ${open.entity}` : ''} wide>
        {open && (
          <div className="grid gap-3 md:grid-cols-2">
            {(['before', 'after'] as const).map((k) => (
              <div key={k}><p className="mb-1 text-xs font-semibold uppercase text-muted">{t(`aud.${k}`)}</p>
                <pre className="max-h-80 overflow-auto rounded-ctl bg-surface-2 p-3 text-xs">{open[k] ? JSON.stringify(open[k], null, 2) : '—'}</pre></div>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ System settings */

export function SystemSettings() {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { db } = useStore();
  const [th, setTh] = useState({ lic: '90, 60, 30', exp: '90, 60, 30', low: '40', anomaly: '2', warn: '7', block: '14' });
  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.system')} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t('sys.thresholds')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['lic', 'sys.licenseAlerts'], ['exp', 'sys.nearExpiry'], ['low', 'sys.lowStock'], ['anomaly', 'sys.anomaly'], ['warn', 'sys.syncWarn'], ['block', 'sys.syncBlock']] as const).map(([k, l]) => (
              <Field key={k} label={t(l)}><Input className="num" value={th[k]} onChange={(e) => setTh({ ...th, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <div className="mt-4 flex justify-end"><Button onClick={() => toast(t('c.saved'))}>{t('c.save')}</Button></div>
        </Card>
        <Card title={t('sys.templates')} pad={false}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><p className="font-medium">{L(GPP_TEMPLATE.name)}</p><Badge tone="accent" icon={null}>{t('sys.version')} {GPP_TEMPLATE.version}</Badge></div>
          <ul className="divide-y divide-border">
            {GPP_TEMPLATE.sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{s.id} · {L(s.title)}</span><span className="flex gap-2"><Badge icon={null}>{t('sys.items', { n: s.items.length })}</Badge>{s.items.some((i) => i.critical) && <Badge tone="danger" icon={ShieldAlert}>{s.items.filter((i) => i.critical).length}</Badge>}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title={t('sys.masterData')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[[t('c.province'), db.provinces.length], [t('c.district'), db.districts.length], [t('nav.catalog'), db.drugs.length], [t('nav.registry'), db.pharmacies.length]].map(([k, v]) => (
            <div key={String(k)} className="rounded-ctl bg-surface-2 p-3"><p className="text-xs text-muted">{k}</p><p className="num text-2xl font-semibold">{v}</p></div>
          ))}
        </div>
      </Card>
    </div>
  );
}
