import tailwindTypography from '@tailwindcss/typography';
import {
  ColorsMap,
  Options,
  withMaterialColors,
} from 'tailwind-material-colors';
import tailwindScrollbar from 'tailwind-scrollbar';
import type { Config } from 'tailwindcss';

const tailwindConfig = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      maxWidth: {
        'breakpoint-md': '640px', // Tablet
        'breakpoint-lg': '1024px',
        'breakpoint-xl': '1280px', // Large laptop
        'breakpoint-2xl': '1440px', // Desktop
      },
      spacing: {
        '2xs': '0.25rem',
        xs: '0.25rem',
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '3rem',
      },
      fontFamily: {
        sans: ['var(--font-default)', 'Work Sans', 'system-ui'],
        display: [
          'var(--font-display)',
          'var(--font-default)',
          'Itim',
          'ui-sans-serif',
        ],
      },
      fontSize: {
        'display-large': [
          '57px',
          {
            lineHeight: '64px',
            letterSpacing: '-0.04em',
            fontWeight: '600',
          },
        ],
        'display-medium': [
          '45px',
          {
            lineHeight: '52px',
            letterSpacing: '-0.04em',
            fontWeight: '600',
          },
        ],
        'display-small': [
          '36px',
          {
            lineHeight: '44px',
            letterSpacing: '-0.04em',
            fontWeight: '600',
          },
        ],
        'headline-large': [
          '32px',
          {
            lineHeight: '40px',
            letterSpacing: '-0.025em',
            fontWeight: '700',
          },
        ],
        'headline-medium': [
          '28px',
          {
            lineHeight: '36px',
            letterSpacing: '-0.025em',
            fontWeight: '600',
          },
        ],
        'headline-small': [
          '24px',
          {
            lineHeight: '32px',
            letterSpacing: '-0.025em',
            fontWeight: '600',
          },
        ],
        'title-large': [
          '22px',
          {
            lineHeight: '28px',
            fontWeight: '600',
          },
        ],
        'title-medium': [
          '16px',
          {
            lineHeight: '24px',
            letterSpacing: '0.015em',
            fontWeight: '500',
          },
        ],
        'title-small': [
          '14px',
          {
            letterSpacing: '0.01em',
            lineHeight: '20px',
            fontWeight: '500',
          },
        ],
        'label-large': [
          '14px',
          {
            lineHeight: '20px',
            letterSpacing: '0.01em',
            fontWeight: '600',
          },
        ],
        'label-medium': [
          '12px',
          {
            lineHeight: '16px',
            letterSpacing: '0.05em',
            fontWeight: '600',
          },
        ],
        'label-small': [
          '11px',
          {
            lineHeight: '16px',
            letterSpacing: '0.025em',
            fontWeight: '600',
          },
        ],
        'body-medium': [
          '16px',
          {
            lineHeight: '24px',
            fontWeight: '300',
          },
        ],
        'body-small': [
          '14px',
          {
            lineHeight: '16px',
            letterSpacing: '0.04em',
          },
        ],
      },
      colors: {
        maverick: {
          50: '#F0F5FF',
          100: '#E6EFFF',
          200: '#C8DCFE',
          300: '#A5C5FE',
          400: '#7CACFD',
          500: '#3C84FC',
          600: '#2775FC',
          700: '#045FFB',
          800: '#034ECE',
          900: '#023997',
          950: '#01245F',
        },
      },
      screens: {
        tablet: '640px',
        desktop: '1280px',
        'desktop-large': '1440px',
      },
      transitionProperty: {
        width: 'width',
      },
    },
  },
  plugins: [tailwindTypography, tailwindScrollbar],
} satisfies Config;

const materialConfig: ColorsMap = {
  primary: '#3C84FC',
};

const materialColorOptions = {
  scheme: 'fidelity',
  contrast: 0,
  extend: true,
} satisfies Options;

export default withMaterialColors(
  tailwindConfig,
  materialConfig,
  materialColorOptions
);
