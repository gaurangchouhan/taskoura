/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ice: {
          50: '#f8fafc',
          100: '#f0f7ff',
          200: '#e0effe',
          300: '#bae0fd',
          400: '#7cc5fb',
          500: '#38a5f8',
          600: '#0c87eb',
        },
        task: {
          backlog: '#64748b',
          progress: '#0284c7',
          review: '#d97706',
          completed: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'subtle-card': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        'elevated-card': '0 20px 35px -5px rgba(14, 116, 144, 0.08), 0 10px 15px -3px rgba(15, 23, 42, 0.04)',
        'glow-primary': '0 0 40px rgba(56, 165, 248, 0.18)',
        'glow-kanban': '0 25px 60px -15px rgba(2, 132, 199, 0.12)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
