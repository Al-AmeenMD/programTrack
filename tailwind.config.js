/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0F766E", // Teal 700
          hover: "#0D9488", // Teal 600
          light: "#F0FDFA", // Teal 50
          dark: "#115E59", // Teal 800
        },
      },
    },
  },
  plugins: [],
};
