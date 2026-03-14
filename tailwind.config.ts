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
        background: "#0a0a0a",
        surface: "#111111",
        card: "#1a1a1a",
        "card-hover": "#1e1e1e",
        border: "#2a2a2a",
        rise: "#ef4444",
        fall: "#3b82f6",
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
        accent: "#3b82f6",
      },
    },
  },
  plugins: [],
};

export default config;
