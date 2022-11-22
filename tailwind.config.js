module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        "sans": ['Roboto', 'system-ui'],
        'display': ['Work Sans', 'ui-sans-serif'],
      },
      colors: {
        'primary': '#3C84FC',
        'secondary': '#00FCA8',
        'accent': '#7284FF',
        'important': '#FC3C82',
        'on-primary': '#F9F9F9',
        'on-secondary': '#404040',
        'on-dark': '#FAFAFA',
        'dark': '#2A2A2A',
        'light': {
          '1': '#F5F5F5',
          DEFAULT: '#FAFAFA',
        },
        'link': '#3324BB',
      },
    },
  },
  plugins: [],
}
