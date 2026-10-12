import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileDown, FileSpreadsheet, Send, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '@/store/store';
import { usePharmacy } from '@/store/selectors';
import { addDays, fmtDate, fmtKip, fmtNum, isSameDay, monthKey, fmtAxisKip } from '@/lib/format';
import { useColors } from '@/lib/useColors';
import { ChartTooltip } from '@/components/ChartTooltip';
import type { RegulatoryReport, ReportType } from '@/data/types';
import { Badge, Button, Card, DataTable, PageHeader, Segmented, StatusBadge, Tabs, useToast } from '@/components/ui';

export default function PharmacyReports() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'business' | 'regulatory'>('business');
  return (
    <div>
      <PageHeader title={t('nav.reports')} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'business', label: t('rep.business') }, { value: 'regulatory', label: t('rep.regulatory') }]} />
      {tab === 'business' ? <Business /> : <Regulatory />}
    </div>
  );
}

function ExportButtons({ name }: { name: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const go = (ext: string) => { toast(t('rep.exporting'), 'primary'); setTimeout(() => toast(`${name}.${ext} ✓`), 700); };
  return <div className="flex gap-2"><Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={() => go('xlsx')}>Excel</Button><Button size="sm" variant="secondary" icon={FileDown} onClick={() => go('pdf')}>PDF</Button></div>;
}

function Business() {
  const { t } = useTranslation();
  const c = useColors();
  const ph = usePharmacy();
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  const series = useMemo(() => {
    if (period === 'daily') return Array.from({ length: 30 }, (_, i) => { const d = addDays(ph.now, i - 29); const s = ph.sales.filter((x) => isSameDay(x.at, d)); return { label: fmtDate(d.toISOString()).slice(0, 5), revenue: s.reduce((a, x) => a + x.total, 0) }; });
    const m = new Map<string, number>();
    for (const s of ph.sales) { const k = period === 'monthly' ? monthKey(s.at) : monthKey(s.at).slice(0, 4); m.set(k, (m.get(k) ?? 0) + s.total); }
    return [...m.entries()].sort().map(([label, revenue]) => ({ label, revenue }));
  }, [period, ph.sales, ph.now]);

  const pnl = useMemo(() => {
    const since = addDays(ph.now, -30).toISOString();
    const s = ph.sales.filter((x) => x.at >= since);
    const revenue = s.reduce((a, x) => a + x.total, 0);
    const cogs = s.reduce((a, x) => a + x.lines.reduce((y, l) => y + l.cost * l.qty, 0), 0);
    return { revenue, cogs, gross: revenue - cogs };
  }, [ph.sales, ph.now]);

  const movers = useMemo(() => {
    const units = new Map<string, number>();
    for (const s of ph.sales) for (const l of s.lines) units.set(l.drugId, (units.get(l.drugId) ?? 0) + l.qty);
    const list = ph.stock.filter((s) => s.qty > 0).map((s) => ({ drug: s.drug, units: units.get(s.drug.id) ?? 0, qty: s.qty }));
    return { best: [...list].sort((a, b) => b.units - a.units).slice(0, 8), slow: [...list].sort((a, b) => a.units - b.units).slice(0, 8) };
  }, [ph.sales, ph.stock]);

  return (
    <div className="space-y-5">
      <Card title={t('rep.sales')} action={<div className="flex flex-wrap items-center gap-2"><Segmented value={period} onChange={setPeriod} options={[{ value: 'daily', label: t('rep.daily') }, { value: 'monthly', label: t('rep.monthly') }, { value: 'yearly', label: t('rep.yearly') }]} /><ExportButtons name={`sales-${period}`} /></div>}>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 8, left: 4, right: 4 }}>
              <CartesianGrid vertical={false} stroke={c.border} />
              <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.border }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmtAxisKip} />
              <Tooltip cursor={{ fill: c['primary-soft'], opacity: 0.4 }} content={<ChartTooltip fmt={fmtKip} />} />
              <Bar dataKey="revenue" name={t('rep.revenue')} fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={`${t('rep.pnl')} · 30 ${t('c.days', { n: '' }).trim()}`} action={<ExportButtons name="pnl" />}>
          <dl className="space-y-3">
            <div className="flex justify-between"><dt className="text-muted">{t('rep.revenue')}</dt><dd className="num font-semibold">{fmtKip(pnl.revenue)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t('rep.cogs')}</dt><dd className="num">− {fmtKip(pnl.cogs)}</dd></div>
            <div className="flex justify-between border-t border-border pt-3"><dt className="font-medium">{t('rep.gross')}</dt><dd className="num text-xl font-semibold text-success">{fmtKip(pnl.gross)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t('rep.marginPct')}</dt><dd className="num">{pnl.revenue ? Math.round((pnl.gross / pnl.revenue) * 100) : 0}%</dd></div>
          </dl>
        </Card>
        {([['best', TrendingUp, movers.best], ['slow', TrendingDown, movers.slow]] as const).map(([k, Icon, list]) => (
          <Card key={k} title={<span className="flex items-center gap-2"><Icon className="h-4 w-4" />{t(`rep.${k}`)}</span>} pad={false}>
            <ol className="divide-y divide-border">
              {list.map((m, i) => (
                <li key={m.drug.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="num w-5 text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{m.drug.brand} <span className="text-muted">{m.drug.strength}</span></span>
                  <span className="num font-medium">{fmtNum(m.units)}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>

      <Card title={t('rep.stockOnHand')} action={<ExportButtons name="stock-on-hand" />} pad={false}>
        <DataTable rows={ph.stock.filter((s) => s.qty > 0)} rowKey={(r) => r.drug.id} pageSize={8} dense initialSort={{ key: 'value', dir: 'desc' }} columns={[
          { key: 'drug', header: t('stock.drug'), mobile: 'title', sort: (r) => r.drug.brand, render: (r) => r.drug.brand },
          { key: 'cat', header: t('cat.category'), render: (r) => t(`cat.${r.drug.category}`) },
          { key: 'qty', header: t('stock.onHand'), align: 'right', sort: (r) => r.qty, render: (r) => fmtNum(r.qty) },
          { key: 'value', header: t('stock.value'), align: 'right', sort: (r) => r.value, render: (r) => fmtKip(r.value) },
        ]} />
      </Card>
    </div>
  );
}

function Regulatory() {
  const { t } = useTranslation();
  const toast = useToast();
  const { db, user, write } = useStore();
  const ph = usePharmacy();
  const types: ReportType[] = ['CONTROLLED', 'PRESCRIPTIONS', 'DESTRUCTION', 'ADR'];
  const months = Array.from({ length: 7 }, (_, i) => monthKey(new Date(ph.now.getFullYear(), ph.now.getMonth() - i, 15)));
  const find = (m: string, ty: ReportType) => db.reports.find((r) => r.pharmacyId === ph.pharmacyId && r.month === m && r.type === ty);
  const count = (m: string, ty: ReportType) => {
    const inMonth = (iso: string) => monthKey(iso) === m;
    if (ty === 'PRESCRIPTIONS') return db.prescriptions.filter((p) => p.pharmacyId === ph.pharmacyId && inMonth(p.date)).length;
    if (ty === 'CONTROLLED') return ph.movements.filter((mv) => mv.type === 'SALE' && inMonth(mv.at) && ph.drugMap.get(mv.drugId)?.category === 'CONTROLLED').length;
    if (ty === 'DESTRUCTION') return db.destructions.filter((d) => d.pharmacyId === ph.pharmacyId && inMonth(d.date)).length;
    return db.adrs.filter((a) => a.pharmacyId === ph.pharmacyId && inMonth(a.date)).length;
  };
  const submit = (m: string, ty: ReportType) => {
    const now = new Date().toISOString();
    const rec: RegulatoryReport = { id: `rr-${ph.pharmacyId}-${m}-${ty}`, createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, pharmacyId: ph.pharmacyId, month: m, type: ty, status: 'SUBMITTED', submittedAt: now };
    write('reports', rec, `Report ${ty} ${m}`);
    toast(t('rep.submitted'));
  };
  return (
    <div className="space-y-4">
      {months.map((m, i) => (
        <Card key={m} title={<span className="num">{m}</span>} subtitle={i === 0 ? t('st.DRAFT') : undefined}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {types.map((ty) => {
              const r = find(m, ty);
              const status = r?.status ?? (i === 0 ? 'DRAFT' : 'MISSING');
              return (
                <div key={ty} className="flex flex-col gap-2 rounded-ctl border border-border p-3">
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{t(`rt.${ty}`)}</p><StatusBadge status={status} /></div>
                  <p className="num text-xs text-muted">{t('rep.records', { n: count(m, ty) })}{r?.submittedAt ? ` · ${fmtDate(r.submittedAt)}` : ''}</p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {status !== 'SUBMITTED' && <Button size="sm" icon={Send} onClick={() => submit(m, ty)}>{t('rep.submit')}</Button>}
                    <ExportButtons name={`${ty.toLowerCase()}-${m}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <p className="text-xs text-muted"><Badge icon={null}>PDF</Badge> Noto Sans Lao embedded</p>
    </div>
  );
}

