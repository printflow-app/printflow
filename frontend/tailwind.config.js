/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
      },
      fontFamily: {
        // Inter first — it's loaded as a webfont (index.html) so it renders
        // identically and cleanly on every platform (Windows, Telegram, Android).
        // -apple-system kept as a graceful fallback for genuine Apple devices.
        // Inter is geometrically very close to SF, so the iOS feel is preserved.
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont',
          'SF Pro Text', 'Segoe UI', 'system-ui', 'sans-serif',
        ],
      },
      borderRadius: {
        // Design tokens map to CSS variables → single source of truth.
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        // iOS uses generous, continuous-looking corners. Remapping the larger
        // steps shifts every inline rounded-2xl / rounded-3xl toward that look
        // without touching component markup.
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      boxShadow: {
        // iOS shadows are soft, diffuse and low-opacity — almost lighting, not
        // a drop shadow. Remapping the named scale tones down the heavier
        // shadow-lg / shadow-xl / shadow-2xl usages app-wide.
        sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
        DEFAULT: '0 1px 3px rgba(15, 23, 42, 0.06)',
        md: '0 4px 14px rgba(15, 23, 42, 0.06)',
        lg: '0 10px 28px rgba(15, 23, 42, 0.08)',
        xl: '0 16px 40px rgba(15, 23, 42, 0.10)',
        '2xl': '0 24px 56px rgba(15, 23, 42, 0.12)',
      },
      height: {
        // Control heights — match across all form elements.
        'control-sm': 'var(--control-h-sm)',
        'control':    'var(--control-h)',
        'control-lg': 'var(--control-h-lg)',
      },
    },
  },
  plugins: [],
}
