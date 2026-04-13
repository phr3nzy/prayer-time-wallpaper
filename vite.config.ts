import { defineConfig, type Plugin } from 'vite';

function wallpaperEngineCompat(): Plugin {
  return {
    name: 'wallpaper-engine-compat',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/ crossorigin/g, '')
        .replace(`type="module"`, 'defer');
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
  plugins: [wallpaperEngineCompat()],
});
