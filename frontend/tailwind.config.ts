import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Arena / night background ramp — deep indigo/violet
        arena: {
          950: "#0a0612",
          900: "#120a22",
          850: "#180d2e",
          800: "#1f1138",
          700: "#2a1850",
          600: "#372066",
        },
        // Player = rune gold
        rune: {
          DEFAULT: "#f4c95d",
          50: "#fdf6e3",
          100: "#fbecc2",
          200: "#f8dd92",
          300: "#f4c95d",
          400: "#e8b13a",
          500: "#cf962a",
          600: "#a8761f",
        },
        // Wizard = arcane violet
        arcane: {
          DEFAULT: "#a855f7",
          50: "#f5edff",
          100: "#e9d8ff",
          200: "#d2b3ff",
          300: "#b98bff",
          400: "#a855f7",
          500: "#8b3ff0",
          600: "#6d28d9",
          700: "#561ca8",
        },
        // Verdicts
        verdict: {
          supported: "#34d399", // emerald
          misleading: "#fb7185", // rose
          unsupported: "#a1a1aa", // zinc
          pending: "#c4b5fd", // soft violet
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Cinzel", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-rune": "0 0 24px 0 rgba(244, 201, 93, 0.35)",
        "glow-arcane": "0 0 28px 0 rgba(168, 85, 247, 0.45)",
        "glow-supported": "0 0 24px 0 rgba(52, 211, 153, 0.40)",
        "glow-misleading": "0 0 24px 0 rgba(251, 113, 133, 0.40)",
      },
      backgroundImage: {
        "arena-radial":
          "radial-gradient(1200px 800px at 50% -10%, rgba(109,40,217,0.30), transparent 60%), radial-gradient(900px 600px at 90% 110%, rgba(244,201,93,0.10), transparent 55%)",
        "rune-sheen":
          "linear-gradient(135deg, rgba(244,201,93,0.18), rgba(244,201,93,0.02))",
        "arcane-sheen":
          "linear-gradient(135deg, rgba(168,85,247,0.22), rgba(168,85,247,0.03))",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
