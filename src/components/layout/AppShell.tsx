import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell, BookOpen, Building2, CalendarCheck, ClipboardCheck, ClipboardList, FileBarChart, FileCheck2, FilePlus2, Flame, LayoutDashboard,
  LayoutGrid, LogOut, Map as MapIcon, Menu, Monitor, Moon, PackagePlus, Pill, RefreshCw, ScrollText, Search, Settings, ShieldAlert,
  ShieldCheck, ShoppingCart, Stethoscope, Sun, Truck, UserCog, Users, Warehouse, X, type LucideIcon, AlertOctagon, CloudOff, Cloud, Loader2,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useStore } from '@/store/store';
import { can, type Perm } from '@/store/rbac';
import { useL } from '@/i18n';
import { cx, IconButton, Segmented } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { syncRestriction } from '@/lib/rules';

interface NavItem { to: string; label: string; icon: LucideIcon; perm?: Perm; roles?: string[] }
interface NavGroup { label: string; items: NavItem[] }

function pharmacyNav(): NavGroup[] {
  return [
    { label: 'nav.group.sell', items: [
      { to: '/app', label: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/app/pos', label: 'nav.pos', icon: ShoppingCart, perm: 'pos.sell' },
      { to: '/app/prescriptions', label: 'nav.prescriptions', icon: Stethoscope },
      { to: '/app/customers', label: 'nav.customers', icon: Users },
    ] },
    { label: 'nav.group.inventory', items: [
      { to: '/app/stock', label: 'nav.stock', icon: Warehouse, perm: 'stock.view' },
      { to: '/app/receive', label: 'nav.receive', icon: PackagePlus, perm: 'stock.receive' },
      { to: '/app/suppliers', label: 'nav.suppliers', icon: Truck, perm: 'stock.receive' },
    ] },
    { label: 'nav.group.compliance', items: [
      { to: '/app/controlled', label: 'nav.controlled', icon: ShieldAlert, perm: 'pos.sellRx' },
      { to: '/app/destruction', label: 'nav.destruction', icon: Flame, perm: 'stock.receive' },
      { to: '/app/adr', label: 'nav.adr', icon: AlertOctagon, perm: 'pos.sellRx' },
      { to: '/app/license', label: 'nav.license', icon: FileCheck2 },
    ] },
    { label: 'nav.group.business', items: [
      { to: '/app/reports', label: 'nav.reports', icon: FileBarChart, perm: 'reports.pharmacy' },
      { to: '/app/staff', label: 'nav.staff', icon: UserCog, perm: 'staff.manage' },
    ] },
    { label: 'nav.group.system', items: [
      { to: '/app/sync', label: 'nav.sync', icon: RefreshCw },
      { to: '/app/settings', label: 'nav.settings', icon: Settings },
      { to: '/gallery', label: 'nav.gallery', icon: LayoutGrid },
    ] },
  ];
}

function regulatorNav(): NavGroup[] {
  return [
    { label: 'nav.group.overview', items: [
      { to: '/gov', label: 'nav.national', icon: MapIcon },
    ] },
    { label: 'nav.group.licensing', items: [
      { to: '/gov/registry', label: 'nav.registry', icon: Building2, perm: 'registry.view' },
      { to: '/gov/register', label: 'nav.register', icon: FilePlus2, perm: 'registry.edit' },
      { to: '/gov/renewals', label: 'nav.renewals', icon: FileCheck2, perm: 'license.approve' },
      { to: '/gov/catalog', label: 'nav.catalog', icon: Pill },
    ] },
    { label: 'nav.group.oversight', items: [
      { to: '/gov/inspections', label: 'nav.inspections', icon: ClipboardCheck },
      { to: '/gov/corrective', label: 'nav.corrective', icon: ClipboardList },
      { to: '/gov/controlled', label: 'nav.cdMonitor', icon: ShieldAlert, perm: 'registry.view' },
      { to: '/gov/reports', label: 'nav.govReports', icon: FileBarChart, perm: 'registry.view' },
    ] },
    { label: 'nav.group.admin', items: [
      { to: '/gov/users', label: 'nav.users', icon: Users, perm: 'users.manage' },
      { to: '/gov/audit', label: 'nav.audit', icon: ScrollText, perm: 'audit.view' },
      { to: '/gov/system', label: 'nav.system', icon: Settings, perm: 'settings.system' },
      { to: '/gov/sync', label: 'nav.sync', icon: RefreshCw },
      { to: '/gallery', label: 'nav.gallery', icon: LayoutGrid },
    ] },
  ];
}

/* ------------------------------------------------------------------ sync indicator */

export function SyncIndicator({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { online, state } = useStore();
  const nav = useNavigate();
  const { isRegulator } = useStore();
  const n = state.outbox.length;
  const errored = state.outbox.some((o) => o.status === 'ERROR');
  const [cls, Icon, label] = state.syncing
    ? ['text-accent bg-accent/10 border-accent/25', Loader2, t('sync.syncing')]
    : errored ? ['text-danger bg-danger/10 border-danger/25', AlertOctagon, t('sync.error')]
    : !online ? ['text-warning bg-warning/10 border-warning/30', CloudOff, t('sync.offline', { n })]
    : n ? ['text-accent bg-accent/10 border-accent/25', Cloud, t('sync.pending', { n })]
    : ['text-success bg-success/10 border-success/25', Cloud, t('sync.online')];
  return (
    <button onClick={() => nav(isRegulator ? '/gov/sync' : '/app/sync')} title={`${t('sync.lastSync')}: ${fmtDateTime(state.lastSyncAt)}`}
      className={cx('inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium', cls)} aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        <span className={cx('absolute inset-0 rounded-full bg-current', state.syncing && 'animate-ping opacity-60')} />
        <span className="relative h-2.5 w-2.5 rounded-full bg-current" />
      </span>
      <Icon className={cx('h-4 w-4', state.syncing && 'animate-spin')} aria-hidden />
      <span className={cx(compact && 'sr-only sm:not-sr-only')}>{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ popover helper */

function Popover({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', h));
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={cx('absolute right-0 top-12 z-40 w-[min(92vw,360px)] rounded-card border border-border bg-surface shadow-xl', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ shell */

export function AppShell() {
  const { t, i18n } = useTranslation();
  const L = useL();
  const { user, isRegulator, state, set, logout, readAll, daysSinceSync, db } = useStore();
  const nav = useNavigate();
  const loc = useLocation();
  const groups = isRegulator ? regulatorNav() : pharmacyNav();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => { void i18n.changeLanguage(state.lang); }, [state.lang, i18n]);

  if (!user) return null;
  const visible = (it: NavItem) => !it.perm || can(user, it.perm);
  const notifs = state.notifications.filter((n) => n.recipient === 'all' || n.recipient === (isRegulator ? 'regulator' : 'pharmacy'));
  const unread = notifs.filter((n) => !n.read).length;
  const restriction = syncRestriction(daysSinceSync);
  const pharmacy = db.pharmacies.find((p) => p.id === user.pharmacyId);
  const scopeLabel = isRegulator
    ? user.provinceId ? L(db.provinces.find((p) => p.id === user.provinceId)!.name) : t('usr.national')
    : pharmacy ? L(pharmacy.name) : '';

  const tabs: NavItem[] = isRegulator
    ? [
        { to: '/gov', label: 'nav.national', icon: MapIcon },
        { to: '/gov/registry', label: 'nav.registry', icon: Building2 },
        { to: '/gov/inspections', label: 'nav.inspections', icon: CalendarCheck },
        { to: '/gov/renewals', label: 'nav.renewals', icon: FileCheck2, perm: 'license.approve' },
      ]
    : [
        { to: '/app', label: 'nav.dashboard', icon: LayoutDashboard },
        { to: '/app/pos', label: 'nav.pos', icon: ShoppingCart, perm: 'pos.sell' },
        { to: '/app/stock', label: 'nav.stock', icon: Warehouse },
        { to: '/app/reports', label: 'nav.reports', icon: FileBarChart, perm: 'reports.pharmacy' },
      ];

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className={cx('flex h-16 shrink-0 items-center gap-3 border-b border-border px-4', collapsed && 'md:justify-center md:px-0')}>
        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-ctl text-white', isRegulator ? 'bg-accent dark:text-slate-900' : 'bg-primary dark:text-slate-900')}>
          {isRegulator ? <ShieldCheck className="h-5 w-5" /> : <Pill className="h-5 w-5" />}
        </span>
        <div className={cx('min-w-0', collapsed && 'md:hidden')}>
          <p className="font-semibold leading-tight">{t('app.name')}</p>
          <p className="truncate text-xs text-muted">{isRegulator ? t('app.regulatorSide') : t('app.pharmacySide')}</p>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => {
          const items = g.items.filter(visible);
          if (!items.length) return null;
          return (
            <div key={g.label}>
              <p className={cx('mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted', collapsed && 'md:hidden')}>{t(g.label)}</p>
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <li key={it.to}>
                    <NavLink to={it.to} end={it.to === '/app' || it.to === '/gov'} title={t(it.label)}
                      className={({ isActive }) => cx('flex min-h-[44px] items-center gap-3 rounded-ctl px-3 text-sm font-medium',
                        collapsed && 'md:justify-center md:px-0',
                        isActive ? (isRegulator ? 'bg-accent/10 text-accent' : 'bg-primary-soft text-primary') : 'text-muted hover:bg-surface-2 hover:text-text')}>
                      <it.icon className="h-5 w-5 shrink-0" aria-hidden />
                      <span className={cx('truncate', collapsed && 'md:hidden')}>{t(it.label)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className={cx('border-t border-border p-3 text-xs text-muted', collapsed && 'md:hidden')}>
        <p>{t('app.ministry')}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-warning"><BookOpen className="h-3 w-3" />{t('app.demo')}</p>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className={cx('sticky top-0 hidden h-screen shrink-0 border-r border-border bg-surface md:block', collapsed ? 'w-[72px]' : 'w-64')}>{sidebar}</aside>
      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl">
            <IconButton icon={X} label={t('c.close')} className="absolute right-2 top-3" onClick={() => setDrawer(false)} />
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-4">
          <IconButton icon={Menu} label={t('nav.more')} className="md:hidden" onClick={() => setDrawer(true)} />
          <IconButton icon={collapsed ? PanelLeftOpen : PanelLeftClose} label="Toggle sidebar" className="hidden md:inline-flex" onClick={() => setCollapsed((c) => !c)} />
          <form className="relative hidden max-w-md flex-1 lg:block" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(isRegulator ? `/gov/registry?q=${encodeURIComponent(q)}` : `/app/stock?q=${encodeURIComponent(q)}`); }}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('top.globalSearch')} aria-label={t('top.globalSearch')}
              className="h-10 w-full rounded-full border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25" />
          </form>
          <div className="min-w-0 flex-1 truncate text-sm font-medium lg:hidden">{scopeLabel}</div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SyncIndicator compact />
            <Segmented className="hidden sm:inline-flex" value={state.lang} onChange={(v) => set({ lang: v })} options={[{ value: 'lo', label: 'ລາວ' }, { value: 'en', label: 'EN' }]} />
            <button className="h-9 rounded-ctl px-2 text-sm font-semibold sm:hidden" onClick={() => set({ lang: state.lang === 'lo' ? 'en' : 'lo' })} aria-label={t('top.lang')}>{state.lang === 'lo' ? 'EN' : 'ລາວ'}</button>
            <IconButton icon={state.theme === 'dark' ? Moon : state.theme === 'light' ? Sun : Monitor} label={t('top.theme')} className="hidden sm:inline-flex"
              onClick={() => set({ theme: state.theme === 'light' ? 'dark' : state.theme === 'dark' ? 'system' : 'light' })} />
            <div className="relative">
              <IconButton icon={Bell} label={t('top.notifications')} badge={unread} onClick={() => setBellOpen((o) => !o)} />
              <Popover open={bellOpen} onClose={() => setBellOpen(false)}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="font-semibold">{t('top.notifications')}</p>
                  <button className="text-sm text-accent hover:underline" onClick={readAll}>{t('top.markAllRead')}</button>
                </div>
                <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                  {notifs.length === 0 && <li className="p-6 text-center text-sm text-muted">{t('top.noNotifications')}</li>}
                  {notifs.map((n) => (
                    <li key={n.id}>
                      <button className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2" onClick={() => { setBellOpen(false); nav(n.link); }}>
                        <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{L(n.title)}</span>
                          <span className="block text-sm text-muted">{L(n.body)}</span>
                          <span className="num block text-xs text-muted">{fmtDateTime(n.at)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Popover>
            </div>
            <div className="relative">
              <button onClick={() => setUserOpen((o) => !o)} className="flex h-11 items-center gap-2 rounded-ctl px-1.5 hover:bg-surface-2" aria-label={L(user.name)}>
                <span className={cx('grid h-8 w-8 place-items-center rounded-full text-sm font-semibold', isRegulator ? 'bg-accent/15 text-accent' : 'bg-primary-soft text-primary')}>{user.name.en.charAt(0)}</span>
                <span className="hidden text-left xl:block"><span className="block text-sm font-medium leading-tight">{L(user.name)}</span><span className="block text-xs text-muted">{t(`role.${user.role}`)}</span></span>
              </button>
              <Popover open={userOpen} onClose={() => setUserOpen(false)} className="w-72">
                <div className="border-b border-border p-4">
                  <p className="font-medium">{L(user.name)}</p>
                  <p className="text-sm text-muted">{t(`role.${user.role}`)} · {scopeLabel}</p>
                </div>
                <div className="space-y-3 p-4 sm:hidden">
                  <Segmented value={state.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'light', label: t('top.light') }, { value: 'dark', label: t('top.dark') }, { value: 'system', label: t('top.system') }]} />
                </div>
                <button className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-sm hover:bg-surface-2" onClick={() => { logout(); nav('/login'); }}>
                  <LogOut className="h-4 w-4" />{t('top.logout')}
                </button>
              </Popover>
            </div>
          </div>
        </header>

        {restriction !== 'OK' && (
          <div className={cx('flex items-center gap-2 px-4 py-2 text-sm font-medium', restriction === 'WARN' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger')} role="alert">
            <AlertOctagon className="h-4 w-4 shrink-0" />
            <span className="text-text">{restriction === 'WARN' ? t('sync.warn7', { n: daysSinceSync }) : t('sync.block14')}</span>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* mobile bottom tab bar (max 5) */}
      <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.filter(visible).slice(0, 4).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/app' || it.to === '/gov'}
            className={({ isActive }) => cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium', isActive ? (isRegulator ? 'text-accent' : 'text-primary') : 'text-muted')}>
            <it.icon className="h-5 w-5" aria-hidden />
            <span className="max-w-full truncate px-1">{t(it.label)}</span>
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted">
          <Menu className="h-5 w-5" /><span>{t('nav.more')}</span>
        </button>
      </nav>
    </div>
  );
}
