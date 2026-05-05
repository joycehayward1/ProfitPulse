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

        // Surfaces — warm undertone with layered depth
        background: "#FAF9F7",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        "surface-inset": "#F5F4F2",
        "surface-dark": "#1C1917",

        // Typography
        "text-primary": "#0F0F0F",
        "text-secondary": "#44403C",
        "text-muted": "#78716C",

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

        // Borders — warm
        border: "#E7E5E4",
        "border-light": "#F0EDEB",
        "border-strong": "#D6D3D1",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-instrument)", "Georgia", "serif"],
        body: ["var(--font-jakarta)", "sans-serif"],
        mono: ["'SF Mono'", "'JetBrains Mono'", "monospace"],
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
        // Display / hero — uses serif font via font-display class
        "display-lg": ["48px", { lineHeight: "1.08", letterSpacing: "-0.02em", fontWeight: "400" }],
        "display": ["36px", { lineHeight: "1.12", letterSpacing: "-0.015em", fontWeight: "400" }],
        "display-sm": ["28px", { lineHeight: "1.18", letterSpacing: "-0.01em", fontWeight: "400" }],
        // Headings — sans-serif
        "heading-lg": ["24px", { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "700" }],
        "heading": ["20px", { lineHeight: "1.3", letterSpacing: "-0.015em", fontWeight: "700" }],
        "heading-sm": ["16px", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "600" }],
        // Metric values — uses serif for editorial feel
        "metric-lg": ["48px", { lineHeight: "1", letterSpacing: "-0.03em", fontWeight: "400" }],
        "metric": ["36px", { lineHeight: "1", letterSpacing: "-0.025em", fontWeight: "400" }],
        "metric-sm": ["24px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "400" }],
        // Body — clean sans
        "body-lg": ["16px", { lineHeight: "1.65", fontWeight: "400" }],
        "body": ["14px", { lineHeight: "1.65", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "1.5", fontWeight: "500" }],
        // Small / labels
        "label": ["12px", { lineHeight: "1.4", letterSpacing: "0.03em", fontWeight: "600" }],
        "caption": ["11px", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "500" }],
        // Legacy aliases
        h1: "32px",
        h2: "24px",
        h3: "18px",
        small: "12px",
      },
      boxShadow: {
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        "soft": "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)",
        "card": "0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px -2px rgba(0, 0, 0, 0.03)",
        "medium": "0 4px 16px -4px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.03)",
        "elevated": "0 8px 30px -6px rgba(0, 0, 0, 0.1), 0 4px 8px -4px rgba(0, 0, 0, 0.04)",
        "overlay": "0 20px 60px -15px rgba(0, 0, 0, 0.15), 0 8px 20px -8px rgba(0, 0, 0, 0.06)",
        "glow-orange": "0 0 24px -4px rgba(230, 81, 0, 0.2)",
        "inner-soft": "inset 0 1px 2px rgba(0, 0, 0, 0.04)",
      },
      maxWidth: {
        "content": "1080px",
        "content-wide": "1200px",
      },
      backgroundImage: {
        "noise": "url('/noise.svg')",
        "subtle-grid": "linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};
export default config;
