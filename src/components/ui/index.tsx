import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleDashed, Clock, Info, PackageOpen, X, XCircle, type LucideIcon } from 'lucide-react';

const twMerge = extendTailwindMerge({ extend: { theme: { borderRadius: ['card', 'ctl'] } } });
export const cx = (...c: ClassValue[]) => twMerge(clsx(c));

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' | 'xl'; icon?: LucideIcon }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-ctl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap',
        size === 'sm' && 'h-9 px-3 text-sm', size === 'md' && 'h-11 px-4', size === 'lg' && 'h-12 px-5 text-base', size === 'xl' && 'h-14 px-6 text-lg',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary/90 shadow-soft',
        variant === 'accent' && 'bg-accent text-white dark:text-slate-900 hover:bg-accent/90 shadow-soft',
        variant === 'secondary' && 'bg-surface border border-border text-text hover:bg-surface-2 shadow-soft',
        variant === 'ghost' && 'text-text hover:bg-surface-2',
        variant === 'danger' && 'bg-danger text-white dark:text-slate-900 hover:bg-danger/90 shadow-soft',
        className,
      )}
    >
      {Icon && <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, badge, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; badge?: number }) {
  return (
    <button {...p} aria-label={label} title={label} className={cx('relative inline-flex h-11 w-11 items-center justify-center rounded-ctl text-text hover:bg-surface-2', className)}>
      <Icon className="h-5 w-5" aria-hidden />
      {!!badge && <span className="num absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-[11px] font-semibold leading-[18px] text-white">{badge}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({ className, children, title, action, pad = true, subtitle }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-card border border-border bg-surface shadow-soft', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-semibold leading-snug">{title}</h2>}
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Badges — never color-only */

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary' | 'accent';
const toneCls: Record<Tone, string> = {
  success: 'bg-success/10 text-success border-success/25',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/25',
  neutral: 'bg-surface-2 text-muted border-border',
  primary: 'bg-primary-soft text-primary border-primary/20',
  accent: 'bg-accent/10 text-accent border-accent/25',
};
const toneIcon: Record<Tone, LucideIcon> = { success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: CircleDashed, primary: Check, accent: Info };

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: LucideIcon | null; children: ReactNode; className?: string }) {
  const Icon = icon === null ? null : icon ?? toneIcon[tone];
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', toneCls[tone], className)}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success', VALID: 'success', APPROVED: 'success', PASS: 'success', VERIFIED: 'success', SUBMITTED: 'success', COMPLETED: 'success',
  PENDING: 'warning', EXPIRING: 'warning', RENEWAL_PENDING: 'accent', PASS_WITH_CONDITIONS: 'warning', OPEN: 'warning', LATE: 'warning', PENDING_APPROVAL: 'warning', DRAFT: 'neutral', PLANNED: 'accent', IN_PROGRESS: 'accent',
  SUSPENDED: 'danger', CLOSED: 'neutral', EXPIRED: 'danger', REVOKED: 'danger', BANNED: 'danger', RECALLED: 'danger', FAIL: 'danger', OVERDUE: 'danger', MISSING: 'danger', REJECTED: 'danger',
};
export const statusTone = (s: string): Tone => STATUS_TONE[s] ?? 'neutral';

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useTranslation();
  const tone = statusTone(status);
  return <Badge tone={tone} icon={status === 'PLANNED' || status === 'PENDING' ? Clock : undefined}>{label ?? t(`st.${status}`)}</Badge>;
}

/** "✓ Valid / ⚠ Expires in 28 days / ✕ Expired 3 days ago" */
export function ExpiryBadge({ days, warnAt = 90 }: { days: number; warnAt?: number }) {
  const { t } = useTranslation();
  if (days < 0) return <Badge tone="danger">{t('st.expiredAgo', { n: -days })}</Badge>;
  if (days <= 30) return <Badge tone="danger" icon={AlertTriangle}>{t('st.expiresIn', { n: days })}</Badge>;
  if (days <= warnAt) return <Badge tone="warning">{t('st.expiresIn', { n: days })}</Badge>;
  return <Badge tone="success">{t('st.VALID')}</Badge>;
}

/* ------------------------------------------------------------------ Form controls */

const ctl = 'w-full rounded-ctl border border-border bg-surface px-3 text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60';

export function Field({ label, hint, error, required, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium">{label}{required && <span className="text-danger" aria-hidden> *</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(ctl, 'h-11', className)} />;
});
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(ctl, 'h-11 pr-8', className)}>{children}</select>;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(ctl, 'min-h-[88px] py-2', className)} />;
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-ctl border border-border bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('min-h-[36px] rounded-md px-3 text-sm font-medium', value === o.value ? 'bg-surface text-primary shadow-soft' : 'text-muted hover:text-text')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div role="tablist" className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      {tabs.map((tb) => (
        <button key={tb.value} role="tab" aria-selected={value === tb.value} onClick={() => onChange(tb.value)}
          className={cx('-mb-px flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium', value === tb.value ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')}>
          {tb.label}
          {tb.count !== undefined && <span className="num rounded-full bg-surface-2 px-1.5 text-xs">{tb.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ KPI / Empty / Skeleton */

export function Kpi({ label, value, icon: Icon, tone = 'primary', sub, onClick }: { label: ReactNode; value: ReactNode; icon: LucideIcon; tone?: Tone; sub?: ReactNode; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={cx('flex w-full items-start gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-soft', onClick && 'hover:border-primary/40')}>
      <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-ctl border', toneCls[tone])}><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-sm text-muted">{label}</span>
        <span className="num block text-2xl font-semibold leading-tight tracking-tight">{value}</span>
        {sub && <span className="mt-0.5 block text-xs text-muted">{sub}</span>}
      </span>
    </C>
  );
}

export function EmptyState({ icon: Icon = PackageOpen, title, hint, action }: { icon?: LucideIcon; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="relative mb-3">
        <div className="absolute inset-0 -m-3 rounded-full bg-primary-soft/60" />
        <Icon className="relative h-10 w-10 text-primary" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton h-4', className)} aria-hidden />;

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3"><Skeleton className="h-10 w-10" /><div className="flex-1 space-y-2"><Skeleton className="w-2/3" /><Skeleton className="w-1/3" /></div></div>
      ))}
    </div>
  );
}

/** Brief skeleton on mount so every list shows a designed loading state. */
export function useFakeLoading(ms = 350) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}

/* ------------------------------------------------------------------ DataTable */

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
  align?: 'right' | 'left' | 'center';
  mobile?: 'title' | 'hide' | 'show';
}

export function DataTable<T>({ rows, columns, rowKey, pageSize = 12, onRowClick, empty, initialSort, loading, dense }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; pageSize?: number; onRowClick?: (r: T) => void; empty?: ReactNode;
  initialSort?: { key: string; dir: 'asc' | 'desc' }; loading?: boolean; dense?: boolean;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length]);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => { const x = f(a), y = f(b); const r = x < y ? -1 : x > y ? 1 : 0; return sort.dir === 'asc' ? r : -r; });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const titleCol = columns.find((c) => c.mobile === 'title') ?? columns[0];

  if (loading) return <SkeletonRows />;
  if (!rows.length) return <>{empty ?? <EmptyState title={t('c.noResults')} hint={t('c.noResultsHint')} />}</>;

  return (
    <div>
      {/* desktop / tablet */}
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cx('whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 hover:text-text" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cx('border-t border-border', onRowClick && 'cursor-pointer hover:bg-primary-soft/40')}>
                {columns.map((c) => (
                  <td key={c.key} className={cx('px-4', dense ? 'py-2' : 'py-3', c.align === 'right' && 'text-right num', c.align === 'center' && 'text-center', c.className)}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* mobile: rows collapse into cards */}
      <ul className="divide-y divide-border md:hidden">
        {view.map((r) => (
          <li key={rowKey(r)}>
            <div role={onRowClick ? 'button' : undefined} tabIndex={onRowClick ? 0 : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx('block px-4 py-3', onRowClick && 'active:bg-surface-2')}>
              <div className="mb-1.5 font-medium">{titleCol.render(r)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {columns.filter((c) => c !== titleCol && c.mobile !== 'hide').map((c) => (
                  <div key={c.key} className="min-w-0"><dt className="text-xs text-muted">{c.header}</dt><dd className="truncate">{c.render(r)}</dd></div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm text-muted">
          <span className="num">{t('c.rows', { from: page * pageSize + 1, to: Math.min(sorted.length, (page + 1) * pageSize), total: sorted.length })}</span>
          <div className="flex gap-1">
            <IconButton icon={ChevronLeft} label={t('c.prev')} disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30" />
            <IconButton icon={ChevronRight} label={t('c.next')} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Dialog */

export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal aria-label={typeof title === 'string' ? title : undefined}
        className={cx('flex max-h-[92vh] w-full flex-col rounded-t-card border border-border bg-surface shadow-xl sm:rounded-card', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, danger, confirmLabel }: { open: boolean; onClose: () => void; onConfirm: () => void; title: ReactNode; body?: ReactNode; danger?: boolean; confirmLabel?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>{t('c.cancel')}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel ?? t('c.confirm')}</Button></>}>
      <p className="text-muted">{body ?? t('c.cannotUndo')}</p>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Toasts */

interface ToastItem { id: number; msg: ReactNode; tone: Tone }
const ToastCtx = createContext<(msg: ReactNode, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((msg: ReactNode, tone: Tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end" aria-live="polite">
        {items.map((i) => {
          const Icon = toneIcon[i.tone];
          return (
            <div key={i.id} className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-card border border-border bg-surface px-4 py-3 shadow-lg">
              <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', i.tone === 'danger' ? 'text-danger' : i.tone === 'warning' ? 'text-warning' : 'text-success')} />
              <span className="text-sm">{i.msg}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ Misc */

export function Alert({ tone = 'warning', children, action, icon }: { tone?: Tone; children: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  const Icon = icon ?? toneIcon[tone];
  return (
    <div role="status" className={cx('flex flex-wrap items-center gap-3 rounded-card border px-4 py-3 text-sm', toneCls[tone])}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-text">{children}</div>
      {action}
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, max = 9999 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-ctl border border-border">
      <button aria-label="−" className="h-11 w-11 text-lg hover:bg-surface-2 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input aria-label="qty" className="num h-11 w-14 border-x border-border bg-transparent text-center" value={value} inputMode="numeric"
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min); }} />
      <button aria-label="+" className="h-11 w-11 text-lg hover:bg-surface-2 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className, inputRef }: { value: string; onChange: (s: string) => void; placeholder?: string; className?: string; inputRef?: React.Ref<HTMLInputElement> }) {
  const { t } = useTranslation();
  return (
    <div className={cx('relative', className)}>
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <Input ref={inputRef} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? t('c.search')} className="pl-9" aria-label={placeholder ?? t('c.search')} />
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

export function DescList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0"><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 break-words">{v}</dd></div>
      ))}
    </dl>
  );
}
