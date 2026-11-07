/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B00',
        'primary-dark': '#E55A00',
        'primary-light': 'rgba(255,107,0,0.15)',
        accent: '#30D158',
        'accent-light': 'rgba(48,209,88,0.15)',
        'app-bg': '#0F0F0F',
        'app-text': '#FFFFFF',
        'sp-card': '#1C1C1E',
        'sp-card2': '#2C2C2E',
        'sp-border': '#3A3A3C',
        'sp-muted': '#8E8E93',
        'sp-blue': '#0A84FF',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
