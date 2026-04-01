import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Geist', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono:    ['Geist Mono', 'monospace'],
      },
      colors: {
        sd: {
          bg:      "var(--sd-bg)",
          s1:      "var(--sd-s1)",
          s2:      "var(--sd-s2)",
          s3:      "var(--sd-s3)",
          border:  "var(--sd-border)",
          border2: "var(--sd-border2)",
          hover:   "var(--sd-hover)",
          text:    "var(--sd-text)",
          text2:   "var(--sd-text2)",
          text3:   "var(--sd-text3)",
          sidebar: "var(--sd-sidebar)",
          accent:  "var(--sd-accent)",
          accent2: "var(--sd-accent2)",
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(59,130,246,0.15)',
        'glow':    '0 0 24px rgba(59,130,246,0.2)',
        'glow-lg': '0 0 40px rgba(59,130,246,0.25)',
        'card':    '0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #3b82f6, #6366f1)',
        'gradient-accent-hover': 'linear-gradient(135deg, #2563eb, #4f46e5)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to:   { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        float:            "float 4s ease-in-out infinite",
        "float-slow":     "float 6s ease-in-out infinite",
        "float-delayed":  "float 5s 0.8s ease-in-out infinite",
        "fade-up":        "fadeUp 0.5s ease forwards",
        "fade-up-d1":     "fadeUp 0.5s 0.08s ease forwards both",
        "fade-up-d2":     "fadeUp 0.5s 0.16s ease forwards both",
        "fade-up-d3":     "fadeUp 0.5s 0.24s ease forwards both",
        "fade-up-d4":     "fadeUp 0.5s 0.32s ease forwards both",
        "fade-in":        "fadeIn 0.3s ease forwards",
        "slide-right":    "slide-right 0.25s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
