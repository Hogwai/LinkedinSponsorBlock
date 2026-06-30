import api from './browser-api.js';
import { createTranslator } from '../shared/translations.js';
import { SETTINGS_KEYS, DEFAULT_SETTINGS, detectLanguage } from '../shared/settings.js';
import { CONFIG } from '../shared/config.js';
import {
    MESSAGE_TYPES,
    createManualScanMessage,
    createResetCountersMessage,
    createSettingsChangedMessage,
} from '../shared/messages.js';

const statusEl = document.getElementById('status');
const scanBtn = document.getElementById('manualScan');
const extensionToggle = document.getElementById('extensionToggle');
const filterPromoted = document.getElementById('filterPromoted');
const filterSuggested = document.getElementById('filterSuggested');
const filterRecommended = document.getElementById('filterRecommended');
const loggingToggle = document.getElementById('loggingToggle');
const languageSelect = document.getElementById('languageSelect');
const container = document.querySelector('.container');
const openStatsBtn = document.getElementById('openStats');
const statsModal = document.getElementById('statsModal');
const closeStatsBtn = document.getElementById('closeStats');
const statsScannedCount = document.getElementById('statsScannedCount');
const pieChart = document.getElementById('pieChart');
const pieChartWrapper = document.querySelector('.pie-chart-wrapper');
const pieLegend = document.getElementById('pieLegend');
const openSettingsBtn = document.getElementById('openSettings');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettings');
const resetCountersBtn = document.getElementById('resetCounters');
const resetConfirm = document.getElementById('resetConfirm');
const confirmResetBtn = document.getElementById('confirmReset');
const cancelResetBtn = document.getElementById('cancelReset');
const supportToggle = document.getElementById('supportToggle');
const supportContent = document.getElementById('supportContent');
const reviewLink = document.getElementById('reviewLink');
const reviewBanner = document.getElementById('reviewBanner');
const reviewBannerLink = document.getElementById('reviewBannerLink');
const dismissBannerBtn = document.getElementById('dismissBanner');
const feedbackLink = document.getElementById('feedbackLink');
const feedbackBannerLink = document.getElementById('feedbackBannerLink');
const settingsVersionEl = document.getElementById('settingsVersion');
const promotedCountEl = document.getElementById('promotedCount');
const suggestedCountEl = document.getElementById('suggestedCount');

let t = createTranslator('en');

// Get current language
function getCurrentLanguage() {
    return languageSelect.value || 'en';
}

function updateVersionLabel() {
    if (!settingsVersionEl) return;
    const version = manifest.version || 'unknown';
    settingsVersionEl.textContent = `${t('versionLabel')} ${version}`;
}

// Update UI with current language
let isFirstLoad = true;

function updateUILanguage() {
    const lang = getCurrentLanguage();
    t = createTranslator(lang);
    updateVersionLabel();

    // Set lang class on body for per-language font overrides (prevents FOIT)
    document.body.className = document.body.className.replace(/\blang-\w+\b/g, '').trim();
    document.body.classList.add(`lang-${lang}`);
    document.documentElement.lang = lang;

    const elements = [...document.querySelectorAll('[data-translate]')];
    const btnText = scanBtn.querySelector('.btn-text');
    if (btnText) elements.push(btnText);

    if (isFirstLoad) {
        // No animation on initial popup open
        elements.forEach((el) => {
            const key = el.getAttribute('data-translate') || 'scanNow';
            el.textContent = t(key);
        });
        isFirstLoad = false;
        return;
    }

    // Show skeleton placeholders, then reveal translations one by one
    elements.forEach((el) => el.classList.add('skeleton'));

    let i = 0;
    function updateNext() {
        if (i >= elements.length) return;
        const el = elements[i++];
        const key = el.getAttribute('data-translate') || 'scanNow';
        el.classList.remove('skeleton');
        el.classList.add('skeleton-reveal');
        el.textContent = t(key);
        requestAnimationFrame(() => {
            el.classList.remove('skeleton-reveal');
        });
        setTimeout(updateNext, 50);
    }
    setTimeout(updateNext, 150);
}

// Load settings from storage
async function loadSettings() {
    const result = await api.storage.local.get(DEFAULT_SETTINGS);

    extensionToggle.checked = result.enabled;
    filterPromoted.checked = result.filterPromoted;
    filterSuggested.checked = result.filterSuggested;
    filterRecommended.checked = result.filterRecommended;
    loggingToggle.checked = result.logging || false;
    languageSelect.value = result.language || detectLanguage();

    updateDisabledState(result.enabled);
    updateUILanguage();
}

// Render SVG pie chart
function renderPieChart(promoted, suggested, content) {
    const total = promoted + suggested + content;
    const segments = [
        { value: content, color: '#27ae60', labelKey: 'contentShort', defaultLabel: 'Content' },
        {
            value: suggested,
            color: '#f39c12',
            labelKey: 'suggestedShort',
            defaultLabel: 'Suggested',
        },
        { value: promoted, color: '#E74C3C', labelKey: 'promotedShort', defaultLabel: 'Promoted' },
    ];

    if (pieChartWrapper) pieChartWrapper.style.display = total > 0 ? '' : 'none';
    pieChart.innerHTML = '';
    pieLegend.innerHTML = '';
    let startAngle = -Math.PI / 2;
    let paths = '';

    segments.forEach(function (seg) {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        const hasValue = seg.value > 0 && total > 0;

        if (hasValue) {
            const angle = (seg.value / total) * Math.PI * 2;
            const endAngle = startAngle + angle;
            const x1 = 50 + 40 * Math.cos(startAngle);
            const y1 = 50 + 40 * Math.sin(startAngle);
            const x2 = 50 + 40 * Math.cos(endAngle);
            const y2 = 50 + 40 * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;

            paths +=
                '<path d="M50,50 L' +
                x1.toFixed(2) +
                ',' +
                y1.toFixed(2) +
                ' A40,40 0 ' +
                largeArc +
                ',1 ' +
                x2.toFixed(2) +
                ',' +
                y2.toFixed(2) +
                ' Z" fill="' +
                seg.color +
                '"/>';
            startAngle = endAngle;
        }

        const row = document.createElement('div');
        row.className = 'pie-legend-row';
        row.innerHTML =
            '<span class="pie-legend-dot" style="background:' +
            seg.color +
            '"></span>' +
            '<span class="pie-legend-label">' +
            (t(seg.labelKey) || seg.defaultLabel) +
            '</span>' +
            '<span class="pie-legend-pct">' +
            pct.toFixed(0) +
            '%</span>' +
            '<span class="pie-legend-value">' +
            seg.value +
            '</span>';
        if (!hasValue) row.classList.add('pie-legend-row--empty');
        pieLegend.appendChild(row);
    });

    pieChart.innerHTML = paths;
}

// Update counters from storage
async function updateCounters() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED]: 0,
        [SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED]: 0,
        [SETTINGS_KEYS.TOTAL_POSTS_SCANNED]: 0,
    });
    const promoted = result[SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED];
    const suggested = result[SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED];
    const scanned = result[SETTINGS_KEYS.TOTAL_POSTS_SCANNED];
    const content = Math.max(0, scanned - promoted - suggested);
    statsScannedCount.textContent = scanned;
    promotedCountEl.textContent = promoted;
    suggestedCountEl.textContent = suggested;
    renderPieChart(promoted, suggested, content);
}

// Save settings to storage
async function saveSettings(settings) {
    await api.storage.local.set(settings);
}

// Update UI disabled state
function updateDisabledState(enabled) {
    if (enabled) {
        container.classList.remove('disabled');
    } else {
        container.classList.add('disabled');
    }
}

// Toggle extension on/off
extensionToggle.addEventListener('change', async () => {
    const enabled = extensionToggle.checked;
    await saveSettings({ enabled });
    updateDisabledState(enabled);

    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('linkedin.com')) {
        api.tabs.sendMessage(tab.id, createSettingsChangedMessage({ enabled }));
    }
    api.runtime.sendMessage(createSettingsChangedMessage({ enabled }));

    setStatus(enabled ? t('extensionEnabled') : t('extensionDisabled'), 'success');
    setTimeout(() => setStatus(''), 2000);
});

// Filter promoted toggle
filterPromoted.addEventListener('change', async () => {
    await saveSettings({ filterPromoted: filterPromoted.checked });
    notifyContentScript(createSettingsChangedMessage({ filterPromoted: filterPromoted.checked }));
});

// Filter suggested toggle
filterSuggested.addEventListener('change', async () => {
    await saveSettings({ filterSuggested: filterSuggested.checked });
    notifyContentScript(createSettingsChangedMessage({ filterSuggested: filterSuggested.checked }));
});

// Filter recommended toggle
filterRecommended.addEventListener('change', async () => {
    await saveSettings({ filterRecommended: filterRecommended.checked });
    notifyContentScript(
        createSettingsChangedMessage({ filterRecommended: filterRecommended.checked }),
    );
});

// Logging toggle
loggingToggle.addEventListener('change', async () => {
    await saveSettings({ logging: loggingToggle.checked });
    notifyContentScript(createSettingsChangedMessage({ logging: loggingToggle.checked }));
});

// Language selector change
languageSelect.addEventListener('change', async () => {
    const language = languageSelect.value;
    await saveSettings({ language });
    updateUILanguage();
    updateFeedbackLink();
});

// Open settings modal
openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('active');
    languageSelect.value = getCurrentLanguage();
});

// Close settings modal
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

// Show reset confirmation
resetCountersBtn.addEventListener('click', () => {
    resetCountersBtn.classList.add('hidden');
    resetConfirm.classList.remove('hidden');
});

// Cancel reset
cancelResetBtn.addEventListener('click', () => {
    resetConfirm.classList.add('hidden');
    resetCountersBtn.classList.remove('hidden');
});

// Confirm reset
confirmResetBtn.addEventListener('click', async () => {
    await saveSettings({
        [SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED]: 0,
        [SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED]: 0,
        [SETTINGS_KEYS.TOTAL_POSTS_SCANNED]: 0,
    });

    statsScannedCount.textContent = '0';
    promotedCountEl.textContent = '0';
    suggestedCountEl.textContent = '0';
    renderPieChart(0, 0, 0);

    api.runtime.sendMessage(createResetCountersMessage());

    resetConfirm.classList.add('hidden');
    resetCountersBtn.classList.remove('hidden');

    settingsModal.classList.remove('active');

    setStatus(t('countersReset'), 'success');
    setTimeout(() => setStatus(''), 3000);
});

// Stats modal
openStatsBtn.addEventListener('click', () => {
    updateCounters();
    statsModal.classList.add('active');
});

closeStatsBtn.addEventListener('click', () => {
    statsModal.classList.remove('active');
});

statsModal.addEventListener('click', (e) => {
    if (e.target === statsModal) {
        statsModal.classList.remove('active');
    }
});

// Notify content script of settings changes
async function notifyContentScript(message) {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('linkedin.com')) {
        api.tabs.sendMessage(tab.id, message);
    }
}

// Manual scan button
scanBtn.addEventListener('click', async () => {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com')) {
        setStatus(t('notOnLinkedin'), 'error');
        return;
    }

    setStatus(t('scanning'), 'pending');
    scanBtn.disabled = true;

    api.tabs.sendMessage(tab.id, createManualScanMessage(), (response) => {
        if (api.runtime.lastError) {
            setStatus(t('error'), 'error');
        } else if (response) {
            const msg = [];
            if (response.promoted > 0) msg.push(`${response.promoted} promoted post`);
            if (response.suggested > 0) msg.push(`${response.suggested} suggested post`);
            if (msg.length > 0) {
                setStatus(`${msg.join(', ')} hidden`, 'success');
            } else {
                setStatus(t('noPostsFound'), 'success');
            }
        } else {
            setStatus(t('noPostsFound'), 'success');
        }
        scanBtn.disabled = false;
        setTimeout(() => setStatus(''), 3000);
    });
});

// Listen for counter updates from background
api.runtime.onMessage.addListener((message) => {
    if (message.type === MESSAGE_TYPES.COUNTER_UPDATE) {
        updateCounters();
    }
});

// Update counters when popup opens
api.runtime.onConnect.addListener((port) => {
    if (port.name === 'counterUpdate') {
        port.onMessage.addListener((msg) => {
            if (msg.type === MESSAGE_TYPES.COUNTER_UPDATE) {
                updateCounters();
            }
        });
    }
});

function setStatus(text, type = '') {
    statusEl.textContent = text;
    statusEl.className = type;
}

// Support section collapsible toggle
supportToggle.addEventListener('click', () => {
    supportToggle.classList.toggle('open');
    supportContent.classList.toggle('open');
});

// Set review link based on platform
const isFirefox = typeof browser !== 'undefined' && browser.runtime?.getURL;
const reviewUrl = isFirefox ? CONFIG.REVIEW_URLS.firefox : CONFIG.REVIEW_URLS.chrome;
reviewLink.href = reviewUrl;
reviewBannerLink.href = reviewUrl;

// Build feedback URL with pre-filled params
const manifest = api.runtime.getManifest();
const feedbackBaseUrl = CONFIG.FEEDBACK_URL;
function updateFeedbackLink() {
    const lang = getCurrentLanguage();
    const platform = isFirefox ? 'firefox' : 'chrome';
    const params = new URLSearchParams({ version: manifest.version, platform, language: lang });
    const url = `${feedbackBaseUrl}?${params}`;
    feedbackLink.href = url;
    feedbackBannerLink.href = url;
}
updateFeedbackLink();

// Review banner (time-based, dismissable)
async function checkReviewBanner() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.INSTALL_DATE]: 0,
        [SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]: false,
    });
    if (result[SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]) return;

    const installDate = result[SETTINGS_KEYS.INSTALL_DATE];
    if (!installDate) return;

    const daysSinceInstall = (Date.now() - installDate) / (1000 * 60 * 60 * 24);
    if (daysSinceInstall >= CONFIG.REVIEW_THRESHOLD_DAYS) {
        reviewBanner.style.display = '';
    }
}

dismissBannerBtn.addEventListener('click', async () => {
    reviewBanner.style.display = 'none';
    await api.storage.local.set({ [SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]: true });
});

// Detect mobile (popup opens in a tab on Firefox Android)
async function detectMobile() {
    try {
        const info = await api.runtime.getPlatformInfo();
        if (info.os === 'android') {
            document.body.classList.add('tab-mode');
        }
    } catch {
        /* Chrome desktop, no Android */
    }
}

// Initialize
detectMobile();
loadSettings();
updateCounters();
checkReviewBanner();
