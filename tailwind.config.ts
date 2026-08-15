import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1E1B3A",
        paper: "#F7F7FB",
        teacher: {
          DEFAULT: "#3730A3",
          light: "#E7E6F9",
          dark: "#2A2380",
        },
        student: {
          DEFAULT: "#F5A623",
          light: "#FEF3D9",
          dark: "#C9820E",
        },
        parent: {
          DEFAULT: "#059669",
          light: "#D1FAE5",
          dark: "#047857",
        },
      },
      fontFamily: {
        display: ["Lexend", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(30, 27, 58, 0.08), 0 1px 2px -1px rgba(30, 27, 58, 0.06)",
        lift: "0 12px 24px -8px rgba(30, 27, 58, 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
