import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Outfit", "sans-serif"] },
      colors: {
        primary: { DEFAULT: "#22C55E", foreground: "#ffffff", dim: "#16A34A" },
        accent: { DEFAULT: "#6366F1", foreground: "#ffffff", dim: "#4F46E5" },
      },
      borderRadius: { lg: "12px", md: "8px", sm: "6px" },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
