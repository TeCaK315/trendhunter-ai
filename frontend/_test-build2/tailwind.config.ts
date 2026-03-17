import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          50: '#6366f110',
          100: '#6366f120',
          500: '#6366f1',
          600: '#6366f1',
          700: '#6366f1',
        },
        secondary: {
          DEFAULT: '#8b5cf6',
          500: '#8b5cf6',
        },
        accent: {
          DEFAULT: '#f59e0b',
          500: '#f59e0b',
        },
        background: '#0f0f23',
        foreground: '#e2e8f0',
      },
      fontFamily: {
        heading: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
