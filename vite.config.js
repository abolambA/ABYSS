import { defineConfig } from 'vite';

export default defineConfig({
    // Use relative paths for built assets so it works on itch.io subdirectories
    base: './',
    build: {
        // Increase chunk size warning limit since Phaser is large
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        }
    }
});
