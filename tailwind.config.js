/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        primary: v('primary'), 'primary-soft': v('primary-soft'), 'on-primary': v('on-primary'),
        accent: v('accent'), bg: v('bg'), surface: v('surface'), 'surface-2': v('surface-2'),
        border: v('border'), text: v('text'), muted: v('muted'),
        success: v('success'), warning: v('warning'), danger: v('danger'),
      },
      borderRadius: { card: '12px', ctl: '8px' },
      fontFamily: { sans: ['Inter', '"Noto Sans Lao"', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgba(0,0,0,.05)' },
    },
  },
  plugins: [],
};
