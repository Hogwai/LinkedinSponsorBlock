import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setup.js'],
        coverage: {
            thresholds: {
                statements: 90,
                branches: 75,
                functions: 95,
                lines: 95,
            },
        },
    },
});
