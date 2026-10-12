import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Camera, CalendarPlus, Check, ChevronLeft, ChevronRight, ClipboardCheck, FileDown, MapPin, Minus, PenLine, ShieldAlert, X } from 'lucide-react';
import { useStore } from '@/store/store';
import { useRegistry } from '@/store/selectors';
import { can, scopePharmacies } from '@/store/rbac';
import { useL } from '@/i18n';
import { GPP_TEMPLATE } from '@/data/seed';
import { scoreInspection } from '@/lib/rules';
import { addDays, fmtDate, today, ymd } from '@/lib/format';
import { uuidv7 } from '@/lib/id';
import type { Answer, CorrectiveAction, Inspection } from '@/data/types';
import { Alert, Badge, Button, Card, DataTable, Dialog, EmptyState, Field, IconButton, Input, PageHeader, Segmented, Select, StatusBadge, Textarea, cx, useToast } from '@/components/ui';

export default function Inspections() {
  const { t } = useTranslation();
  const L = useL();
  const nav = useNavigate();
  const { user, db } = useStore();
  const reg = useRegistry();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState<'upcoming' | 'completed'>('upcoming');
  const [plan, setPlan] = useState(false);
  const scopedIds = new Set(scopePharmacies(user, reg).map((p) => p.id));
  const mine = db.inspections.filter((i) => scopedIds.has(i.pharmacyId) && (user?.role !== 'INSPECTOR' || i.inspectorIds.includes(user.id)));
  const rows = mine.filter((i) => (filter === 'upcoming' ? i.status !== 'COMPLETED' : i.status === 'COMPLETED')).sort((a, b) => (filter === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const pname = (id: string) => L(db.pharmacies.find((p) => p.id === id)!.name);

  return (
    <div>
      <PageHeader title={t('ins.title')} subtitle={`${t('ins.template')}: ${L(GPP_TEMPLATE.name)} · v${GPP_TEMPLATE.version}`}
        actions={<>
          <Segmented value={view} onChange={setView} options={[{ value: 'list', label: t('ins.list') }, { value: 'calendar', label: t('ins.calendar') }]} />
          {can(user, 'inspection.plan') && <Button icon={CalendarPlus} onClick={() => setPlan(true)}>{t('ins.plan')}</Button>}
        </>} />
      {view === 'calendar' ? <Calendar items={mine} name={pname} /> : (
        <Card pad={false}>
          <div className="border-b border-border p-3"><Segmented value={filter} onChange={setFilter} options={[{ value: 'upcoming', label: `${t('ins.upcoming')} (${mine.filter((i) => i.status !== 'COMPLETED').length})` }, { value: 'completed', label: `${t('ins.completed')} (${mine.filter((i) => i.status === 'COMPLETED').length})` }]} /></div>
          <DataTable rows={rows} rowKey={(r) => r.id} onRowClick={(r) => nav(`/gov/inspections/${r.id}`)}
            empty={<EmptyState icon={ClipboardCheck} title={t('c.noResults')} action={can(user, 'inspection.plan') && <Button onClick={() => setPlan(true)}>{t('ins.plan')}</Button>} />}
            columns={[
              { key: 'date', header: t('c.date'), sort: (r) => r.date, render: (r) => <span className="num font-medium">{fmtDate(r.date)}</span> },
              { key: 'ph', header: t('nav.registry'), mobile: 'title', render: (r) => <span className="font-medium">{pname(r.pharmacyId)}</span> },
              { key: 'ins', header: t('ins.inspector'), render: (r) => r.inspectorIds.map((u) => L(db.users.find((x) => x.id === u)!.name)).join(', ') },
              { key: 'st', header: t('c.status'), render: (r) => <StatusBadge status={r.status} /> },
              { key: 'res', header: t('ins.result'), render: (r) => (r.result ? <span className="flex items-center gap-2"><StatusBadge status={r.result} /><span className="num text-sm">{r.score}%</span></span> : '—') },
              { key: 'go', header: '', align: 'right', render: (r) => r.status !== 'COMPLETED' && can(user, 'inspection.run') ? <Button size="sm" onClick={(e) => { e.stopPropagation(); nav(`/gov/inspections/${r.id}`); }}>{r.status === 'IN_PROGRESS' ? t('ins.continue') : t('ins.start')}</Button> : null },
            ]} />
        </Card>
      )}
      {plan && <PlanDialog onClose={() => setPlan(false)} />}
    </div>
  );
}

function Calendar({ items, name }: { items: Inspection[]; name: (id: string) => string }) {
  const { i18n } = useTranslation();
  const nav = useNavigate();
  const [offset, setOffset] = useState(0);
  const now = today();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const startDow = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startDow + days) / 7) * 7 }, (_, i) => { const d = i - startDow + 1; return d >= 1 && d <= days ? new Date(first.getFullYear(), first.getMonth(), d) : null; });
  const dows = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(i18n.language === 'lo' ? 'lo-LA' : 'en-GB', { weekday: 'short' }));
  return (
    <Card pad={false} title={first.toLocaleDateString(i18n.language === 'lo' ? 'lo-LA' : 'en-GB', { month: 'long', year: 'numeric' })}
      action={<div className="flex"><IconButton icon={ChevronLeft} label="prev" onClick={() => setOffset((o) => o - 1)} /><IconButton icon={ChevronRight} label="next" onClick={() => setOffset((o) => o + 1)} /></div>}>
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted">{dows.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const list = d ? items.filter((x) => ymd(new Date(x.date)) === ymd(d)) : [];
          const isToday = d && ymd(d) === ymd(now);
          return (
            <div key={i} className={cx('min-h-[92px] border-b border-r border-border p-1.5', !d && 'bg-surface-2/50')}>
              {d && <p className={cx('num mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs', isToday && 'bg-accent font-semibold text-white dark:text-slate-900')}>{d.getDate()}</p>}
              <div className="space-y-1">
                {list.slice(0, 3).map((x) => (
                  <button key={x.id} onClick={() => nav(`/gov/inspections/${x.id}`)} className={cx('block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium',
                    x.status === 'COMPLETED' ? (x.result === 'FAIL' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success') : 'bg-accent/10 text-accent')}>
                    {x.status === 'COMPLETED' ? '✓ ' : '◷ '}{name(x.pharmacyId)}
                  </button>
                ))}
                {list.length > 3 && <p className="text-[11px] text-muted">+{list.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function PlanDialog({ onClose, pharmacyId }: { onClose: () => void; pharmacyId?: string }) {
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const { user, db, write } = useStore();
  const scoped = scopePharmacies(user, db.pharmacies);
  const inspectors = db.users.filter((u) => u.role === 'INSPECTOR' && (!user?.provinceId || u.provinceId === user.provinceId));
  const [f, setF] = useState({ pharmacyId: pharmacyId ?? scoped[0]?.id ?? '', inspector: inspectors[0]?.id ?? '', date: addDays(today(), 7).toISOString().slice(0, 10) });
  const save = () => {
    const now = new Date().toISOString();
    const rec: Inspection = { id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, pharmacyId: f.pharmacyId, inspectorIds: [f.inspector], date: new Date(`${f.date}T09:00:00+07:00`).toISOString(), status: 'PLANNED', templateId: GPP_TEMPLATE.id, answers: {}, notes: {}, photos: {} };
    write('inspections', rec, 'Plan inspection');
    toast(t('ins.planned'));
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title={t('ins.plan')} footer={<><Button variant="secondary" onClick={onClose}>{t('c.cancel')}</Button><Button onClick={save} disabled={!f.pharmacyId || !f.inspector}>{t('c.save')}</Button></>}>
      <div className="space-y-3">
        <Field label={t('nav.registry')} required><Select value={f.pharmacyId} onChange={(e) => setF({ ...f, pharmacyId: e.target.value })} disabled={!!pharmacyId}>{scoped.map((p) => <option key={p.id} value={p.id}>{L(p.name)} · {p.code}</option>)}</Select></Field>
        <Field label={t('ins.inspector')} required><Select value={f.inspector} onChange={(e) => setF({ ...f, inspector: e.target.value })}>{inspectors.map((u) => <option key={u.id} value={u.id}>{L(u.name)}</option>)}</Select></Field>
        <Field label={t('c.date')} required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Run inspection (mobile-first, offline) */

export function RunInspection() {
  const { id } = useParams();
  const { t } = useTranslation();
  const L = useL();
  const toast = useToast();
  const nav = useNavigate();
  const { user, db, write, online } = useStore();
  const insp = db.inspections.find((i) => i.id === id);
  const ph = insp && db.pharmacies.find((p) => p.id === insp.pharmacyId);
  const readOnly = !insp || insp.status === 'COMPLETED' || !can(user, 'inspection.run');
  const [answers, setAnswers] = useState<Record<string, Answer>>(insp?.answers ?? {});
  const [notes, setNotes] = useState<Record<string, string>>(insp?.notes ?? {});
  const [photos, setPhotos] = useState<Record<string, number>>(insp?.photos ?? {});
  const [checkIn, setCheckIn] = useState(insp?.checkIn);
  const [sig, setSig] = useState({ inspector: !!insp?.signedByInspector, pharmacy: !!insp?.signedByPharmacy });
  const [section, setSection] = useState(0);
  const score = useMemo(() => scoreInspection(GPP_TEMPLATE, answers), [answers]);

  if (!insp || !ph) return <p className="p-8 text-center text-muted">{t('c.noResults')}</p>;
  const dist = checkIn ? Math.round(Math.hypot((checkIn.lat - ph.lat) * 111_000, (checkIn.lng - ph.lng) * 105_000)) : 0;
  const sec = GPP_TEMPLATE.sections[section];
  const complete = score.answered === score.total && sig.inspector && sig.pharmacy && !!checkIn;

  const finish = () => {
    const now = new Date().toISOString();
    const done: Inspection = { ...insp, status: 'COMPLETED', answers, notes, photos, score: score.score, result: score.result, checkIn, signedByInspector: true, signedByPharmacy: true };
    write('inspections', done, `Inspection ${ph.code} · ${score.score}%`, 'UPDATE');
    const fails = GPP_TEMPLATE.sections.flatMap((s) => s.items).filter((it) => answers[it.id] === 'NO');
    for (const it of fails) {
      const ca: CorrectiveAction = { id: uuidv7(), createdAt: now, updatedAt: now, createdBy: user!.id, version: 0, pharmacyId: ph.id, inspectionId: insp.id, finding: it.q, action: { lo: `ແກ້ໄຂ: ${it.q.lo}`, en: `Remediate: ${it.q.en}` }, deadline: addDays(today(), it.critical ? 14 : 30).toISOString(), status: 'OPEN' };
      write('corrective', ca, `Corrective action · ${it.id}`);
    }
    toast(t('ins.finished', { n: fails.length }));
    nav('/gov/inspections');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/gov/inspections" className="inline-flex items-center gap-1 text-sm text-accent hover:underline"><ArrowLeft className="h-4 w-4" />{t('ins.title')}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{L(ph.name)}</h1>
          <p className="text-sm text-muted"><span className="num">{fmtDate(insp.date)}</span> · {L(GPP_TEMPLATE.name)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={insp.status} />
          {!online && <Badge tone="warning">{t('ins.offlineReady')}</Badge>}
          {insp.status === 'COMPLETED' && <Button size="sm" variant="secondary" icon={FileDown} onClick={() => toast(`inspection-${ph.code}.pdf ✓`)}>{t('ins.report')}</Button>}
        </div>
      </div>

      {/* sticky score bar */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:bg-surface">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>{t('ins.progress', { a: score.answered, t: score.total })}</span><span>{t('ins.score')}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(score.answered / score.total) * 100}%` }} /></div>
          </div>
          <span className="num text-2xl font-semibold">{score.score}%</span>
          {score.answered === score.total ? <StatusBadge status={score.result} /> : <StatusBadge status="IN_PROGRESS" />}
        </div>
        {score.criticalFails > 0 && <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><ShieldAlert className="h-3.5 w-3.5" />{t('ins.criticalFail', { n: score.criticalFails })}</p>}
      </div>

      <Card>
        {checkIn ? (
          <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-success" /><span className="text-success">✓</span>{t('ins.checkedIn', { m: dist })} · <span className="num text-muted">{checkIn.lat.toFixed(5)}, {checkIn.lng.toFixed(5)}</span></p>
        ) : (
          <Button className="w-full" size="lg" icon={MapPin} disabled={readOnly} onClick={() => {
            const ci = { lat: ph.lat + 0.0003, lng: ph.lng - 0.0002, at: new Date().toISOString() };
            setCheckIn(ci);
            write('inspections', { ...insp, status: 'IN_PROGRESS', checkIn: ci }, `Check-in ${ph.code}`, 'UPDATE');
          }}>{t('ins.checkIn')}</Button>
        )}
      </Card>

      {/* section nav */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {GPP_TEMPLATE.sections.map((s, i) => {
          const done = s.items.every((it) => answers[it.id]);
          return (
            <button key={s.id} onClick={() => setSection(i)} className={cx('flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium', i === section ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-muted')}>
              {done && <Check className="h-4 w-4 text-success" />}{i + 1}. {L(s.title)}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {sec.items.map((it) => (
          <Card key={it.id}>
            <div className="mb-3 flex items-start gap-2">
              <span className="num mt-0.5 text-xs font-semibold text-muted">{it.id}</span>
              <div className="flex-1">
                <p className="font-medium">{L(it.q)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {it.critical && <Badge tone="danger" icon={ShieldAlert}>{t('ins.critical')}</Badge>}
                  <Badge icon={null}>{t('ins.weight')} {it.weight}</Badge>
                  <Badge tone="accent" icon={null}>{t('ins.evidence')}: {L(it.evidence)}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([['YES', Check, 'border-success bg-success/10 text-success'], ['NO', X, 'border-danger bg-danger/10 text-danger'], ['NA', Minus, 'border-muted bg-surface-2 text-text']] as const).map(([v, I, on]) => (
                <button key={v} disabled={readOnly} onClick={() => setAnswers({ ...answers, [it.id]: v })} aria-pressed={answers[it.id] === v}
                  className={cx('flex min-h-[52px] items-center justify-center gap-2 rounded-ctl border-2 font-medium disabled:cursor-default', answers[it.id] === v ? on : 'border-border text-muted hover:bg-surface-2')}>
                  <I className="h-5 w-5" />{t(v === 'YES' ? 'c.yes' : v === 'NO' ? 'c.no' : 'c.na')}
                </button>
              ))}
            </div>
            {(answers[it.id] === 'NO' || notes[it.id] || photos[it.id]) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Textarea placeholder={t('c.notes')} value={notes[it.id] ?? ''} disabled={readOnly} onChange={(e) => setNotes({ ...notes, [it.id]: e.target.value })} className="min-h-[60px]" />
                <Button variant="secondary" icon={Camera} disabled={readOnly} onClick={() => setPhotos({ ...photos, [it.id]: (photos[it.id] ?? 0) + 1 })}>{photos[it.id] ? t('ins.photos', { n: photos[it.id] }) : t('ins.addPhoto')}</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="secondary" icon={ChevronLeft} disabled={section === 0} onClick={() => setSection((s) => s - 1)}>{t('c.back')}</Button>
        {section < GPP_TEMPLATE.sections.length - 1 && <Button variant="accent" onClick={() => { setSection((s) => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('c.next')}<ChevronRight className="h-5 w-5" /></Button>}
      </div>

      {section === GPP_TEMPLATE.sections.length - 1 && (
        <Card title={<span className="flex items-center gap-2"><PenLine className="h-4 w-4" />{t('ins.sign')}</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SignaturePad label={t('ins.signInspector')} signed={sig.inspector} disabled={readOnly} onSigned={(v) => setSig({ ...sig, inspector: v })} />
            <SignaturePad label={t('ins.signPharmacy')} signed={sig.pharmacy} disabled={readOnly} onSigned={(v) => setSig({ ...sig, pharmacy: v })} />
          </div>
          {!readOnly && (
            <div className="mt-4 space-y-3">
              {!complete && <Alert tone="warning">{score.answered < score.total ? t('ins.progress', { a: score.answered, t: score.total }) : !checkIn ? t('ins.checkIn') : t('ins.needSign')}</Alert>}
              <Button size="xl" variant="accent" className="w-full" disabled={!complete} onClick={finish}>{t('ins.finish')}</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function SignaturePad({ label, signed, onSigned, disabled }: { label: string; signed: boolean; onSigned: (v: boolean) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    cv.width = cv.offsetWidth * 2; cv.height = cv.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim().split(' ').length === 3 ? `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--text').trim().split(' ').join(',')})` : '#0F172A';
    if (signed) { ctx.beginPath(); ctx.moveTo(20, 60); ctx.bezierCurveTo(60, 10, 80, 90, 120, 40); ctx.bezierCurveTo(150, 10, 170, 70, 210, 45); ctx.stroke(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><span className="text-sm font-medium">{label}</span>{signed && !disabled && <button className="text-xs text-accent hover:underline" onClick={() => { const cv = ref.current!; cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height); onSigned(false); }}>{t('ins.clearSig')}</button>}</div>
      <canvas ref={ref} aria-label={label} className={cx('h-28 w-full touch-none rounded-ctl border-2 border-dashed bg-surface-2', signed ? 'border-success/50' : 'border-border')}
        onPointerDown={(e) => { if (disabled) return; drawing.current = true; const [x, y] = pos(e); const c = ref.current!.getContext('2d')!; c.beginPath(); c.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const c = ref.current!.getContext('2d')!; c.lineTo(x, y); c.stroke(); }}
        onPointerUp={() => { if (drawing.current) { drawing.current = false; onSigned(true); } }} onPointerLeave={() => { if (drawing.current) { drawing.current = false; onSigned(true); } }} />
      <p className="mt-1 text-xs text-muted">{signed ? `✓ ${t('c.saved')}` : t('ins.signHere')}</p>
    </div>
  );
}
