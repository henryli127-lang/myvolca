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
        'bubble': ['"Bubblegum Sans"', 'cursive'],
      },
      colors: {
        'candy-orange': '#FF9F43',
        'candy-green': '#2ECC71',
        'candy-blue': '#54A0FF',
        // 萌系配色
        'kawaii-pink': '#FFB6C1',
        'kawaii-purple': '#DDA0DD',
        'kawaii-lavender': '#E6E6FA',
        'kawaii-mint': '#98FB98',
        'kawaii-sky': '#87CEEB',
        'kawaii-peach': '#FFDAB9',
        'kawaii-coral': '#FF7F7F',
        // 渐变色节点
        'gradient-blue': '#60A5FA',
        'gradient-cyan': '#22D3EE',
        'gradient-green': '#4ADE80',
        'gradient-yellow': '#FACC15',
        'gradient-orange': '#FB923C',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'float 5s ease-in-out infinite',
        'wiggle': 'wiggle 2s ease-in-out infinite',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
        'sparkle': 'sparkle 1.5s ease-in-out infinite',
        'blob': 'blob 8s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        sparkle: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.7, transform: 'scale(1.2)' },
        },
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(10px, -10px) scale(1.05)' },
          '50%': { transform: 'translate(0, 10px) scale(1)' },
          '75%': { transform: 'translate(-10px, -5px) scale(0.95)' },
        },
      },
    },
  },
  plugins: [],
}

