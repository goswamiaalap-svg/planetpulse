/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-instrument-serif)', 'serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        mint: {
          DEFAULT: '#5EEAD4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
        },
        car: '#ef4444',
        bus: '#f97316',
        flight: '#8b5cf6',
        electricity: '#eab308',
        veg_meal: '#22c55e',
        non_veg_meal: '#f43f5e',
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
}
