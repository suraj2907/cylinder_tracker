/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0A0E1A",
        cardBg: "#111827",
        cardBg2: "#1A2235",
        customBorder: "#1F2D45",
        accentOrange: "#FF6B35",
        accentCyan: "#4ECDC4",
        accentBlueGreen: "#45B7D1",
        accentYellow: "#FFD93D",
        accentPurple: "#C084FC",
        textSlate: "#E2E8F0",
        mutedSlate: "#64748B",
      },
      fontFamily: {
        inter: ['Inter', 'Segoe UI', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

