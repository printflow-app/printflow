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
          hover: "var(--primary-hover)",
          active: "var(--primary-active)",
          foreground: "var(--primary-foreground)",
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
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
        subtle: "var(--subtle-foreground)",
        surface2: "var(--surface-2)",
      },
      fontFamily: {
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont',
          'SF Pro Text', 'Segoe UI', 'system-ui', 'sans-serif',
        ],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
        overlay: '16px',
        sm: '8px',
        md: '8px',
        lg: '12px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(41, 37, 36, 0.04)',
        DEFAULT: '0 1px 3px rgba(41, 37, 36, 0.05)',
        md: '0 4px 16px rgba(41, 37, 36, 0.06)',
        lg: '0 10px 30px rgba(41, 37, 36, 0.08)',
        xl: '0 16px 44px rgba(41, 37, 36, 0.10)',
        '2xl': '0 24px 60px rgba(41, 37, 36, 0.12)',
      },
      height: {
        'control-sm': '32px',
        'control':    '36px',
        'control-lg': '44px',
      },
      transitionDuration: {
        120: '120ms',
        180: '180ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(.2, .8, .2, 1)',
      },
      /* Semantik z-shkala — o'zboshimcha z-[9999] taqiqlanadi */
      zIndex: {
        sticky: '10',
        fab: '20',
        dropdown: '30',
        overlay: '50',
        toast: '60',
        tour: '70',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 180ms cubic-bezier(.2, .8, .2, 1)',
        pop: 'pop 180ms cubic-bezier(.2, .8, .2, 1)',
      },
    },
  },
  plugins: [],
}

