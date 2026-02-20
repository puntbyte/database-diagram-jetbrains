import * as path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    plugins: [viteSingleFile()],
    build: {
        outDir: path.resolve(__dirname, '../src/main/resources/web'),
        emptyOutDir: true,
        minify: true, // We can minify again
    },
});