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
        // Ikkinchi neytral qatlam — sidebar/panel/toolbar fonlari
        surface2: "var(--surface-2)",
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
        // SOFT: soya "tushgan qora dog'" emas, yorug'lik. Rang ham sovuq
        // ko'kdan iliq jigarrangga o'tkazildi — iliq oq fon ustida sovuq
        // soya kir bo'lib ko'rinardi. Shaffoflik yana pasaytirildi:
        // minimalizmda chuqurlikni soya emas, bo'shliq beradi.
        sm: '0 1px 2px rgba(41, 37, 36, 0.03)',
        DEFAULT: '0 1px 3px rgba(41, 37, 36, 0.04)',
        md: '0 4px 16px rgba(41, 37, 36, 0.05)',
        lg: '0 10px 30px rgba(41, 37, 36, 0.06)',
        xl: '0 16px 44px rgba(41, 37, 36, 0.08)',
        '2xl': '0 24px 60px rgba(41, 37, 36, 0.10)',
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
