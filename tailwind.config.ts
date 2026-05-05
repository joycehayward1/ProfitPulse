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
        // Brand
        orange: "#E65100",
        "orange-light": "#FF7A00",
        "orange-subtle": "#FFF7F2",

        // Surfaces
        background: "#F8F8F8",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        "surface-inset": "#F4F4F5",

        // Typography
        "text-primary": "#111111",
        "text-secondary": "#4B4B4B",
        "text-muted": "#8B8B8B",

        // Semantic
        accent: "#6C47FF",
        success: "#16A34A",
        "success-subtle": "#F0FDF4",
        warning: "#D97706",
        "warning-subtle": "#FFFBEB",
        error: "#DC2626",
        "error-subtle": "#FEF2F2",
        insight: "#6C47FF",
        "insight-subtle": "#F5F3FF",

        // Borders
        border: "#E4E4E7",
        "border-light": "#F0F0F2",
        "border-strong": "#D1D1D6",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-inter)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        full: "9999px",
      },
      fontSize: {
        // Display / hero
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display": ["36px", { lineHeight: "1.15", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display-sm": ["28px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        // Headings
        "heading-lg": ["24px", { lineHeight: "1.25", letterSpacing: "-0.015em", fontWeight: "600" }],
        "heading": ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "heading-sm": ["16px", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "600" }],
        // Metric values
        "metric-lg": ["44px", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "700" }],
        "metric": ["32px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "700" }],
        "metric-sm": ["24px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
        // Body
        "body-lg": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body": ["14px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        // Small / labels
        "label": ["12px", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "500" }],
        "caption": ["11px", { lineHeight: "1.4", letterSpacing: "0.01em", fontWeight: "500" }],
        // Legacy aliases (keep existing code working)
        h1: "32px",
        h2: "24px",
        h3: "18px",
        small: "12px",
      },
      boxShadow: {
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        "soft": "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
        "card": "0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        "medium": "0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
        "elevated": "0 8px 24px -6px rgba(0, 0, 0, 0.1), 0 4px 8px -4px rgba(0, 0, 0, 0.06)",
        "overlay": "0 16px 48px -12px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.08)",
        "glow-orange": "0 0 20px -5px rgba(230, 81, 0, 0.25)",
        "inner-soft": "inset 0 1px 2px rgba(0, 0, 0, 0.06)",
      },
      maxWidth: {
        "content": "1080px",
        "content-wide": "1200px",
      },
    },
  },
  plugins: [],
};
export default config;
