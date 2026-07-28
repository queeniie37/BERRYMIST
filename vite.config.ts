import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      // Pin an explicit modern baseline. Vite's default target list includes
      // Safari 14, whose destructuring quirk makes esbuild attempt an
      // unimplemented lowering ("Transforming destructuring ... is not
      // supported yet") once esbuild is pinned to 0.28.x for the security
      // fix. es2020 is supported by every browser that already runs this ESM
      // bundle, and drops that quirk so the production build stays green.
      target: 'es2020',
    },
    optimizeDeps: {
      // The dev/dep-optimizer runs esbuild too, and defaults to the same
      // Safari-14-containing target — so pin it to es2020 as well, otherwise
      // pre-bundling third-party deps (e.g. lucide-react) fails the same way.
      esbuildOptions: { target: 'es2020' },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // berry_db.json is rewritten by the Express API on every save; watching it
      // would full-reload the page (kicking readers out of chapters) in dev.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/berry_db.json'] },
    },
  };
});
