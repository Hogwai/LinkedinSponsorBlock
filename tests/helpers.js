import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load a fixture HTML file and return its content.
 */
export function loadFixture(name) {
    const path = join(__dirname, 'fixtures', name);
    return readFileSync(path, 'utf-8');
}

/**
 * Load a fixture and parse it into a DOM element.
 */
export function loadFixtureDOM(name) {
    const html = loadFixture(name);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    return wrapper.firstElementChild;
}

/**
 * Create a minimal state object like the extension uses.
 */
export function createTestState(overrides = {}) {
    const { settings: settingsOverrides, ...restOverrides } = overrides;
    return {
        observer: null,
        isObserverConnected: false,
        sessionPromotedRemoved: 0,
        sessionSuggestedRemoved: 0,
        sessionPostsScanned: 0,
        settings: {
            enabled: true,
            filterPromoted: true,
            filterSuggested: true,
            filterRecommended: true,
            ...settingsOverrides,
        },
        ...restOverrides,
    };
}
