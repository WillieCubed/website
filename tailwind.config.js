/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-default)', 'Work Sans', 'system-ui'],
        display: ['var(--font-default)', 'Work Sans', 'ui-sans-serif'],
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
            lineHeight: '22px',
            letterSpacing: '0.0025em',
            fontWeight: '400',
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
          50: '#ECF3FF',
          100: '#D8E6FE',
          200: '#D8E6FE',
          300: '#8AB5FD',
          500: '#3C84FC',
          950: '#060D19',
        },
        primary: {
          'light-1': '#5E98FD',
          DEFAULT: '#3C84FC',
          'dark-1': '#0E65FB',
          'dark-2': '#023CA1',
        },
        secondary: {
          'light-1': '#33FFBB',
          DEFAULT: '#00FCA8',
          'dark-1': '#00E096',
          'dark-2': '#00CC88',
        },
        accent: {
          'light-2': '#909FFF',
          'light-1': '#8595FF',
          DEFAULT: '#7284FF',
          'dark-1': '#5C72FF',
          'dark-2': '#4760FF',
          'dark-3': '#4157E8',
        },
        surface: {
          foreground: {
            DEFAULT: '#FFFFFF',
            alt: '#D8E6FE',
          },
          background: '#ECF3FF',
        },
        important: '#FC3C82',
        on: {
          'surface-foreground': '#000000',
          primary: '#F9F9F9',
          light: '#404040',
          secondary: '#404040',
          dark: '#FAFAFA',
        },
        emphasis: {
          low: '#0000008C',
        },
        dark: '#2A2A2A',
        light: {
          1: '#F2F2F2',
          2: '#F5F5F5',
          3: '#FAFAFA',
          DEFAULT: '#E1E5F2',
        },
        link: '#3324BB',
      },
      screens: {
        tablet: '640px',
        // => @media (min-width: 640px) { ... }

        tablet: '768px',

        desktop: '1280px',
        // => @media (min-width: 1280px) { ... }
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('tailwind-scrollbar')],
};

module.exports = tailwindConfig;
