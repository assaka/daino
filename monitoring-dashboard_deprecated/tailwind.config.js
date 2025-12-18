/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'daino-blue': '#2563eb',
        'daino-green': '#059669',
        'daino-red': '#dc2626',
        'daino-yellow': '#d97706'
      }
    },
  },
  plugins: [],
}