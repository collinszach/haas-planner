/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Barlow Condensed"', '"Barlow"', "sans-serif"],
        sans: ['"IBM Plex Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        berkeley: {
          blue: "#003262",
          blueDark: "#002145",
          founders: "#3B7EA1",
          gold: "#FDB515",
          medalist: "#8A5300",
          wellman: "#D9661F",
          bayfog: "#DDD5C7",
        },
        canvas: "#F4F6F9",
        surface: "#FFFFFF",
        subtle: "#F8FAFC",
        hairline: "#D8E0EA",
        ink: {
          primary: "#0F1E30",
          secondary: "#3D4F63",
          muted: "#55687D",
        },
      },
      transitionTimingFunction: {
        snappy: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
