import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import type { Bi } from '@/data/types';
import { dict } from './dict';

const lo: Record<string, string> = {};
const en: Record<string, string> = {};
for (const [k, [l, e]] of Object.entries(dict)) { lo[k] = l; en[k] = e; }

void i18n.use(initReactI18next).init({
  resources: { lo: { translation: lo }, en: { translation: en } },
  lng: 'lo',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  keySeparator: false,
});

export default i18n;

/** Pick the right side of a bilingual DB value. */
export function useL() {
  const { i18n: i } = useTranslation();
  return (b: Bi) => (i.language === 'en' ? b.en : b.lo);
}
