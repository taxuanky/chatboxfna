import type { Config } from 'tailwindcss';

// Tailwind 3.4.x (KHÔNG phải v4): v4 yêu cầu Safari 16.4+/Chrome 111+, còn người dùng là
// nhân viên trại dùng điện thoại đời cũ (design.md §3).
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
