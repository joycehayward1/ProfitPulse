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
        background: "#FFF8F5",
        surface: "#FFFFFF",
        "text-primary": "#2D2A26",
        "text-secondary": "#6B6560",
        "text-muted": "#9A948E",
        accent: "#7B1FA2",
        success: "#43A047",
        warning: "#F9A825",
        error: "#D32F2F",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["Arial", "sans-serif"],
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
        full: "50%",
      },
      fontSize: {
        h1: "32px",
        h2: "24px",
        h3: "18px",
        body: "14px",
        small: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
