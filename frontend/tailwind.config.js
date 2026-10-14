/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1E2761',
          teal: '#00A896',
          canvas: '#F7F9FC',
          card: '#FFFFFF',
          frost: '#F1F5FD',
          cornflower: '#CADCFC',
          slate: '#64748B',
          dark: '#0B1C30',
        },
        status: {
          backlog: '#64748B',
          progress: '#2563EB',
          testing: '#D97706',
          completed: '#059669',
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'card': '16px',
        'subtle': '12px',
        'btn': '8px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(30, 39, 97, 0.04), 0 4px 12px 0 rgba(30, 39, 97, 0.03)',
        'lifted': '0 12px 28px -4px rgba(30, 39, 97, 0.08), 0 4px 10px -2px rgba(30, 39, 97, 0.04)',
        'modal': '0 24px 48px -12px rgba(30, 39, 97, 0.14), 0 8px 16px -4px rgba(30, 39, 97, 0.06)',
        'glow-teal': '0 0 16px 2px rgba(0, 168, 150, 0.25)',
      }
    },
  },
  plugins: [],
}
