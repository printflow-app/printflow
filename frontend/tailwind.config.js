/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#D4AF37',
          light: '#F4EBD0',
        },
        luxury: {
          bg: '#FFFFFF',
          text: '#1A1A1A',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'], // Luxurious serif fonts
      }
    },
  },
  plugins: [],
}
