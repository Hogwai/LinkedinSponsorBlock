import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        pool: 'vmThreads',
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setup.js'],
        coverage: {
            include: ['src/**/*.js'],
            // Browser entry points need a full DOM/extension harness. Keep the
            // exclusion explicit so the coverage report cannot silently omit a
            // new library module.
            exclude: [
                'src/extension/popup.js',
                'src/extension/content.js',
                'src/userscript/content.js',
            ],
            thresholds: {
                statements: 90,
                branches: 75,
                functions: 95,
                lines: 95,
            },
        },
    },
});
