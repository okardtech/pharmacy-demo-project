import { useEffect, useState } from 'react';
import { useStore } from '@/store/store';

const NAMES = ['primary', 'accent', 'success', 'warning', 'danger', 'muted', 'border', 'text', 'surface', 'primary-soft'] as const;
export type Colors = Record<(typeof NAMES)[number], string>;

/** Resolve the CSS design tokens to concrete colors for SVG charts; re-reads when the theme flips. */
export function useColors(): Colors {
  const { state } = useStore();
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(NAMES.map((n) => [n, `rgb(${cs.getPropertyValue(`--${n}`).trim().split(' ').join(',')})`])) as Colors;
  };
  const [c, setC] = useState<Colors>(read);
  useEffect(() => {
    const id = requestAnimationFrame(() => setC(read()));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setTimeout(() => setC(read()), 0);
    mq.addEventListener('change', h);
    return () => { cancelAnimationFrame(id); mq.removeEventListener('change', h); };
  }, [state.theme]);
  return c;
}
