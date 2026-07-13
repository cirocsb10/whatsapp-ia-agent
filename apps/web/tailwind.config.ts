import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Outfit", "sans-serif"] },
      colors: {
        border: "var(--border-default)",
        background: "var(--bg-base)",
        foreground: "var(--text-primary)",
        primary: { DEFAULT: "#22C55E", foreground: "#ffffff", dim: "#16A34A" },
        accent: { DEFAULT: "#6366F1", foreground: "#ffffff", dim: "#4F46E5" },
        surface: { 1: "#0F172A", 2: "#1E293B", 3: "#334155" },
        muted: { DEFAULT: "#1E293B", foreground: "#64748B" },
      },
      borderRadius: { lg: "12px", md: "8px", sm: "6px" },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
