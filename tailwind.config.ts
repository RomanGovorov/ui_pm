import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        border: {
          primary: 'var(--border-primary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          placeholder: 'var(--text-placeholder)',
        },
        accent: {
          blue: 'var(--accent-blue)',
          red: 'var(--accent-red)',
          amber: 'var(--accent-amber)',
          green: 'var(--accent-green)',
        },
        focus: {
          ring: 'var(--focus-ring)',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        focus: 'var(--shadow-focus)',
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'pulse-dot': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-in-right': 'slideInRight 250ms ease-out',
        'slide-out-right': 'slideOutRight 250ms ease-out',
        'flash-highlight': 'flashHighlight 2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        flashHighlight: {
          '0%': { boxShadow: '0 0 0 3px rgba(59,130,246,0.5)' },
          '100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
