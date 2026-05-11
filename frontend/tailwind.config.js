/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'octopus-deep':   '#150E38',
        'octopus-card':   '#2E2252',
        'octopus-pink':   '#FF47A0',
        'octopus-teal':   '#00A69C',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    }
  },
  plugins: []
};
