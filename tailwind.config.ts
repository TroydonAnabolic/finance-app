import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        obsidian: {
          950: "#0a0a0f",
          900: "#0f0f18",
          800: "#16162a",
          700: "#1e1e35",
          600: "#28284a",
        },
        volt: {
          DEFAULT: "#c8ff00",
          dim: "#a3cc00",
          subtle: "#1a2200",
        },
        coral: {
          DEFAULT: "#ff6b6b",
          dim: "#cc5555",
        },
        sky: {
          vivid: "#00d4ff",
        },
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "slide-in": "slideIn 0.3s ease forwards",
        pulse_slow: "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
