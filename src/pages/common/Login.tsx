import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pill, ShieldCheck, Smartphone, Store, Building, Lock } from 'lucide-react';
import { useStore } from '@/store/store';
import { useL } from '@/i18n';
import { Alert, Button, Field, Input, Segmented, cx } from '@/components/ui';
import { REGULATOR_ROLES, type User } from '@/data/types';

export default function Login() {
  const { t } = useTranslation();
  const L = useL();
  const { db, login, state, set, online } = useStore();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'creds' | 'otp' | 'pin'>(online ? 'creds' : 'pin');
  const [pending, setPending] = useState<User | null>(null);
  const [error, setError] = useState('');

  const finish = (u: User) => { login(u.id); nav(REGULATOR_ROLES.includes(u.role) ? '/gov' : '/app'); };

  const submitCreds = (u?: User) => {
    const user = u ?? db.users.find((x) => (x.username === username.trim() || x.phone.replace(/\s/g, '') === username.replace(/\s/g, '')) && x.active);
    if (!user || (!u && password !== 'demo')) { setError(t('login.invalid')); return; }
    setError('');
    if (user.twoFactor) { setPending(user); setStep('otp'); setOtp(''); return; }
    finish(user);
  };

  const demo = db.users.filter((u) => u.active && ['u-owner', 'u-pharmacist', 'u-staff', 'u-super', 'u-ministry', 'u-officer', 'u-inspector'].includes(u.id));

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden bg-primary p-10 text-white lg:flex lg:flex-col lg:justify-between dark:bg-[#0b3b37]">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-card bg-white/15"><Pill className="h-6 w-6" /></span>
          <div><p className="text-lg font-semibold">{t('app.name')}</p><p className="text-sm text-white/80">{t('app.ministry')}</p></div>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight">{t('app.tagline')}</h1>
          <ul className="mt-8 space-y-3 text-white/90">
            {[[Store, t('app.pharmacySide')], [Building, t('app.regulatorSide')], [Smartphone, 'Offline-first PWA · ລາວ / English']].map(([I, s], i) => {
              const Icon = I as typeof Store;
              return <li key={i} className="flex items-center gap-3"><Icon className="h-5 w-5" />{s as string}</li>;
            })}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">{t('app.demo')}</p>
      </div>

      {/* form */}
      <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="mb-6 flex w-full max-w-md items-center justify-between">
          <div className="flex items-center gap-2 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-ctl bg-primary text-white"><Pill className="h-5 w-5" /></span><span className="font-semibold">{t('app.name')}</span></div>
          <Segmented className="ml-auto" value={state.lang} onChange={(v) => set({ lang: v })} options={[{ value: 'lo', label: 'ລາວ' }, { value: 'en', label: 'EN' }]} />
        </div>

        <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-soft sm:p-8">
          {step === 'creds' && (
            <form onSubmit={(e) => { e.preventDefault(); submitCreds(); }} className="space-y-4">
              <div><h2 className="text-xl font-semibold">{t('login.title')}</h2><p className="text-sm text-muted">{t('login.subtitle')}</p></div>
              {error && <Alert tone="danger">{error}</Alert>}
              <Field label={t('login.username')} required><Input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="owner / 020 …" /></Field>
              <Field label={t('login.password')} required><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <Button className="w-full" size="lg" type="submit" icon={Lock}>{t('login.signIn')}</Button>
              <button type="button" className="w-full text-center text-sm text-accent hover:underline" onClick={() => setStep('pin')}>{t('login.pin')}</button>
            </form>
          )}
          {step === 'otp' && pending && (
            <form onSubmit={(e) => { e.preventDefault(); if (otp === '123456') finish(pending); else setError(t('login.invalid')); }} className="space-y-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-ctl bg-accent/10 text-accent"><ShieldCheck className="h-5 w-5" /></span>
                <div><h2 className="text-lg font-semibold">{t('login.otp')}</h2><p className="text-sm text-muted">{L(pending.name)}</p></div></div>
              {error && <Alert tone="danger">{error}</Alert>}
              <Field label={t('login.otp')} hint={t('login.otpHint')}>
                <Input autoFocus inputMode="numeric" maxLength={6} className="num text-center text-2xl tracking-[0.5em]" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Button className="w-full" size="lg" type="submit">{t('login.verify')}</Button>
              <Button className="w-full" variant="ghost" type="button" onClick={() => { setStep('creds'); setError(''); }}>{t('c.back')}</Button>
            </form>
          )}
          {step === 'pin' && (
            <form onSubmit={(e) => { e.preventDefault(); const u = db.users.find((x) => x.id === 'u-pharmacist'); if (pin === state.pin && u) finish(u); else setError(t('login.invalid')); }} className="space-y-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-ctl bg-primary-soft text-primary"><KeyRound className="h-5 w-5" /></span>
                <h2 className="text-lg font-semibold">{t('login.pin')}</h2></div>
              {error && <Alert tone="danger">{error}</Alert>}
              <Input autoFocus inputMode="numeric" type="password" maxLength={6} className="num text-center text-2xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="PIN" />
              <Button className="w-full" size="lg" type="submit">{t('login.signIn')}</Button>
              <Button className="w-full" variant="ghost" type="button" onClick={() => { setStep('creds'); setError(''); }}>{t('c.back')}</Button>
            </form>
          )}
          <p className="mt-5 rounded-ctl bg-surface-2 px-3 py-2 text-center text-xs text-muted">{t('login.demoHint')}</p>
        </div>

        <div className="mt-6 w-full max-w-md">
          <p className="mb-2 text-sm font-medium text-muted">{t('login.demoUsers')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {demo.map((u) => {
              const reg = REGULATOR_ROLES.includes(u.role);
              return (
                <button key={u.id} onClick={() => { setUsername(u.username); setPassword('demo'); submitCreds(u); }}
                  className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 text-left shadow-soft hover:border-primary/50">
                  <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full', reg ? 'bg-accent/10 text-accent' : 'bg-primary-soft text-primary')}>
                    {reg ? <ShieldCheck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{t(`role.${u.role}`)}</span><span className="block truncate text-xs text-muted">{u.username}{u.twoFactor && ' · 2FA'}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
