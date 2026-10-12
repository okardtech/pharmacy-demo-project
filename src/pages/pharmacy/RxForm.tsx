import { useTranslation } from 'react-i18next';
import { Camera, CheckCircle2 } from 'lucide-react';
import { Alert, Field, Input, Segmented, cx } from '@/components/ui';

export interface RxDraft {
  doctorName: string; doctorLicense: string; facility: string; patientName: string; patientAge: string;
  patientSex: 'M' | 'F'; patientIdNo: string; hasPhoto: boolean;
}
export const emptyRx = (): RxDraft => ({ doctorName: '', doctorLicense: '', facility: '', patientName: '', patientAge: '', patientSex: 'M', patientIdNo: '', hasPhoto: false });

/** Controlled drugs need every field plus a photo; other Rx drugs need prescriber + patient basics. */
export function rxValid(r: RxDraft, controlled: boolean) {
  const base = r.doctorName.trim() && r.doctorLicense.trim() && r.facility.trim() && r.patientName.trim() && r.patientAge.trim();
  return !!(controlled ? base && r.patientIdNo.trim() && r.hasPhoto : base);
}

export function RxForm({ value, onChange, controlled }: { value: RxDraft; onChange: (r: RxDraft) => void; controlled: boolean }) {
  const { t } = useTranslation();
  const f = (k: keyof RxDraft) => ({ value: String(value[k]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value }) });
  return (
    <div className="space-y-4">
      {controlled && <Alert tone="danger">{t('rx.photoRequired')}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('rx.doctor')} required><Input {...f('doctorName')} /></Field>
        <Field label={t('rx.doctorLicense')} required><Input {...f('doctorLicense')} placeholder="MD-0000" /></Field>
        <Field label={t('rx.facility')} required className="sm:col-span-2"><Input {...f('facility')} /></Field>
        <Field label={t('rx.patient')} required><Input {...f('patientName')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('rx.age')} required><Input {...f('patientAge')} inputMode="numeric" /></Field>
          <Field label={t('rx.sex')}><Segmented value={value.patientSex} onChange={(v) => onChange({ ...value, patientSex: v })} options={[{ value: 'M', label: t('rx.male') }, { value: 'F', label: t('rx.female') }]} /></Field>
        </div>
        <Field label={t('rx.idNo')} required={controlled} className="sm:col-span-2"><Input {...f('patientIdNo')} /></Field>
      </div>
      <button type="button" onClick={() => onChange({ ...value, hasPhoto: !value.hasPhoto })}
        className={cx('flex w-full items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-sm font-medium', value.hasPhoto ? 'border-success/50 bg-success/10 text-success' : 'border-border text-muted hover:border-primary/50')}>
        {value.hasPhoto ? <><CheckCircle2 className="h-5 w-5" />{t('c.photoAttached')} · rx-photo.jpg (284 KB)</> : <><Camera className="h-5 w-5" />{t('c.attachPhoto')}{controlled && <span className="text-danger"> *</span>}</>}
      </button>
    </div>
  );
}
