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
        teacher: {
          DEFAULT: "#2563eb",
          light: "#dbeafe",
        },
        student: {
          DEFAULT: "#f59e0b",
          light: "#fef3c7",
        },
        parent: {
          DEFAULT: "#16a34a",
          light: "#dcfce7",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
