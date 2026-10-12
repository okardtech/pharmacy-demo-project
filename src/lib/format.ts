const TZ = 'Asia/Vientiane';
const DAY = 86_400_000;

export const fmtKip = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₭`;
export const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');

function parts(d: Date) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { d: g('day'), m: g('month'), y: g('year'), h: g('hour'), min: g('minute') };
}

export const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const p = parts(new Date(iso));
  return `${p.d}/${p.m}/${p.y}`;
};
export const fmtDateTime = (iso?: string) => {
  if (!iso) return '—';
  const p = parts(new Date(iso));
  return `${p.d}/${p.m}/${p.y} ${p.h}:${p.min}`;
};
export const fmtTime = (iso: string) => {
  const p = parts(new Date(iso));
  return `${p.h}:${p.min}`;
};

/** Start of "today" in Asia/Vientiane, as a Date. */
export function today(): Date {
  const p = parts(new Date());
  return new Date(`${p.y}-${p.m}-${p.d}T00:00:00+07:00`);
}
export const daysBetween = (a: Date | string, b: Date | string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const ymd = (d: Date) => {
  const p = parts(d);
  return `${p.y}${p.m}${p.d}`;
};
export const monthKey = (d: Date | string) => {
  const p = parts(new Date(d));
  return `${p.y}-${p.m}`;
};
export const isSameDay = (a: string | Date, b: Date) => ymd(new Date(a)) === ymd(b);

/** Compact axis label for Kip: 850k, 1.2M, 45M. */
export const fmtAxisKip = (v: number) => (v >= 10_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
