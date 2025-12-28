/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'quicksand': ['Quicksand', 'sans-serif'],
      },
      colors: {
        'candy-orange': '#FF9F43',
        'candy-green': '#2ECC71',
        'candy-blue': '#54A0FF',
      },
    },
  },
  plugins: [],
}

