/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', '"SF Pro Text"', "system-ui", "sans-serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"SF Pro Display"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
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
        canvas: "#F5F5F7",
        surface: "#FFFFFF",
        subtle: "#FAFAFC",
        hairline: "#E5E5EA",
        ink: {
          primary: "#1D1D1F",
          secondary: "#48484A",
          muted: "#6E6E73",
        },
      },
      transitionTimingFunction: {
        snappy: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
