import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // SANGAT PENTING: Base URL harus diset sesuai nama folder di hosting
  // Agar file index.html memanggil script dari /simpdb/assets/ bukan /assets/
  base: '/simpdb/',
  build: {
    outDir: 'dist',
  },
});