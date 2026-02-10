import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // @ts-ignore
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      host: true
    },
    define: {
      // Vital for using process.env.API_KEY in the browser with Vite
      // Fallback to empty string if not found to prevent build crash
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      // Prevents "process is not defined" crash
      'process.env': {}
    }
  }
})