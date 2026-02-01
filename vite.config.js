import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // <--- 이 줄을 반드시 추가해야 흰 화면이 뜨지 않습니다.
})
