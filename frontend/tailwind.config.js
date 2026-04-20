/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF8FF',
          100: '#DDEFFF',
          500: '#0369A1',
          600: '#075985',
          700: '#0C4A6E',
        },
        mint: {
          50: '#ECFDF5',
          500: '#059669',
          700: '#047857',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        800: '800',
      },
      boxShadow: {
        soft: '0 16px 48px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
