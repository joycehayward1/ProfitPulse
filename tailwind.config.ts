import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: "#E65100",
        "orange-light": "#FF7A00",
        background: "#FAFAFA",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        "text-primary": "#1a1a1a",
        "text-secondary": "#525252",
        "text-muted": "#a3a3a3",
        accent: "#7B1FA2",
        success: "#10b981",
        warning: "#f59e0b",
        error: "#ef4444",
        border: "#e5e5e5",
        "border-light": "#f0f0f0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-inter)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      spacing: {
        xs: "8px",
        sm: "16px",
        md: "24px",
        lg: "32px",
        xl: "48px",
        "2xl": "64px",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "20px",
        full: "9999px",
      },
      fontSize: {
        h1: "32px",
        h2: "24px",
        h3: "18px",
        body: "14px",
        small: "12px",
      },
      boxShadow: {
        "soft": "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 12px -4px rgba(0, 0, 0, 0.05)",
        "medium": "0 4px 16px -4px rgba(0, 0, 0, 0.1), 0 8px 24px -8px rgba(0, 0, 0, 0.1)",
        "elevated": "0 8px 32px -8px rgba(0, 0, 0, 0.12), 0 16px 48px -16px rgba(0, 0, 0, 0.12)",
        "glow-orange": "0 0 20px -5px rgba(230, 81, 0, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
