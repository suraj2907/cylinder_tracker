/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light Theme Executive Tokens
        lightBg: "#F8FAFC",       // Slate 50 backdrop
        cardBg: "#FFFFFF",        // Pure white cards
        cardBg2: "#F1F5F9",       // Subtle slate 100 container
        customBorder: "#E2E8F0",   // Soft slate 200 border
        customBorderHover: "#CBD5E1", // Slate 300
        
        // Brand & Accent Colors
        accentOrange: "#EA580C",  // Deep vibrant orange
        accentCyan: "#0284C7",    // Ocean cyan/blue
        accentBlueGreen: "#0D9488", // Teal
        accentYellow: "#D97706",  // Warm amber
        accentPurple: "#7C3AED",  // Rich violet
        accentGreen: "#059669",   // Emerald green
        accentRed: "#DC2626",     // Red alert
        
        // Typography
        textSlate: "#0F172A",     // Dark slate 900 primary text
        mutedSlate: "#64748B",    // Slate 500 subtext
        lightText: "#475569",     // Slate 600
      },
      fontFamily: {
        inter: ['Inter', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(15, 23, 42, 0.05), 0 1px 4px -1px rgba(15, 23, 42, 0.03)',
        'card': '0 4px 20px -4px rgba(15, 23, 42, 0.06)',
        'glass': '0 8px 30px rgba(15, 23, 42, 0.08)',
      }
    },
  },
  plugins: [],
}
