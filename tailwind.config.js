/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        dark: {
          bg:      '#0A0F1E',
          surface: '#0F1629',
          card:    '#141929',
          hover:   '#1A2236',
          border:  '#1E2A45',
          muted:   '#2D3A57',
        },
        berry: {
          bg:      '#FFF0F2',
          surface: '#FFF5F6',
          card:    '#FFFFFF',
          hover:   '#FFE4E6',
          border:  '#FBBBBF',
          text:    '#3D0A14',
          muted:   '#7C2D36',
          subtle:  '#B45563',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-in-out',
        'slide-in':  'slideIn 0.25s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%':   { transform: 'translateX(-12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',     opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(12px)',  opacity: '0' },
          '100%': { transform: 'translateY(0)',      opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
