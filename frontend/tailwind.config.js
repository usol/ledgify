/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // 세로 높이가 충분할 때만(예: 세로 모바일/데스크탑) 고정 레이아웃 적용.
      // 짧은 화면(모바일 가로 등)에서는 페이지 전체가 스크롤되어 잘리지 않음.
      screens: {
        tall: { raw: "(min-height: 600px)" },
      },
    },
  },
  plugins: [],
};
