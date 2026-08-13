// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sampled from public/logo_main.jpeg: the mark's blue is rgb(40,100,152)
        // and the "TECH" charcoal is rgb(76,76,74). `brand` is that blue, `ink`
        // is the neutral (not blue-tinted) charcoal used for the app chrome.
        brand: {
          50: '#eff5fa',
          100: '#d8e7f3',
          200: '#b2cde3',
          300: '#7fabcf',
          500: '#286498',
          600: '#21547f',
          700: '#1a4366',
        },
        ink: {
          100: '#e9e8e6',
          400: '#8a8a86',
          500: '#4c4c4a',
          700: '#3a3a38',
          800: '#2b2b2a',
          900: '#1f1f1e',
        },
      },
    },
  },
  plugins: [],
};
