module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      animation: {
        neon: 'neonGlow 1.5s infinite',
        glow: 'subtleGlow 2s infinite',
      },
    },
  },
  plugins: [],
};
