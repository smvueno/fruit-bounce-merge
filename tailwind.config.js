/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./{App,components,constants,services,utils}/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
