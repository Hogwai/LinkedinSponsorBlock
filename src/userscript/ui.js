import { createTranslator } from '../shared/translations.js';
import { POSITIONS, SETTINGS_KEYS, detectLanguage } from '../shared/settings.js';
import { CONFIG } from '../shared/config.js';

// ==================== STYLES ====================
const STYLES = `
    :host {
        all: initial;
        position: fixed !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    :host(.lang-ja) {
        font-family: 'Meiryo', 'Yu Gothic', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif !important;
    }

    :host(.lang-zh) {
        font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', 'SimHei', sans-serif !important;
    }

    :host(.lang-hi) {
        font-family: 'Nirmala UI', 'Segoe UI', 'Mangal', sans-serif !important;
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

    /* ---- Review banner ---- */
    .lsb-review-banner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        margin: 0 12px 4px;
        background: rgba(10, 102, 194, 0.1);
        border: 1px solid rgba(10, 102, 194, 0.25);
        border-radius: 6px;
        font-size: 11px;
        color: #0A66C2;
        line-height: 1.3;
        text-align: center;
        position: relative;
    }

    .lsb-banner-close-btn {
        position: absolute;
        top: 3px;
        right: 3px;
        background: none;
        border: none;
        color: #0A66C2;
        cursor: pointer;
        padding: 2px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.6;
        transition: opacity 0.2s;
    }

    .lsb-banner-close-btn:hover {
        opacity: 1;
    }

    .lsb-review-banner-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
    }

    .lsb-review-banner-btn {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border: 1px solid rgba(10, 102, 194, 0.25);
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        color: #0A66C2;
        text-decoration: none;
        cursor: pointer;
        white-space: nowrap;
        background: none;
        transition: background 0.2s;
    }

    .lsb-review-banner-btn:hover {
        background: rgba(10, 102, 194, 0.1);
    }

    /* ---- Support section (collapsible) ---- */
    .lsb-support-section {
        border-top: 1px solid #eee;
    }

    .lsb-support-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        padding: 8px 16px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: #333;
    }

    .lsb-support-header:hover {
        background: #f8f8f8;
    }

    .lsb-support-chevron {
        transition: transform 0.2s;
        color: #999;
    }

    .lsb-support-header.open .lsb-support-chevron {
        transform: rotate(180deg);
    }

    .lsb-support-body {
        display: none;
        padding: 0 16px 10px;
    }

    .lsb-support-body.open {
        display: block;
    }

    .lsb-support-body p {
        font-size: 11px;
        color: #666;
        line-height: 1.4;
        margin-bottom: 8px;
    }

    .lsb-support-links {
        display: flex;
        gap: 6px;
    }

    .lsb-version {
        padding: 0 16px 10px;
        font-size: 11px;
        color: #999;
        text-align: center;
        line-height: 1.3;
    }

    .lsb-support-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        background: linear-gradient(135deg, #0A66C2, #0077B5);
        color: #fff;
        border: none;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: opacity 0.2s;
        flex: 1;
        justify-content: center;
    }

    .lsb-support-link:hover {
        opacity: 0.9;
    }

    /* ---- Disabled state ---- */
    .lsb-panel.disabled .lsb-filter-toggle { opacity: 0.4; pointer-events: none; }
    .lsb-panel.disabled .lsb-scan-btn { opacity: 0.4; pointer-events: none; }
`;

// ==================== DOM BUILDER HELPERS ====================
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'dataset') {
            for (const [dk, dv] of Object.entries(value)) element.dataset[dk] = dv;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    }
    for (const child of children) {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child) {
            element.appendChild(child);
        }
    }
    return element;
}

function svg(tag, attrs = {}, ...children) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        element.setAttribute(key, value);
    }
    for (const child of children) {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child) {
            element.appendChild(child);
        }
    }
    return element;
}

function svgIcon(w, h, paths) {
    return svg('svg', { width: w, height: h, viewBox: '0 0 24 24', fill: 'none' },
        ...paths.map(p => svg(p.tag || 'path', p))
    );
}

function toggleRow(labelKey, labelText, inputId, extraClass) {
    const attrs = extraClass ? { class: `lsb-toggle-row ${extraClass}` } : { class: 'lsb-toggle-row' };
    return el('label', attrs,
        el('span', { 'data-t': labelKey }, labelText),
        el('span', { class: 'lsb-toggle-wrap' },
            el('input', { type: 'checkbox', id: inputId }),
            el('span', { class: 'lsb-switch' })
        )
    );
}

// ==================== DOM CONSTRUCTION ====================
function createDOM() {
    const fabIcon = svgIcon(22, 22, [
        { d: 'M19 13H5V11H19V13Z', fill: 'white' },
        { d: 'M19 7H5V5H19V7Z', fill: 'white' },
        { d: 'M15 17H5V15H15V17Z', fill: 'white' },
        { tag: 'circle', cx: '18', cy: '16', r: '5', fill: '#E74C3C' },
        { d: 'M15.5 14L20.5 18M20.5 14L15.5 18', stroke: 'white', 'stroke-width': '1.5', 'stroke-linecap': 'round' },
    ]);

    const closeIcon = svgIcon(14, 14, [
        { d: 'M18 6L6 18M6 6l12 12', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' },
    ]);

    const dismissIcon = svgIcon(12, 12, [
        { d: 'M18 6L6 18M6 6l12 12', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' },
    ]);

    const chevronIcon = svg('svg', { class: 'lsb-support-chevron', width: '12', height: '12', viewBox: '0 0 24 24', fill: 'none' },
        svg('path', { d: 'M6 9l6 6 6-6', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    );

    const starIcon = svgIcon(11, 11, [
        { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: 'currentColor' },
    ]);

    const githubIcon = svgIcon(11, 11, [
        { d: 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.607.069-.607 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z', fill: 'currentColor' },
    ]);

    const issueIcon = svgIcon(11, 11, [
        { d: 'M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z', fill: 'currentColor' },
    ]);

    const fab = el('button', { class: 'lsb-fab', id: 'lsb-fab', title: 'Linkedin Sponsor Block' },
        fabIcon,
        el('span', { class: 'lsb-badge', id: 'lsb-badge' })
    );

    const langOptions = ['en', 'fr', 'es', 'pt', 'de', 'it', 'hi', 'ar', 'zh', 'ja'];
    const posOptions = [
        { value: POSITIONS.BOTTOM_RIGHT, label: '\u2198' },
        { value: POSITIONS.BOTTOM_LEFT, label: '\u2199' },
        { value: POSITIONS.TOP_RIGHT, label: '\u2197' },
        { value: POSITIONS.TOP_LEFT, label: '\u2196' },
    ];

    const panel = el('div', { class: 'lsb-panel', id: 'lsb-panel' },
        // Header
        el('div', { class: 'lsb-header' },
            el('span', { class: 'lsb-title', 'data-t': 'title' }, 'Linkedin Sponsor Block'),
            el('button', { class: 'lsb-close', id: 'lsb-close' }, closeIcon)
        ),
        // Review banner
        el('div', { class: 'lsb-review-banner', id: 'lsb-review-banner', style: 'display:none' },
            el('button', { class: 'lsb-banner-close-btn', id: 'lsb-dismiss-banner', 'aria-label': 'Dismiss' }, dismissIcon),
            el('span', { 'data-t': 'reviewBannerUserscript' }, 'Enjoying the userscript?'),
            el('div', { class: 'lsb-review-banner-actions' },
                el('a', { id: 'lsb-review-banner-link', href: '#', target: '_blank', class: 'lsb-review-banner-btn', 'data-t': 'leaveReview' }, 'Leave a review'),
                el('a', { id: 'lsb-github-banner-link', href: '#', target: '_blank', class: 'lsb-review-banner-btn' }, '\u2B50 GitHub'),
                el('a', { id: 'lsb-feedback-banner-link', href: '#', target: '_blank', class: 'lsb-review-banner-btn', 'data-t': 'reportIssue' }, 'Report an issue')
            )
        ),
        // Toggles
        el('div', { class: 'lsb-toggles' },
            toggleRow('enabled', 'Enabled', 'lsb-enabled'),
            toggleRow('discreetMode', 'Discreet mode', 'lsb-discreet'),
            toggleRow('blockPromotedPosts', 'Block promoted', 'lsb-filter-promoted', 'lsb-filter-toggle'),
            toggleRow('blockSuggestedPosts', 'Block suggested', 'lsb-filter-suggested', 'lsb-filter-toggle'),
            toggleRow('blockRecommendedPosts', 'Block "Recommended for you"', 'lsb-filter-recommended', 'lsb-filter-toggle'),
            toggleRow('logging', 'Enable logging', 'lsb-logging')
        ),
        // Scan button
        el('button', { class: 'lsb-scan-btn', id: 'lsb-scan', 'data-t': 'scanNow' }, 'Scan now'),
        // Status
        el('div', { class: 'lsb-status', id: 'lsb-status' }),
        // Support section
        el('div', { class: 'lsb-support-section', id: 'lsb-support-section' },
            el('button', { class: 'lsb-support-header', id: 'lsb-support-toggle' },
                el('span', { 'data-t': 'supportTitle' }, 'Support'),
                chevronIcon
            ),
            el('div', { class: 'lsb-support-body', id: 'lsb-support-body' },
                el('p', { 'data-t': 'supportDescription' }, 'This project is free and open-source. A review or a star encourages me to keep improving it!'),
                el('div', { class: 'lsb-support-links' },
                    el('a', { class: 'lsb-support-link', id: 'lsb-review-link', href: '#', target: '_blank' },
                        starIcon,
                        el('span', { 'data-t': 'leaveReview' }, 'Leave a review')
                    ),
                    el('a', { class: 'lsb-support-link', id: 'lsb-github-link', href: '#', target: '_blank' },
                        githubIcon,
                        el('span', { 'data-t': 'githubRepo' }, 'GitHub')
                    ),
                    el('a', { class: 'lsb-support-link', id: 'lsb-feedback-link', href: '#', target: '_blank' },
                        issueIcon,
                        el('span', { 'data-t': 'reportIssue' }, 'Report an issue')
                    )
                )
            )
        ),
        el('div', { class: 'lsb-version', id: 'lsb-version' }),
        // Footer
        el('div', { class: 'lsb-footer' },
            el('select', { id: 'lsb-language', class: 'lsb-lang-select' },
                ...langOptions.map(code => el('option', { value: code }, code.toUpperCase()))
            ),
            el('select', { id: 'lsb-position', class: 'lsb-pos-select', title: 'Position' },
                ...posOptions.map(opt => el('option', { value: opt.value }, opt.label))
            )
        )
    );

    const fragment = document.createDocumentFragment();
    fragment.appendChild(fab);
    fragment.appendChild(panel);
    return fragment;
}

// ==================== FLOATING UI ====================
export function createFloatingUI({
    settings,
    counters,
    onToggleEnabled,
    onToggleDiscreet,
    onTogglePromoted,
    onToggleSuggested,
    onToggleRecommended,
    onToggleLogging,
    onScan,
    onLanguageChange,
    onPositionChange,
    getCounters
}) {
    const host = document.createElement('div');
    host.id = 'linkedin-sponsor-block';
    host.classList.add('pos-' + (settings.position || 'br'));
    const shadow = host.attachShadow({ mode: 'closed' });
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLES;
    shadow.appendChild(styleEl);
    shadow.appendChild(createDOM());

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
    const recommendedInput = $('lsb-filter-recommended');
    const loggingInput = $('lsb-logging');
    const scanBtn = $('lsb-scan');
    const langSelect = $('lsb-language');
    const posSelect = $('lsb-position');
    const statusEl = $('lsb-status');
    const supportSection = $('lsb-support-section');
    const supportToggleBtn = $('lsb-support-toggle');
    const supportBody = $('lsb-support-body');
    const reviewLinkEl = $('lsb-review-link');
    const githubLinkEl = $('lsb-github-link');
    const feedbackLinkEl = $('lsb-feedback-link');
    const bannerFeedbackLink = $('lsb-feedback-banner-link');

    let currentLang = settings.language || detectLanguage();
    let statusTimer = null;
    let t = createTranslator(currentLang);

    function applyTranslations() {
        t = createTranslator(currentLang);

        // Set lang class on host for per-language font overrides (prevents FOIT)
        host.className = host.className.replace(/\blang-\w+\b/g, '').trim();
        host.classList.add(`lang-${currentLang}`);

        shadow.querySelectorAll('[data-t]').forEach(el => {
            el.textContent = t(el.getAttribute('data-t'));
        });

        updateVersionLabel(panel);
    }

    function getUserscriptVersion() {
        return typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'unknown';
    }

    function updateVersionLabel(panelEl) {
        const versionEl = panelEl && panelEl.querySelector('#lsb-version');
        if (versionEl) {
            versionEl.textContent = `${t('versionLabel')} ${getUserscriptVersion()}`;
        }
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
    recommendedInput.checked = settings.filterRecommended;
    loggingInput.checked = settings[SETTINGS_KEYS.LOGGING] || false;
    langSelect.value = currentLang;
    posSelect.value = settings.position || 'br';
    updateDisabledState(settings.enabled);
    if (settings.discreet) fab.classList.add('discreet');
    applyTranslations();

    // Support section - always visible
    reviewLinkEl.href = settings.reviewUrl || '#';
    githubLinkEl.href = settings.githubUrl || 'https://github.com/Hogwai/LinkedinSponsorBlock';

    function updateFeedbackLink() {
        const params = new URLSearchParams({
            version: getUserscriptVersion(),
            platform: 'userscript',
            language: currentLang
        });
        const url = `${CONFIG.FEEDBACK_URL}?${params}`;
        feedbackLinkEl.href = url;
        if (bannerFeedbackLink) bannerFeedbackLink.href = url;
    }
    updateFeedbackLink();

    supportSection.style.display = '';

    // Support section collapsible toggle
    supportToggleBtn.addEventListener('click', () => {
        supportToggleBtn.classList.toggle('open');
        supportBody.classList.toggle('open');
    });

    // Review banner (time-based, dismissable)
    const bannerEl = $('lsb-review-banner');
    const bannerReviewLink = $('lsb-review-banner-link');
    const bannerGithubLink = $('lsb-github-banner-link');
    const dismissBtn = $('lsb-dismiss-banner');
    bannerReviewLink.href = settings.reviewUrl || '#';
    bannerGithubLink.href = settings.githubUrl || 'https://github.com/Hogwai/LinkedinSponsorBlock';
    if (settings.installDate && !settings.reviewBannerDismissed) {
        const daysSinceInstall = (Date.now() - settings.installDate) / (1000 * 60 * 60 * 24);
        if (daysSinceInstall >= (settings.reviewThresholdDays || 7)) {
            bannerEl.style.display = '';
        }
    }
    dismissBtn.addEventListener('click', () => {
        bannerEl.style.display = 'none';
        if (settings.onDismissBanner) settings.onDismissBanner();
    });

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

    recommendedInput.addEventListener('change', () => {
        onToggleRecommended(recommendedInput.checked);
    });

    loggingInput.addEventListener('change', () => {
        onToggleLogging(loggingInput.checked);
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
        updateFeedbackLink();
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
            if (newSettings.filterRecommended !== undefined) {
                recommendedInput.checked = newSettings.filterRecommended;
            }
            if (newSettings.logging !== undefined) {
                loggingInput.checked = newSettings.logging;
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
