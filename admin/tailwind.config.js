/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
        },
      },
      fontFamily: {
        // Plus Jakarta Sans — Inter'dan farqli, xarakterli grotesk (2026-07 redizayn).
        sans: [
          'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'system-ui', 'sans-serif',
        ],
        // Raqam/ID/kod — ustunlarda tekis turadi.
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        // Konsol registri — iOS'ning yumshoq burchaklaridan tig'izroq shkala.
        // Ichki elementlar (input/badge) tig'iz, konteynerlar yumshoqroq.
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      boxShadow: {
        // Soft, diffuse, low-opacity iOS shadows.
        sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
        DEFAULT: '0 1px 3px rgba(15, 23, 42, 0.06)',
        md: '0 4px 14px rgba(15, 23, 42, 0.06)',
        lg: '0 10px 28px rgba(15, 23, 42, 0.08)',
        xl: '0 16px 40px rgba(15, 23, 42, 0.10)',
        '2xl': '0 24px 56px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
}
