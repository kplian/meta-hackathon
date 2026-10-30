/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        pine: {
          DEFAULT: '#0B3D2E',
          dark: '#072A20',
        },
        mint: {
          DEFAULT: '#E9F5EE',
          deep: '#D9EBE0',
        },
        sage: '#5F7269',
      },
    },
  },
  plugins: [],
};
