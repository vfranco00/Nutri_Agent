/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Sobrescreve a paleta padrão do Tailwind pra todo `green-*` do app
        // cair na cor oficial da marca (#52CC02) em vez do verde genérico.
        green: {
          50: "#f0fde7",
          100: "#e1fccf",
          200: "#c3fa9e",
          300: "#9ef962",
          400: "#76f91f",
          500: "#52cc02",
          600: "#44a702",
          700: "#378801",
          800: "#2b6a01",
          900: "#215002",
          950: "#153003",
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(120%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shrinkWidth: {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        shrinkWidth: 'shrinkWidth linear forwards',
      },
    },
  },
  plugins: [],
}