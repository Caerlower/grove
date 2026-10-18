import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070b10",
        void: "#070b10",
        elevated: "#161f2a",
        ink: "#e8efe9",
        muted: "rgba(232, 239, 233, 0.58)",
        leaf: "#5dcea0",
        "leaf-dim": "rgba(93, 206, 160, 0.14)",
        "leaf-bright": "#7ddcb4",
        warn: "#c9a86c",
        gold: "#c9a86c",
        danger: "#e87a6e",
        line: "rgba(232, 239, 233, 0.1)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
        move: "cubic-bezier(0.77, 0, 0.175, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
