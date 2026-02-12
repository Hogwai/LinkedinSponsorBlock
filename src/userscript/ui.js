import { createTranslator } from '../shared/translations.js';
import { POSITIONS } from '../shared/settings.js';

// ==================== STYLES ====================
const STYLES = `
    :host {
        all: initial;
        position: fixed !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* ---- Position variants ---- */
    :host(.pos-br) { bottom: 80px !important; right: 20px !important; }
    :host(.pos-bl) { bottom: 80px !important; left: 20px !important; }
    :host(.pos-tr) { top: 80px !important; right: 20px !important; }
    :host(.pos-tl) { top: 80px !important; left: 20px !important; }

    *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    /* ---- FAB ---- */
    .lsb-fab {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0A66C2, #0077B5);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
        transition: transform 0.2s, box-shadow 0.2s, background 0.2s, opacity 0.3s;
        position: relative;
        outline: none;
    }

    .lsb-fab:hover {
        transform: scale(1.08);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .lsb-fab.disabled {
        background: #999;
    }

    .lsb-fab.discreet {
        opacity: 0.15;
        box-shadow: none;
    }

    .lsb-fab.discreet:hover {
        opacity: 0.5;
    }

    .lsb-fab.discreet .lsb-badge {
        display: none;
    }

    .lsb-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #E74C3C;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        line-height: 1;
    }

    .lsb-badge.visible {
        display: flex;
    }

    /* ---- Panel ---- */
    .lsb-panel {
        position: absolute;
        width: 280px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
    }

    .lsb-panel.open {
        display: flex;
        animation: lsb-slide 0.2s ease-out;
    }

    /* Panel position relative to FAB */
    :host(.pos-br) .lsb-panel { bottom: 56px; right: 0; }
    :host(.pos-bl) .lsb-panel { bottom: 56px; left: 0; }
    :host(.pos-tr) .lsb-panel { top: 56px; right: 0; }
    :host(.pos-tl) .lsb-panel { top: 56px; left: 0; }

    @keyframes lsb-slide {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* ---- Header ---- */
    .lsb-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
    }

    .lsb-title {
        font-size: 13px;
        font-weight: 600;
        color: #1a1a1a;
    }

    .lsb-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: #666;
        display: flex;
        align-items: center;
        line-height: 0;
    }

    .lsb-close:hover {
        background: #f0f0f0;
    }

    /* ---- Toggles ---- */
    .lsb-toggles {
        padding: 6px 16px;
    }

    .lsb-toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        user-select: none;
    }

    .lsb-toggle-row span:first-child {
        flex: 1;
    }

    .lsb-toggle-wrap {
        position: relative;
        flex-shrink: 0;
    }

    .lsb-toggle-wrap input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }

    .lsb-switch {
        display: block;
        width: 36px;
        height: 20px;
        background: #ccc;
        border-radius: 10px;
        position: relative;
        transition: background 0.2s;
        cursor: pointer;
    }

    .lsb-switch::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        background: #fff;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    input:checked + .lsb-switch {
        background: #0A66C2;
    }

    input:checked + .lsb-switch::after {
        transform: translateX(16px);
    }

    /* ---- Scan button ---- */
    .lsb-scan-btn {
        display: block;
        width: calc(100% - 32px);
        margin: 4px 16px 8px;
        padding: 8px;
        background: linear-gradient(135deg, #0A66C2, #0077B5);
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .lsb-scan-btn:hover {
        opacity: 0.9;
    }

    .lsb-scan-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* ---- Status ---- */
    .lsb-status {
        text-align: center;
        font-size: 12px;
        min-height: 18px;
        padding: 0 16px;
        margin-bottom: 4px;
        color: #666;
    }

    .lsb-status.success {
        color: #27ae60;
    }

    /* ---- Footer ---- */
    .lsb-footer {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 8px 16px 12px;
        border-top: 1px solid #eee;
        gap: 8px;
    }

    .lsb-lang-select,
    .lsb-pos-select {
        padding: 3px 6px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        background: #fff;
        color: #333;
        cursor: pointer;
    }

    .lsb-pos-select {
        font-size: 14px;
        padding: 2px 4px;
    }

    .lsb-lang-select:focus,
    .lsb-pos-select:focus {
        outline: none;
        border-color: #0A66C2;
    }

    /* ---- Disabled state ---- */
    .lsb-panel.disabled .lsb-filter-toggle { opacity: 0.4; pointer-events: none; }
    .lsb-panel.disabled .lsb-scan-btn { opacity: 0.4; pointer-events: none; }
`;

// ==================== HTML ====================
function createHTML() {
    return `
        <button class="lsb-fab" id="lsb-fab" title="LinkedIn Sponsor Block">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M19 13H5V11H19V13Z" fill="white"/>
                <path d="M19 7H5V5H19V7Z" fill="white"/>
                <path d="M15 17H5V15H15V17Z" fill="white"/>
                <circle cx="18" cy="16" r="5" fill="#E74C3C"/>
                <path d="M15.5 14L20.5 18M20.5 14L15.5 18" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span class="lsb-badge" id="lsb-badge"></span>
        </button>
        <div class="lsb-panel" id="lsb-panel">
            <div class="lsb-header">
                <span class="lsb-title" data-t="title">LinkedIn Sponsor Block</span>
                <button class="lsb-close" id="lsb-close">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
            <div class="lsb-toggles">
                <label class="lsb-toggle-row">
                    <span data-t="enabled">Enabled</span>
                    <span class="lsb-toggle-wrap">
                        <input type="checkbox" id="lsb-enabled">
                        <span class="lsb-switch"></span>
                    </span>
                </label>
                <label class="lsb-toggle-row">
                    <span data-t="discreetMode">Discreet mode</span>
                    <span class="lsb-toggle-wrap">
                        <input type="checkbox" id="lsb-discreet">
                        <span class="lsb-switch"></span>
                    </span>
                </label>
                <label class="lsb-toggle-row lsb-filter-toggle">
                    <span data-t="blockPromotedPosts">Block promoted</span>
                    <span class="lsb-toggle-wrap">
                        <input type="checkbox" id="lsb-filter-promoted">
                        <span class="lsb-switch"></span>
                    </span>
                </label>
                <label class="lsb-toggle-row lsb-filter-toggle">
                    <span data-t="blockSuggestedPosts">Block suggested</span>
                    <span class="lsb-toggle-wrap">
                        <input type="checkbox" id="lsb-filter-suggested">
                        <span class="lsb-switch"></span>
                    </span>
                </label>
            </div>
            <button class="lsb-scan-btn" id="lsb-scan" data-t="scanNow">Scan now</button>
            <div class="lsb-status" id="lsb-status"></div>
            <div class="lsb-footer">
                <select id="lsb-language" class="lsb-lang-select">
                    <option value="en">EN</option>
                    <option value="fr">FR</option>
                </select>
                <select id="lsb-position" class="lsb-pos-select" title="Position">
                    <option value="${POSITIONS.BOTTOM_RIGHT}">\u2198</option>
                    <option value="${POSITIONS.BOTTOM_LEFT}">\u2199</option>
                    <option value="${POSITIONS.TOP_RIGHT}">\u2197</option>
                    <option value="${POSITIONS.TOP_LEFT}">\u2196</option>
                </select>
            </div>
        </div>
    `;
}

// ==================== FLOATING UI ====================
export function createFloatingUI({
    settings,
    counters,
    onToggleEnabled,
    onToggleDiscreet,
    onTogglePromoted,
    onToggleSuggested,
    onScan,
    onLanguageChange,
    onPositionChange,
    getCounters
}) {
    const host = document.createElement('div');
    host.id = 'linkedin-sponsor-block';
    host.classList.add('pos-' + (settings.position || 'br'));
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `<style>${STYLES}</style>${createHTML()}`;

    // Element references
    const $ = (id) => shadow.getElementById(id);
    const fab = $('lsb-fab');
    const badge = $('lsb-badge');
    const panel = $('lsb-panel');
    const closeBtn = $('lsb-close');
    const enabledInput = $('lsb-enabled');
    const discreetInput = $('lsb-discreet');
    const promotedInput = $('lsb-filter-promoted');
    const suggestedInput = $('lsb-filter-suggested');
    const scanBtn = $('lsb-scan');
    const langSelect = $('lsb-language');
    const posSelect = $('lsb-position');
    const statusEl = $('lsb-status');

    let currentLang = settings.language || 'en';
    let statusTimer = null;
    let t = createTranslator(currentLang);

    function applyTranslations() {
        t = createTranslator(currentLang);
        shadow.querySelectorAll('[data-t]').forEach(el => {
            el.textContent = t(el.getAttribute('data-t'));
        });
    }

    function updateDisabledState(enabled) {
        fab.classList.toggle('disabled', !enabled);
        panel.classList.toggle('disabled', !enabled);
    }

    function showStatus(text, type = '') {
        statusEl.textContent = text;
        statusEl.className = 'lsb-status' + (type ? ' ' + type : '');
        clearTimeout(statusTimer);
        statusTimer = setTimeout(() => {
            statusEl.textContent = '';
            statusEl.className = 'lsb-status';
        }, 3000);
    }

    function refreshCounters() {
        if (getCounters) {
            const c = getCounters();
            badge.textContent = c.sessionTotal;
            badge.classList.toggle('visible', c.sessionTotal > 0);
        }
    }

    // Initial state
    enabledInput.checked = settings.enabled;
    discreetInput.checked = settings.discreet || false;
    promotedInput.checked = settings.filterPromoted;
    suggestedInput.checked = settings.filterSuggested;
    langSelect.value = currentLang;
    posSelect.value = settings.position || 'br';
    updateDisabledState(settings.enabled);
    if (settings.discreet) fab.classList.add('discreet');
    applyTranslations();

    // ---- Events ----
    fab.addEventListener('click', (e) => {
        e.stopPropagation();
        const opening = !panel.classList.contains('open');
        panel.classList.toggle('open');
        if (opening) refreshCounters();
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
        if (!host.contains(e.target)) {
            panel.classList.remove('open');
        }
    });

    enabledInput.addEventListener('change', () => {
        updateDisabledState(enabledInput.checked);
        onToggleEnabled(enabledInput.checked);
    });

    discreetInput.addEventListener('change', () => {
        fab.classList.toggle('discreet', discreetInput.checked);
        onToggleDiscreet(discreetInput.checked);
    });

    promotedInput.addEventListener('change', () => {
        onTogglePromoted(promotedInput.checked);
    });

    suggestedInput.addEventListener('change', () => {
        onToggleSuggested(suggestedInput.checked);
    });

    scanBtn.addEventListener('click', () => {
        const result = onScan();
        const promoted = result?.promoted || 0;
        const suggested = result?.suggested || 0;
        const total = promoted + suggested;
        if (total > 0) {
            const parts = [];
            if (promoted > 0) parts.push(`${promoted} ${t('promotedLabel')}`);
            if (suggested > 0) parts.push(`${suggested} ${t('suggestedLabel')}`);
            showStatus(`${parts.join(', ')} ${t('postsHidden')}`, 'success');
            refreshCounters();
        } else {
            showStatus(t('noPostsFound'));
        }
    });

    langSelect.addEventListener('change', () => {
        currentLang = langSelect.value;
        applyTranslations();
        onLanguageChange(currentLang);
    });

    posSelect.addEventListener('change', () => {
        const pos = posSelect.value;
        host.className = 'pos-' + pos;
        onPositionChange(pos);
    });

    // Append to page
    document.body.appendChild(host);

    // Public API
    return {
        updateCounters(sessionTotal, totalPromoted, totalSuggested) {
            badge.textContent = sessionTotal;
            badge.classList.toggle('visible', sessionTotal > 0);
        },
        updateSettings(newSettings) {
            if (newSettings.enabled !== undefined) {
                enabledInput.checked = newSettings.enabled;
                updateDisabledState(newSettings.enabled);
            }
            if (newSettings.filterPromoted !== undefined) {
                promotedInput.checked = newSettings.filterPromoted;
            }
            if (newSettings.filterSuggested !== undefined) {
                suggestedInput.checked = newSettings.filterSuggested;
            }
        },
        show() {
            host.style.display = '';
        },
        hide() {
            host.style.display = 'none';
            panel.classList.remove('open');
        },
        destroy() {
            host.remove();
        }
    };
}
