/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: '#050b14',
        panel: '#0b1422',
        'panel-strong': '#102036',
        'panel-soft': '#142236',
        border: '#243246',
        primary: '#66fcb3',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(102, 252, 179, 0.15), 0 18px 40px rgba(0, 0, 0, 0.35)',
        card: '0 18px 45px rgba(3, 10, 24, 0.35)',
        'card-hover': '0 24px 60px rgba(3, 10, 24, 0.48)',
        'signal-glow': '0 0 0 1px rgba(102, 252, 179, 0.2), 0 0 30px rgba(34, 197, 94, 0.16)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.1s linear infinite',
        'fade-in-up': 'fade-in-up 320ms ease-out',
      },
    },
  },
  plugins: [],
};
