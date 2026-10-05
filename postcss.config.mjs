// Tailwind CSS 4 runs as a PostCSS plugin: Next.js reads this file and passes every CSS file it
// imports through Tailwind, which turns the utility classes in our components into real CSS.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
