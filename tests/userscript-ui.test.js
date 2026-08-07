import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFloatingUI } from '../src/userscript/ui.js';
import { createUserscriptStorage } from '../src/userscript/storage.js';
import { SETTINGS_KEYS } from '../src/shared/settings.js';

const nativeAttachShadow = Element.prototype.attachShadow;
let lastShadowRoot;

// Tracks every UI created by makeUI so afterEach can destroy any that a
// failing assertion left alive, preventing document-listener leaks.
const createdUIs = new Set();

const baseSettings = {
    enabled: true,
    discreet: false,
    filterPromoted: true,
    filterSuggested: true,
    filterRecommended: true,
    logging: false,
    language: 'en',
    position: 'br',
    hideFloatingUI: false,
    reviewUrl: '#review',
    githubUrl: '#github',
    installDate: 0,
    reviewThresholdDays: 7,
    reviewBannerDismissed: true,
};

function makeUI(settings = {}, options = {}) {
    const onToggleHideFloatingUI = options.onToggleHideFloatingUI || vi.fn();
    const isFeedPage = options.isFeedPage || vi.fn(() => true);
    // Install the open-mode spy only once per test; makeUI may be called
    // several times (e.g. the real-storage lifecycle test) and re-spying
    // would stack mock wrappers on top of each other.
    if (!vi.isMockFunction(Element.prototype.attachShadow)) {
        vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (options) {
            lastShadowRoot = nativeAttachShadow.call(this, { ...options, mode: 'open' });
            return lastShadowRoot;
        });
    }
    const ui = createFloatingUI({
        settings: { ...baseSettings, ...settings },
        counters: { promoted: 0, suggested: 0 },
        onToggleEnabled: vi.fn(),
        onToggleDiscreet: vi.fn(),
        onTogglePromoted: vi.fn(),
        onToggleSuggested: vi.fn(),
        onToggleRecommended: vi.fn(),
        onToggleLogging: vi.fn(),
        onToggleHideFloatingUI,
        isFeedPage,
        onScan: vi.fn(() => ({ promoted: 0, suggested: 0 })),
        onLanguageChange: vi.fn(),
        onPositionChange: vi.fn(),
        getCounters: vi.fn(() => ({ sessionTotal: 0, totalPromoted: 0, totalSuggested: 0 })),
    });

    // Wrap destroy() so tests that clean up themselves are removed from the
    // tracking set, avoiding a double-destroy from the afterEach sweep.
    const tracked = {
        ...ui,
        destroy() {
            createdUIs.delete(tracked);
            return ui.destroy();
        },
    };
    createdUIs.add(tracked);

    return {
        ui: tracked,
        host: document.getElementById('linkedin-sponsor-block'),
        onToggleHideFloatingUI,
        isFeedPage,
    };
}

function dispatchShortcut(target = document, options = {}) {
    target.dispatchEvent(
        new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: ' ',
            code: 'Space',
            ctrlKey: true,
            shiftKey: true,
            ...options,
        }),
    );
}

beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    lastShadowRoot = null;
});

afterEach(() => {
    // Destroy any UI left alive by a failing assertion so its document
    // listeners are removed before the DOM is cleared.
    for (const ui of [...createdUIs]) {
        ui.destroy();
    }
    createdUIs.clear();
    localStorage.clear();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('floating UI visibility preference', () => {
    it('starts hidden when the preference is enabled and show() respects it', () => {
        const { ui, host } = makeUI({ hideFloatingUI: true });
        expect(host.style.display).toBe('none');
        ui.show();
        expect(host.style.display).toBe('none');
        ui.destroy();
    });

    it('toggles and restores with Ctrl+Shift+Space', () => {
        const { ui, host, onToggleHideFloatingUI } = makeUI();
        dispatchShortcut();
        expect(onToggleHideFloatingUI).toHaveBeenLastCalledWith(true);
        expect(host.style.display).toBe('none');
        dispatchShortcut();
        expect(onToggleHideFloatingUI).toHaveBeenLastCalledWith(false);
        expect(host.style.display).toBe('');
        expect(lastShadowRoot.getElementById('lsb-hide-floating-ui').checked).toBe(false);
        ui.destroy();
    });

    it('persists a panel toggle and hides the host immediately', () => {
        const { ui, host, onToggleHideFloatingUI } = makeUI();
        const input = lastShadowRoot.getElementById('lsb-hide-floating-ui');
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onToggleHideFloatingUI).toHaveBeenCalledWith(true);
        expect(host.style.display).toBe('none');
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(onToggleHideFloatingUI).toHaveBeenLastCalledWith(false);
        expect(host.style.display).toBe('');
        ui.destroy();
    });

    it('restores the preference but stays hidden off the feed page until show()', () => {
        const { ui, host, onToggleHideFloatingUI, isFeedPage } = makeUI({ hideFloatingUI: true });
        expect(host.style.display).toBe('none');
        isFeedPage.mockReturnValue(false);
        dispatchShortcut();
        expect(onToggleHideFloatingUI).toHaveBeenLastCalledWith(false);
        expect(host.style.display).toBe('none');
        isFeedPage.mockReturnValue(true);
        ui.show();
        expect(host.style.display).toBe('');
        ui.destroy();
    });

    it('persists hideFloatingUI across a real localStorage lifecycle', () => {
        const storage = createUserscriptStorage(localStorage);
        const persist = (hidden) => storage.set(SETTINGS_KEYS.HIDE_FLOATING_UI, hidden);
        const options = { onToggleHideFloatingUI: persist };

        // First boot: storage is empty so the default is false and the host is visible.
        const first = makeUI(
            {
                [SETTINGS_KEYS.HIDE_FLOATING_UI]: storage.getBoolean(
                    SETTINGS_KEYS.HIDE_FLOATING_UI,
                ),
            },
            options,
        );
        expect(first.host.style.display).toBe('');
        const input = lastShadowRoot.getElementById('lsb-hide-floating-ui');
        expect(input.checked).toBe(false);

        // Toggle the panel checkbox and verify the value is persisted to storage.
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(localStorage.getItem('lsb_hideFloatingUI')).toBe('true');
        first.ui.destroy();

        // Second boot: the stored value is true, so the host starts hidden.
        const second = makeUI(
            {
                [SETTINGS_KEYS.HIDE_FLOATING_UI]: storage.getBoolean(
                    SETTINGS_KEYS.HIDE_FLOATING_UI,
                ),
            },
            options,
        );
        expect(second.host.style.display).toBe('none');

        // The shortcut restores the host and persists the new value.
        dispatchShortcut();
        expect(localStorage.getItem('lsb_hideFloatingUI')).toBe('false');
        second.ui.destroy();

        // Third boot: the stored value is false again, so the host is visible.
        const third = makeUI(
            {
                [SETTINGS_KEYS.HIDE_FLOATING_UI]: storage.getBoolean(
                    SETTINGS_KEYS.HIDE_FLOATING_UI,
                ),
            },
            options,
        );
        expect(third.host.style.display).toBe('');
        third.ui.destroy();
    });
});

describe('floating UI shortcut guards', () => {
    it.each([
        ['alt modifier', { altKey: true }],
        ['meta modifier', { metaKey: true }],
        ['repeated keydown', { repeat: true }],
        ['IME composition', { isComposing: true }],
    ])('ignores %s', (_name, options) => {
        const { ui, onToggleHideFloatingUI } = makeUI();
        dispatchShortcut(document, options);
        expect(onToggleHideFloatingUI).not.toHaveBeenCalled();
        ui.destroy();
    });

    it.each(['input', 'textarea', 'select'])('ignores an event from %s', (tagName) => {
        const { ui, onToggleHideFloatingUI } = makeUI();
        const field = document.createElement(tagName);
        document.body.appendChild(field);
        dispatchShortcut(field);
        expect(onToggleHideFloatingUI).not.toHaveBeenCalled();
        ui.destroy();
    });

    it('ignores an event from a contenteditable element', () => {
        const { ui, onToggleHideFloatingUI } = makeUI();
        const editor = document.createElement('div');
        editor.setAttribute('contenteditable', 'true');
        // jsdom 30 does not implement isContentEditable; model real browser
        // behavior so the production guard can use target.isContentEditable.
        Object.defineProperty(editor, 'isContentEditable', { value: true });
        document.body.appendChild(editor);
        dispatchShortcut(editor);
        expect(onToggleHideFloatingUI).not.toHaveBeenCalled();
        ui.destroy();
    });

    it('ignores a shortcut while an editable control inside the shadow DOM is focused', () => {
        const { ui, onToggleHideFloatingUI } = makeUI();
        const input = lastShadowRoot.getElementById('lsb-hide-floating-ui');
        input.focus();
        expect(lastShadowRoot.activeElement).toBe(input);
        dispatchShortcut(input, { composed: true });
        expect(onToggleHideFloatingUI).not.toHaveBeenCalled();
        ui.destroy();
    });

    it('removes the document listener when destroyed', () => {
        const { ui, onToggleHideFloatingUI } = makeUI();
        ui.destroy();
        dispatchShortcut();
        expect(onToggleHideFloatingUI).not.toHaveBeenCalled();
    });
});
