/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './popup/**/*.{html,jsx}',
    './options/**/*.{html,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'octopus-deep': '#150E38',
        'octopus-card': '#2E2252',
        'octopus-pink': '#FF47A0',
        'octopus-teal': '#00A69C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
