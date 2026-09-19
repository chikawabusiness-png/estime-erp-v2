/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf4f0',
          100: '#fbe6dc',
          300: '#e9b79a',
          500: '#c9784a',
          600: '#a8603a',
          700: '#824a2d',
          900: '#432817'
        }
      }
    }
  },
  daisyui: {
    themes: [
      {
        perfumelight: {
          primary: '#a8603a',
          secondary: '#e9b79a',
          accent: '#432817',
          neutral: '#2b1c14',
          'base-100': '#fffaf7',
          info: '#3abff8',
          success: '#36d399',
          warning: '#fbbd23',
          error: '#f87272'
        }
      },
      {
        perfumedark: {
          primary: '#b9a2d4',
          secondary: '#88739f',
          accent: '#e2a7b8',
          neutral: '#17151f',
          'base-100': '#17151f',
          'base-200': '#211d2c',
          'base-300': '#332b40',
          'base-content': '#eee9f2',
          info: '#82b8c9',
          success: '#7fba9b',
          warning: '#d6ad68',
          error: '#d88693'
        }
      }
    ]
  },
  plugins: [require('daisyui')]
}
