import type { Config } from "tailwindcss";

/**
 * Colors, fonts and radii all reference CSS variables declared in
 * `src/app/globals.css` (`:root`). To re-theme the whole app, edit those
 * variables in one place — Tailwind classes like `bg-surface` / `text-primary`
 * pick up the change automatically.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        "bg-elevated": "var(--color-bg-elevated)",
        surface: "var(--color-surface)",
        "surface-hover": "var(--color-surface-hover)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-strong": "var(--color-primary-strong)",
        accent: "var(--color-accent)",
        "accent-2": "var(--color-accent-2)",
        play: "var(--color-play)",
        "play-strong": "var(--color-play-strong)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        "text-faint": "var(--color-text-faint)",
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        sans: ["var(--font-body)"],
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
      boxShadow: {
        glow: "0 10px 40px -10px var(--shadow-glow)",
        card: "0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
        "gradient-brand-2":
          "linear-gradient(135deg, var(--color-accent-2), var(--color-primary))",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "equalizer": {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease both",
        "equalizer": "equalizer 0.9s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
