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
        // Inter loaded via <link> in index.html. System fallbacks match Inter's
        // metrics so FOUT/FOIT doesn't shift layout.
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Design tokens map to CSS variables → single source of truth.
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
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
