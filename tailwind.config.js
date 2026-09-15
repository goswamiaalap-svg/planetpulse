/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        car: '#ef4444',
        bus: '#f97316',
        flight: '#8b5cf6',
        electricity: '#eab308',
        veg_meal: '#22c55e',
        non_veg_meal: '#f43f5e',
      },
    },
  },
  plugins: [],
}
