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
        // Inter first — webfont, renders cleanly everywhere. -apple-system fallback.
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont',
          'SF Pro Text', 'Segoe UI', 'system-ui', 'sans-serif',
        ],
      },
      borderRadius: {
        // iOS continuous-looking corners — remapping the named scale shifts
        // every inline rounded-* usage toward the iPhone aesthetic.
        md: '12px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
        '3xl': '30px',
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
