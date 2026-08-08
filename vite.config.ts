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
      rollupOptions: {
        output: {
          // Split the single ~700KB bundle: the app code changes on every
          // publish, but React/icons/animation vendors stay stable, so
          // returning visitors re-download only the small app chunk while
          // the vendor chunks (long-cached, see .htaccess) load in parallel.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
            if (id.includes('/lucide-react/')) return 'icons';
            if (/[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id)) return 'motion';
            return 'vendor';
          },
        },
      },
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
