import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudOff, Database, RefreshCw, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { staleIso, useStore } from '@/store/store';
import { syncRestriction } from '@/lib/rules';
import { fmtDateTime } from '@/lib/format';
import { DEMO_DEVICE } from '@/data/seed';
import { Alert, Badge, Button, Card, ConfirmDialog, DataTable, DescList, EmptyState, Kpi, PageHeader, StatusBadge } from '@/components/ui';
import { SyncIndicator } from '@/components/layout/AppShell';

export default function SyncCenter() {
  const { t } = useTranslation();
  const { state, online, syncNow, set, daysSinceSync, reset } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const catalogHours = Math.round((Date.now() - new Date(state.catalogUpdatedAt).getTime()) / 3_600_000);
  const r = syncRestriction(daysSinceSync);

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.sync')} subtitle={<SyncIndicator />}
        actions={<><Button icon={RefreshCw} disabled={!online || state.syncing} onClick={syncNow}>{t('sync.syncNow')}</Button><Button variant="secondary" icon={Database} disabled={!online} onClick={() => { syncNow(); }}>{t('sync.forceResync')}</Button></>} />

      {state.syncError && <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={syncNow}>{t('sync.retry')}</Button>}>{state.syncError}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={RefreshCw} label={t('sync.lastSync')} value={<span className="text-lg">{fmtDateTime(state.lastSyncAt)}</span>} tone={r === 'OK' ? 'success' : r === 'WARN' ? 'warning' : 'danger'} sub={t('c.days', { n: daysSinceSync })} />
        <Kpi icon={CloudOff} label={t('sync.pendingItems')} value={state.outbox.length} tone={state.outbox.length ? 'warning' : 'success'} />
        <Kpi icon={Database} label={t('nav.catalog')} value={<span className="text-lg">{t('sync.catalogAge', { h: catalogHours })}</span>} tone="neutral" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t('sync.pendingItems')} pad={false} className="lg:col-span-2">
          <DataTable rows={[...state.outbox].reverse()} rowKey={(o) => o.id} dense
            empty={<EmptyState icon={RefreshCw} title={t('sync.noPending')} hint={t('sync.noPendingHint')} />}
            columns={[
              { key: 'label', header: t('c.details'), mobile: 'title', render: (o) => <span className="font-medium">{o.label}</span> },
              { key: 'entity', header: t('sync.entity'), render: (o) => <Badge icon={null}>{o.entity}</Badge> },
              { key: 'at', header: t('c.date'), render: (o) => <span className="num">{fmtDateTime(o.at)}</span> },
              { key: 'key', header: t('sync.key'), mobile: 'hide', render: (o) => <code className="num text-xs text-muted">{o.idempotencyKey.slice(0, 13)}…:{o.idempotencyKey.split(':')[1]}</code> },
              { key: 'st', header: t('c.status'), render: (o) => <StatusBadge status={o.status === 'ERROR' ? 'FAIL' : o.status === 'SYNCING' ? 'IN_PROGRESS' : 'PENDING'} label={o.status === 'ERROR' ? t('sync.error') : o.status === 'SYNCING' ? t('sync.syncing') : t('st.PENDING')} /> },
            ]} />
        </Card>

        <div className="space-y-5">
          <Card title={t('sync.simulate')}>
            <div className="space-y-3">
              <Button className="w-full" variant={state.simulatedOffline ? 'primary' : 'secondary'} icon={state.simulatedOffline ? Wifi : WifiOff}
                onClick={() => set({ simulatedOffline: !state.simulatedOffline })}>{state.simulatedOffline ? t('sync.goOnline') : t('sync.goOffline')}</Button>
              <p className="text-sm text-muted">{t('sync.simulateStale')}</p>
              <div className="grid grid-cols-3 gap-2">
                {[0, 8, 15].map((d) => <Button key={d} size="sm" variant="secondary" onClick={() => set({ lastSyncAt: d ? staleIso(d) : new Date().toISOString(), simulatedOffline: d > 0 })}>{t('c.days', { n: d })}</Button>)}
              </div>
              <Button className="w-full" variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>{t('sync.resetDemo')}</Button>
            </div>
          </Card>
          <Card title={t('sync.protocol')}>
            <p className="text-sm text-muted">{t('sync.protocolBody')}</p>
            <div className="mt-3"><DescList items={[[t('sync.device'), <code className="num">{DEMO_DEVICE} · {state.deviceName}</code>], ['Local DB', 'IndexedDB (Dexie) · demo: localStorage']]} /></div>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} onConfirm={reset} title={t('sync.resetDemo')} danger />
    </div>
  );
}
