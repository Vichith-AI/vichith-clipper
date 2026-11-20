import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vichith: {
          black: '#060707',
          surface: '#0B0D0E',
          graphite: '#111416',
          border: 'rgba(255, 255, 255, 0.08)',
          silver: '#8E959E',
          muted: '#686D70',
          white: '#F5F6F5',
          mint: '#35C7B2',
          emerald: '#34D399',
          amber: '#F59E0B',
          rose: '#F43F5E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
