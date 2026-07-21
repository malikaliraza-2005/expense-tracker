import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Semantic neon accents — the shared colour vocabulary.
        neon: 'hsl(var(--neon))',
        purple: 'hsl(var(--purple))',
        cyan: 'hsl(var(--cyan))',
        income: 'hsl(var(--income))',
        expense: 'hsl(var(--expense))',
        warning: 'hsl(var(--warning))',
        info: 'hsl(var(--info))',
        glass: 'hsl(var(--glass))',
      },
      borderRadius: {
        '2xl': 'calc(var(--radius) + 6px)',
        xl: 'calc(var(--radius) + 2px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-neon': 'linear-gradient(120deg, hsl(var(--primary)), hsl(var(--info)))',
        'gradient-purple':
          'linear-gradient(120deg, hsl(var(--purple)), hsl(var(--primary)))',
        'gradient-income':
          'linear-gradient(120deg, hsl(var(--income)), hsl(var(--cyan)))',
        'gradient-expense':
          'linear-gradient(120deg, hsl(var(--expense)), hsl(var(--warning)))',
        'grid-faint':
          'linear-gradient(hsl(var(--border) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.5) 1px, transparent 1px)',
      },
      boxShadow: {
        soft: '0 1px 2px 0 hsl(220 40% 2% / 0.05), 0 4px 16px -4px hsl(220 40% 2% / 0.12)',
        elevated:
          '0 8px 24px -6px hsl(220 40% 2% / 0.20), 0 16px 48px -12px hsl(220 40% 2% / 0.24)',
        glow: '0 0 0 1px hsl(var(--glow) / 0.35), 0 8px 30px -6px hsl(var(--glow) / 0.45)',
        'glow-sm': '0 0 20px -4px hsl(var(--glow) / 0.5)',
        'glow-lg': '0 0 60px -8px hsl(var(--glow) / 0.55)',
        'inner-top': 'inset 0 1px 0 0 hsl(0 0% 100% / 0.06)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0) scale(1)' },
          '50%': { transform: 'translateY(-24px) translateX(12px) scale(1.05)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) translateX(0) scale(1)' },
          '50%': {
            transform: 'translateY(20px) translateX(-16px) scale(1.08)',
          },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'ripple': {
          to: { transform: 'scale(4)', opacity: '0' },
        },
        'draw': {
          from: { strokeDashoffset: 'var(--dash, 1000)' },
          to: { strokeDashoffset: '0' },
        },
        'bar-grow': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 20s ease-in-out infinite',
        'float-slow': 'float-slow 26s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3.5s ease-in-out infinite',
        'draw': 'draw 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'bar-grow': 'bar-grow 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
