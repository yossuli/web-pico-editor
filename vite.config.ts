import eslint from 'vite-plugin-eslint'
import { VitePWA } from 'vite-plugin-pwa'
import webmanifest from './src/manifest.json';

export default {
  base: './',
  build: {
    outDir: 'docs'
  },
  plugins: [
    eslint({
      // ESLintの設定を追加
      failOnError: false, // エラーでビルドを失敗させない
      failOnWarning: false, // 警告でビルドを失敗させない
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: webmanifest,
    })
  ]
}
