import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFloatingUI } from '../src/userscript/ui.js';
import { createUserscriptStorage } from '../src/userscript/storage.js';
import { SETTINGS_KEYS, POSITIONS, detectLanguage } from '../src/shared/settings.js';

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
    const callbacks = {
        onToggleEnabled: vi.fn(),
        onToggleDiscreet: vi.fn(),
        onTogglePromoted: vi.fn(),
        onToggleSuggested: vi.fn(),
        onToggleRecommended: vi.fn(),
        onToggleLogging: vi.fn(),
        onLanguageChange: vi.fn(),
        onPositionChange: vi.fn(),
    };
    // Install the open-mode spy only once per test; makeUI may be called
    // several times (e.g. the real-storage lifecycle test) and re-spying
    // would stack mock wrappers on top of each other.
    if (!vi.isMockFunction(Element.prototype.attachShadow)) {
        vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (options) {
            lastShadowRoot = nativeAttachShadow.call(this, { ...options, mode: 'open' });
            return lastShadowRoot;
        });
    }
    const onScan = options.onScan || vi.fn(() => ({ promoted: 0, suggested: 0 }));
    const getCounters =
        options.getCounters !== undefined
            ? options.getCounters
            : vi.fn(() => ({ sessionTotal: 0, totalPromoted: 0, totalSuggested: 0 }));
    const ui = createFloatingUI({
        settings: { ...baseSettings, ...settings },
        counters: { promoted: 0, suggested: 0 },
        ...callbacks,
        onToggleHideFloatingUI,
        isFeedPage,
        onScan,
        getCounters,
        ...(options.overrides || {}),
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
        callbacks,
        onScan,
        getCounters,
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
    vi.useRealTimers();
    delete globalThis.__VERSION__;
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

describe('floating UI panel interactions', () => {
    function getPanel() {
        return lastShadowRoot.getElementById('lsb-panel');
    }

    it('opens the panel from the FAB and refreshes counters only when opening', () => {
        const { ui, getCounters } = makeUI({
            installDate: Date.now(),
            reviewBannerDismissed: true,
        });
        const fab = lastShadowRoot.getElementById('lsb-fab');
        expect(getCounters).not.toHaveBeenCalled();

        fab.click();
        expect(getPanel().classList.contains('open')).toBe(true);
        expect(getCounters).toHaveBeenCalledTimes(1);

        // Closing again must not trigger another counter refresh.
        fab.click();
        expect(getPanel().classList.contains('open')).toBe(false);
        expect(getCounters).toHaveBeenCalledTimes(1);
        ui.destroy();
    });

    it('updates the badge from getCounters when the panel opens', () => {
        const { ui } = makeUI(
            { reviewBannerDismissed: true },
            {
                getCounters: vi.fn(() => ({
                    sessionTotal: 5,
                    totalPromoted: 3,
                    totalSuggested: 2,
                })),
            },
        );
        const badge = lastShadowRoot.getElementById('lsb-badge');
        expect(badge.classList.contains('visible')).toBe(false);
        lastShadowRoot.getElementById('lsb-fab').click();
        expect(badge.textContent).toBe('5');
        expect(badge.classList.contains('visible')).toBe(true);
        ui.destroy();
    });

    it('does not throw when refreshing counters without a getCounters callback', () => {
        const { ui } = makeUI({ reviewBannerDismissed: true }, { getCounters: null });
        expect(() => lastShadowRoot.getElementById('lsb-fab').click()).not.toThrow();
        ui.destroy();
    });

    it('closes the panel via the close button', () => {
        const { ui } = makeUI({ reviewBannerDismissed: true });
        const fab = lastShadowRoot.getElementById('lsb-fab');
        fab.click();
        expect(getPanel().classList.contains('open')).toBe(true);
        lastShadowRoot.getElementById('lsb-close').click();
        expect(getPanel().classList.contains('open')).toBe(false);
        ui.destroy();
    });

    it('closes the panel when clicking outside the host and keeps it for clicks inside', () => {
        const { ui, host } = makeUI({ reviewBannerDismissed: true });
        const fab = lastShadowRoot.getElementById('lsb-fab');
        fab.click();
        expect(getPanel().classList.contains('open')).toBe(true);

        // A click whose target lives inside the host leaves the panel open.
        host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(getPanel().classList.contains('open')).toBe(true);

        // A click on the document body (outside the host) closes it.
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(getPanel().classList.contains('open')).toBe(false);
        ui.destroy();
    });

    it('toggles the collapsible support section', () => {
        const { ui } = makeUI({ reviewBannerDismissed: true });
        const header = lastShadowRoot.getElementById('lsb-support-toggle');
        const body = lastShadowRoot.getElementById('lsb-support-body');
        expect(header.classList.contains('open')).toBe(false);
        expect(body.classList.contains('open')).toBe(false);
        header.click();
        expect(header.classList.contains('open')).toBe(true);
        expect(body.classList.contains('open')).toBe(true);
        header.click();
        expect(header.classList.contains('open')).toBe(false);
        expect(body.classList.contains('open')).toBe(false);
        ui.destroy();
    });

    it('hides the panel with hide()', () => {
        const { ui } = makeUI({ reviewBannerDismissed: true });
        lastShadowRoot.getElementById('lsb-fab').click();
        expect(getPanel().classList.contains('open')).toBe(true);
        ui.hide();
        expect(ui ? document.getElementById('linkedin-sponsor-block').style.display : '').toBe(
            'none',
        );
        expect(getPanel().classList.contains('open')).toBe(false);
        ui.destroy();
    });
});

describe('floating UI settings toggles', () => {
    function change(id, checked) {
        const input = lastShadowRoot.getElementById(id);
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    it('propagates the enabled toggle and updates disabled styling', () => {
        const { ui, callbacks } = makeUI();
        const fab = lastShadowRoot.getElementById('lsb-fab');
        const panel = lastShadowRoot.getElementById('lsb-panel');
        change('lsb-enabled', false);
        expect(callbacks.onToggleEnabled).toHaveBeenCalledWith(false);
        expect(fab.classList.contains('disabled')).toBe(true);
        expect(panel.classList.contains('disabled')).toBe(true);

        change('lsb-enabled', true);
        expect(callbacks.onToggleEnabled).toHaveBeenLastCalledWith(true);
        expect(fab.classList.contains('disabled')).toBe(false);
        ui.destroy();
    });

    it('propagates the discreet toggle and updates FAB styling', () => {
        const { ui, host, callbacks } = makeUI();
        const fab = lastShadowRoot.getElementById('lsb-fab');
        expect(fab.classList.contains('discreet')).toBe(false);
        change('lsb-discreet', true);
        expect(callbacks.onToggleDiscreet).toHaveBeenCalledWith(true);
        expect(fab.classList.contains('discreet')).toBe(true);
        change('lsb-discreet', false);
        expect(callbacks.onToggleDiscreet).toHaveBeenLastCalledWith(false);
        expect(fab.classList.contains('discreet')).toBe(false);
        ui.destroy();
    });

    it('starts in discreet mode when the setting is enabled', () => {
        const { ui } = makeUI({ discreet: true });
        expect(lastShadowRoot.getElementById('lsb-fab').classList.contains('discreet')).toBe(true);
        ui.destroy();
    });

    it('propagates the filter category toggles', () => {
        const { ui, callbacks } = makeUI();
        change('lsb-filter-promoted', false);
        change('lsb-filter-suggested', false);
        change('lsb-filter-recommended', false);
        expect(callbacks.onTogglePromoted).toHaveBeenCalledWith(false);
        expect(callbacks.onToggleSuggested).toHaveBeenCalledWith(false);
        expect(callbacks.onToggleRecommended).toHaveBeenCalledWith(false);
        change('lsb-filter-promoted', true);
        change('lsb-filter-suggested', true);
        change('lsb-filter-recommended', true);
        expect(callbacks.onTogglePromoted).toHaveBeenLastCalledWith(true);
        expect(callbacks.onToggleSuggested).toHaveBeenLastCalledWith(true);
        expect(callbacks.onToggleRecommended).toHaveBeenLastCalledWith(true);
        ui.destroy();
    });

    it('propagates the logging toggle', () => {
        const { ui, callbacks } = makeUI();
        change('lsb-logging', true);
        expect(callbacks.onToggleLogging).toHaveBeenCalledWith(true);
        change('lsb-logging', false);
        expect(callbacks.onToggleLogging).toHaveBeenLastCalledWith(false);
        ui.destroy();
    });
});

describe('floating UI scan button', () => {
    function clickScan() {
        lastShadowRoot.getElementById('lsb-scan').click();
    }
    const statusEl = () => lastShadowRoot.getElementById('lsb-status');

    it('reports promoted and suggested counts as a success status', () => {
        const { ui, getCounters } = makeUI(
            { reviewBannerDismissed: true },
            {
                onScan: vi.fn(() => ({ promoted: 2, suggested: 3 })),
            },
        );
        clickScan();
        expect(statusEl().textContent).toBe('2 promoted, 3 suggested hidden');
        expect(statusEl().className).toBe('lsb-status success');
        expect(getCounters).toHaveBeenCalled();
        ui.destroy();
    });

    it('reports promoted-only results', () => {
        const { ui } = makeUI(
            { reviewBannerDismissed: true },
            {
                onScan: vi.fn(() => ({ promoted: 4 })),
            },
        );
        clickScan();
        expect(statusEl().textContent).toBe('4 promoted hidden');
        ui.destroy();
    });

    it('reports suggested-only results', () => {
        const { ui } = makeUI(
            { reviewBannerDismissed: true },
            {
                onScan: vi.fn(() => ({ suggested: 1 })),
            },
        );
        clickScan();
        expect(statusEl().textContent).toBe('1 suggested hidden');
        ui.destroy();
    });

    it('reports no posts found when the scan result is empty or missing', () => {
        const { ui } = makeUI(
            { reviewBannerDismissed: true },
            {
                onScan: vi.fn(() => undefined),
            },
        );
        clickScan();
        expect(statusEl().textContent).toBe('No posts found');
        expect(statusEl().className).toBe('lsb-status');

        ui.destroy();

        const second = makeUI(
            { reviewBannerDismissed: true },
            {
                onScan: vi.fn(() => ({ promoted: 0, suggested: 0 })),
            },
        );
        clickScan();
        expect(statusEl().textContent).toBe('No posts found');
        second.ui.destroy();
    });

    it('clears the status message after 3 seconds', () => {
        vi.useFakeTimers();
        const { ui } = makeUI(
            { reviewBannerDismissed: true },
            {
                onScan: vi.fn(() => ({ promoted: 1, suggested: 0 })),
            },
        );
        clickScan();
        expect(statusEl().textContent).not.toBe('');
        vi.advanceTimersByTime(3000);
        expect(statusEl().textContent).toBe('');
        expect(statusEl().className).toBe('lsb-status');
        ui.destroy();
    });
});

describe('floating UI language and position', () => {
    it('applies a language change to translations, host class, links and callback', () => {
        const { ui, callbacks } = makeUI({ reviewBannerDismissed: true });
        const langSelect = lastShadowRoot.getElementById('lsb-language');
        langSelect.value = 'fr';
        langSelect.dispatchEvent(new Event('change', { bubbles: true }));
        expect(callbacks.onLanguageChange).toHaveBeenCalledWith('fr');
        expect(
            document.getElementById('linkedin-sponsor-block').classList.contains('lang-fr'),
        ).toBe(true);
        // Translated scan button from the French dictionary.
        expect(lastShadowRoot.getElementById('lsb-scan').textContent).toBe('Analyser maintenant');
        // Feedback link embeds the new language.
        const feedbackHref = lastShadowRoot.getElementById('lsb-feedback-link').href;
        expect(feedbackHref).toContain('language=fr');
        ui.destroy();
    });

    it('falls back to detectLanguage() when no language is configured', () => {
        const { ui } = makeUI({ language: undefined });
        expect(lastShadowRoot.getElementById('lsb-language').value).toBe(detectLanguage());
        ui.destroy();
    });

    it('applies a position change to the host class and callback', () => {
        const { ui, callbacks } = makeUI({ reviewBannerDismissed: true });
        const posSelect = lastShadowRoot.getElementById('lsb-position');
        posSelect.value = POSITIONS.TOP_LEFT;
        posSelect.dispatchEvent(new Event('change', { bubbles: true }));
        expect(callbacks.onPositionChange).toHaveBeenCalledWith(POSITIONS.TOP_LEFT);
        expect(document.getElementById('linkedin-sponsor-block').classList.contains('pos-tl')).toBe(
            true,
        );
        ui.destroy();
    });

    it('falls back to the bottom-right position when none is configured', () => {
        const { ui } = makeUI({ position: undefined });
        expect(document.getElementById('linkedin-sponsor-block').classList.contains('pos-br')).toBe(
            true,
        );
        expect(lastShadowRoot.getElementById('lsb-position').value).toBe('br');
        ui.destroy();
    });

    it('labels the version with __VERSION__ when injected by rollup', () => {
        globalThis.__VERSION__ = '9.9.9-test';
        const { ui } = makeUI({ reviewBannerDismissed: true });
        expect(lastShadowRoot.getElementById('lsb-version').textContent).toBe('Version 9.9.9-test');
        ui.destroy();
    });

    it('labels the version as unknown when __VERSION__ is absent', () => {
        const { ui } = makeUI({ reviewBannerDismissed: true });
        expect(lastShadowRoot.getElementById('lsb-version').textContent).toBe('Version unknown');
        ui.destroy();
    });

    it('uses default support URLs when none are configured', () => {
        const { ui } = makeUI({ reviewUrl: undefined, githubUrl: undefined }, {});
        expect(lastShadowRoot.getElementById('lsb-review-link').getAttribute('href')).toBe('#');
        expect(lastShadowRoot.getElementById('lsb-github-link').getAttribute('href')).toBe(
            'https://github.com/Hogwai/LinkedinSponsorBlock',
        );
        expect(lastShadowRoot.getElementById('lsb-review-banner-link').getAttribute('href')).toBe(
            '#',
        );
        expect(lastShadowRoot.getElementById('lsb-github-banner-link').getAttribute('href')).toBe(
            'https://github.com/Hogwai/LinkedinSponsorBlock',
        );
        ui.destroy();
    });
});

describe('floating UI review banner', () => {
    const DAY = 1000 * 60 * 60 * 24;

    it('shows the banner once the install age reaches the threshold and dismisses it', () => {
        const onDismissBanner = vi.fn();
        const { ui } = makeUI({
            installDate: Date.now() - 10 * DAY,
            reviewThresholdDays: 7,
            reviewBannerDismissed: false,
            onDismissBanner,
        });
        const banner = lastShadowRoot.getElementById('lsb-review-banner');
        expect(banner.style.display).toBe('');
        lastShadowRoot.getElementById('lsb-dismiss-banner').click();
        expect(banner.style.display).toBe('none');
        expect(onDismissBanner).toHaveBeenCalledTimes(1);
        ui.destroy();
    });

    it('keeps the banner hidden before the threshold is reached', () => {
        const { ui } = makeUI({
            installDate: Date.now() - 2 * DAY,
            reviewThresholdDays: 7,
            reviewBannerDismissed: false,
        });
        expect(lastShadowRoot.getElementById('lsb-review-banner').style.display).toBe('none');
        ui.destroy();
    });

    it('defaults the threshold to 7 days when none is configured', () => {
        const { ui } = makeUI({
            installDate: Date.now() - 8 * DAY,
            reviewThresholdDays: undefined,
            reviewBannerDismissed: false,
        });
        expect(lastShadowRoot.getElementById('lsb-review-banner').style.display).toBe('');
        ui.destroy();

        const belowDefault = makeUI({
            installDate: Date.now() - 6 * DAY,
            reviewThresholdDays: undefined,
            reviewBannerDismissed: false,
        });
        expect(lastShadowRoot.getElementById('lsb-review-banner').style.display).toBe('none');
        belowDefault.ui.destroy();
    });

    it('keeps the banner hidden when previously dismissed or never installed', () => {
        const dismissed = makeUI({
            installDate: Date.now() - 30 * DAY,
            reviewBannerDismissed: true,
        });
        expect(lastShadowRoot.getElementById('lsb-review-banner').style.display).toBe('none');
        dismissed.ui.destroy();

        const noInstallDate = makeUI({
            installDate: 0,
            reviewBannerDismissed: false,
        });
        expect(lastShadowRoot.getElementById('lsb-review-banner').style.display).toBe('none');
        noInstallDate.ui.destroy();
    });

    it('dismisses the banner without an onDismissBanner callback', () => {
        const { ui } = makeUI({
            installDate: Date.now() - 10 * DAY,
            reviewBannerDismissed: false,
        });
        expect(() => lastShadowRoot.getElementById('lsb-dismiss-banner').click()).not.toThrow();
        expect(lastShadowRoot.getElementById('lsb-review-banner').style.display).toBe('none');
        ui.destroy();
    });
});

describe('floating UI public API', () => {
    it('updateCounters refreshes the badge visibility and text', () => {
        const { ui } = makeUI();
        const badge = lastShadowRoot.getElementById('lsb-badge');
        ui.updateCounters(7, 4, 3);
        expect(badge.textContent).toBe('7');
        expect(badge.classList.contains('visible')).toBe(true);
        ui.updateCounters(0, 0, 0);
        expect(badge.textContent).toBe('0');
        expect(badge.classList.contains('visible')).toBe(false);
        ui.destroy();
    });

    it('updateSettings applies every provided key', () => {
        const { ui } = makeUI();
        const fab = lastShadowRoot.getElementById('lsb-fab');
        ui.updateSettings({
            enabled: false,
            filterPromoted: false,
            filterSuggested: false,
            filterRecommended: false,
            logging: true,
        });
        expect(lastShadowRoot.getElementById('lsb-enabled').checked).toBe(false);
        expect(fab.classList.contains('disabled')).toBe(true);
        expect(lastShadowRoot.getElementById('lsb-filter-promoted').checked).toBe(false);
        expect(lastShadowRoot.getElementById('lsb-filter-suggested').checked).toBe(false);
        expect(lastShadowRoot.getElementById('lsb-filter-recommended').checked).toBe(false);
        expect(lastShadowRoot.getElementById('lsb-logging').checked).toBe(true);
        ui.destroy();
    });

    it('updateSettings ignores keys that are not provided', () => {
        const { ui } = makeUI();
        const fab = lastShadowRoot.getElementById('lsb-fab');
        ui.updateSettings({});
        expect(lastShadowRoot.getElementById('lsb-enabled').checked).toBe(true);
        expect(fab.classList.contains('disabled')).toBe(false);
        expect(lastShadowRoot.getElementById('lsb-filter-promoted').checked).toBe(true);
        expect(lastShadowRoot.getElementById('lsb-filter-suggested').checked).toBe(true);
        expect(lastShadowRoot.getElementById('lsb-filter-recommended').checked).toBe(true);
        expect(lastShadowRoot.getElementById('lsb-logging').checked).toBe(false);
        ui.destroy();
    });

    it('show() reveals the host on a feed page', () => {
        const { ui, host } = makeUI();
        ui.hide();
        expect(host.style.display).toBe('none');
        ui.show();
        expect(host.style.display).toBe('');
        ui.destroy();
    });
});
