import type { TooltipProps } from 'recharts';

/** Recharts tooltip in design tokens; values in text ink, identity by the swatch. */
export function ChartTooltip({ active, payload, label, fmt }: TooltipProps<number, string> & { fmt?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-ctl border border-border bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-xs text-muted">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto font-semibold">{fmt ? fmt(Number(p.value)) : Number(p.value).toLocaleString('en-US')}</span>
        </p>
      ))}
    </div>
  );
}
