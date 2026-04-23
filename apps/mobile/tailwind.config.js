/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        manager: {
          DEFAULT: '#3B5BA5',
          light: '#EEF2FF',
        },
        firefighter: {
          DEFAULT: '#C2600A',
          light: '#FFF7ED',
        },
        exile: {
          DEFAULT: '#7C3D9B',
          light: '#F5F0FF',
        },
        self: {
          DEFAULT: '#B88A00',
          light: '#FFFBEB',
        },
        background: '#FAFAF8',
        surface: '#FFFFFF',
        border: '#E5E3DE',
        'text-primary': '#1C1B19',
        'text-secondary': '#6B6860',
      },
    },
  },
  plugins: [],
};
